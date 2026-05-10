import asyncio
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.uptime import UptimeMonitor, UptimeCheck

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


def start_scheduler():
    if scheduler.get_job("uptime_checker"):
        return
    scheduler.add_job(
        _run_all_checks,
        "interval",
        seconds=30,
        id="uptime_checker",
        replace_existing=True,
    )
    scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
