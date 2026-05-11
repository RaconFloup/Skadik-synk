import asyncio
import time
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.uptime import UptimeMonitor, UptimeCheck
from app.models.setting import AppSetting
from app.models.activity import ActivityLog
from app.services.telegram_notify import send_uptime_notification

scheduler = BackgroundScheduler()


async def _tcp_check(host: str, port: int, timeout: float = 5.0) -> tuple[bool, int | None, str | None]:
    try:
        start = time.monotonic()
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout
        )
        elapsed = int((time.monotonic() - start) * 1000)
        writer.close()
        return True, elapsed, None
    except asyncio.TimeoutError:
        return False, None, "Connection timed out"
    except Exception as e:
        return False, None, str(e)


async def _run_single_check(monitor: UptimeMonitor, db: Session) -> dict:
    is_up, response_time_ms, error = await _tcp_check(monitor.host, monitor.port)
    check = UptimeCheck(
        monitor_id=monitor.id,
        is_up=is_up,
        response_time_ms=response_time_ms,
        error=error,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return {
        "id": str(check.id),
        "is_up": is_up,
        "response_time_ms": response_time_ms,
        "error": error,
        "checked_at": check.checked_at.isoformat() if check.checked_at else None,
    }


def _get_timeout() -> float:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_check_timeout").first()
        return float(row.value) if row and row.value else 5.0
    except:
        return 5.0
    finally:
        db.close()


def _run_all_checks():
    db: Session = SessionLocal()
    try:
        monitors = db.query(UptimeMonitor).filter(UptimeMonitor.is_active == True).all()
        db.close()

        if not monitors:
            return

        timeout = _get_timeout()

        async def _check_all():
            tasks = [_tcp_check(m.host, m.port, timeout) for m in monitors]
            return await asyncio.gather(*tasks, return_exceptions=True)

        results = asyncio.run(_check_all())

        db2: Session = SessionLocal()
        try:
            retry_count = _get_retry_count()
            prev_status: dict[str, bool | None] = {}
            for monitor in monitors:
                last_check = db2.query(UptimeCheck).filter(
                    UptimeCheck.monitor_id == monitor.id
                ).order_by(UptimeCheck.checked_at.desc()).first()
                if last_check:
                    recent = db2.query(UptimeCheck).filter(
                        UptimeCheck.monitor_id == monitor.id
                    ).order_by(UptimeCheck.checked_at.desc()).limit(retry_count).all()
                    fails = sum(1 for c in recent if not c.is_up)
                    prev_status[str(monitor.id)] = fails < retry_count
                else:
                    prev_status[str(monitor.id)] = None

            for monitor, result in zip(monitors, results):
                if isinstance(result, BaseException):
                    print(f"Uptime check error for {monitor.name}: {result}")
                    continue
                is_up, response_time_ms, error = result
                check = UptimeCheck(
                    monitor_id=monitor.id,
                    is_up=is_up,
                    response_time_ms=response_time_ms,
                    error=error,
                )
                db2.add(check)
            db2.commit()

            now_str = datetime.now(timezone.utc).strftime("%H:%M")
            for monitor in monitors:
                recent = db2.query(UptimeCheck).filter(
                    UptimeCheck.monitor_id == monitor.id
                ).order_by(UptimeCheck.checked_at.desc()).limit(retry_count).all()
                fails = sum(1 for c in recent if not c.is_up)
                new_status = fails < retry_count

                old = prev_status.get(str(monitor.id))
                if old is not None and old != new_status:
                    if new_status:
                        text = f"Мониторинг аптайма: {monitor.name} — доступен"
                        send_uptime_notification(monitor.name, is_up=True)
                    else:
                        err = recent[0].error if recent and recent[0].error else "Connection lost"
                        text = f"Мониторинг аптайма: {monitor.name} — недоступен: {err}"
                        send_uptime_notification(monitor.name, is_up=False, error=err)
                    activity = ActivityLog(text=text, time=now_str)
                    db2.add(activity)
            db2.commit()
        except Exception as e:
            print(f"Uptime DB error: {e}")
            db2.rollback()
        finally:
            db2.close()
    except Exception as e:
        print(f"Uptime checker fatal error: {e}")
        if db.is_active:
            db.close()
    finally:
        try:
            if db.is_active:
                db.close()
        except:
            pass


def _get_interval() -> int:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_check_interval").first()
        return int(row.value) if row and row.value else 60
    except:
        return 60
    finally:
        db.close()


def _get_retry_count() -> int:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_retry_count").first()
        return int(row.value) if row and row.value else 3
    except:
        return 3
    finally:
        db.close()


def _get_retention_days() -> int:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_retention_days").first()
        return int(row.value) if row and row.value else 90
    except:
        return 90
    finally:
        db.close()


def _cleanup_old_checks():
    days = _get_retention_days()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    db: Session = SessionLocal()
    try:
        deleted = db.query(UptimeCheck).filter(UptimeCheck.checked_at < cutoff).delete()
        db.commit()
        if deleted:
            print(f"Uptime cleanup: deleted {deleted} checks older than {days} days")
    except Exception as e:
        print(f"Uptime cleanup error: {e}")
        db.rollback()
    finally:
        db.close()


def _schedule_cleanup():
    if scheduler.get_job("uptime_cleanup"):
        scheduler.remove_job("uptime_cleanup")
    scheduler.add_job(
        _cleanup_old_checks,
        "interval",
        days=1,
        id="uptime_cleanup",
        replace_existing=True,
    )


def start_scheduler():
    if scheduler.get_job("uptime_checker"):
        scheduler.remove_job("uptime_checker")
    interval = _get_interval()
    scheduler.add_job(
        _run_all_checks,
        "interval",
        seconds=interval,
        id="uptime_checker",
        replace_existing=True,
    )
    _schedule_cleanup()
    _cleanup_old_checks()
    if not scheduler.running:
        scheduler.start()


def restart_scheduler():
    if scheduler.get_job("uptime_checker"):
        scheduler.remove_job("uptime_checker")
    interval = _get_interval()
    scheduler.add_job(
        _run_all_checks,
        "interval",
        seconds=interval,
        id="uptime_checker",
        replace_existing=True,
    )
    _schedule_cleanup()
    if not scheduler.running:
        scheduler.start()
    return {"interval": interval, "retention_days": _get_retention_days(), "timeout": _get_timeout()}


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
