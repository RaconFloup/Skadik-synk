import asyncio
import time
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.uptime import UptimeMonitor, UptimeCheck
from app.models.setting import AppSetting

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


def _run_all_checks():
    db: Session = SessionLocal()
    try:
        monitors = db.query(UptimeMonitor).filter(UptimeMonitor.is_active == True).all()
        for monitor in monitors:
            try:
                is_up, response_time_ms, error = asyncio.run(
                    _tcp_check(monitor.host, monitor.port)
                )
                check = UptimeCheck(
                    monitor_id=monitor.id,
                    is_up=is_up,
                    response_time_ms=response_time_ms,
                    error=error,
                )
                db.add(check)
                db.commit()
            except Exception as e:
                print(f"Uptime check error for {monitor.name}: {e}")
                db.rollback()
    finally:
        db.close()


def _get_interval() -> int:
    db = SessionLocal()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == "uptime_check_interval").first()
        return int(row.value) if row and row.value else 60
    except:
        return 60
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
    return {"interval": interval, "retention_days": _get_retention_days()}


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
