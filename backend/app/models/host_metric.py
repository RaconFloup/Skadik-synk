import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class HostMetricSnapshot(Base):
    __tablename__ = "host_metric_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    cpu_percent = Column(Float)
    cpu_cores = Column(Float)
    memory_percent = Column(Float)
    memory_used_gib = Column(Float)
    memory_total_gib = Column(Float)
    disk_percent = Column(Float)
    disk_used_human = Column(String(20))
    disk_total_human = Column(String(20))
    uptime_formatted = Column(String(30))
    uptime_seconds = Column(Float)
    system_hostname = Column(String(255))
    system_kernel = Column(String(255))
    system_os = Column(String(255))

    # Load average
    load_1m = Column(Float)
    load_5m = Column(Float)
    load_15m = Column(Float)

    # CPU raw ticks for delta computation
    cpu_ticks_json = Column(JSON)

    # Swap
    swap_percent = Column(Float)
    swap_used_gib = Column(Float)
    swap_total_gib = Column(Float)

    # Disk I/O
    disk_io_read_mb = Column(Float)
    disk_io_write_mb = Column(Float)
    disk_io_json = Column(JSON)

    # Network connections
    net_established = Column(Float)
    net_time_wait = Column(Float)

    # Docker
    docker_running = Column(Float)
    docker_total = Column(Float)
    containers_json = Column(JSON)

    # Per-interface traffic
    traffic_json = Column(JSON)

    # Top processes
    top_processes_json = Column(JSON)

    # Active SSH sessions
    sshsessions_json = Column(JSON)

    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class HostMetricRollup1m(Base):
    __tablename__ = "host_metric_rollup_1m"
    __table_args__ = (
        UniqueConstraint("server_id", "recorded_at", name="uix_rollup_1m"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    cpu_percent = Column(Float)
    cpu_cores = Column(Float)
    memory_percent = Column(Float)
    memory_used_gib = Column(Float)
    memory_total_gib = Column(Float)
    disk_percent = Column(Float)
    disk_used_human = Column(String(20))
    disk_total_human = Column(String(20))

    load_1m = Column(Float)
    load_5m = Column(Float)
    load_15m = Column(Float)
    swap_percent = Column(Float)
    swap_used_gib = Column(Float)
    swap_total_gib = Column(Float)
    disk_io_read_mb = Column(Float)
    disk_io_write_mb = Column(Float)
    disk_io_json = Column(JSON)
    net_established = Column(Float)
    net_time_wait = Column(Float)
    docker_running = Column(Float)
    docker_total = Column(Float)
    traffic_json = Column(JSON)

    recorded_at = Column(DateTime(timezone=True), index=True)


class HostMetricRollup5m(Base):
    __tablename__ = "host_metric_rollup_5m"
    __table_args__ = (
        UniqueConstraint("server_id", "recorded_at", name="uix_rollup_5m"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    cpu_percent = Column(Float)
    cpu_cores = Column(Float)
    memory_percent = Column(Float)
    memory_used_gib = Column(Float)
    memory_total_gib = Column(Float)
    disk_percent = Column(Float)
    disk_used_human = Column(String(20))
    disk_total_human = Column(String(20))

    load_1m = Column(Float)
    load_5m = Column(Float)
    load_15m = Column(Float)
    swap_percent = Column(Float)
    swap_used_gib = Column(Float)
    swap_total_gib = Column(Float)
    disk_io_read_mb = Column(Float)
    disk_io_write_mb = Column(Float)
    disk_io_json = Column(JSON)
    net_established = Column(Float)
    net_time_wait = Column(Float)
    docker_running = Column(Float)
    docker_total = Column(Float)
    traffic_json = Column(JSON)

    recorded_at = Column(DateTime(timezone=True), index=True)


class HostMetricRollup10m(Base):
    __tablename__ = "host_metric_rollup_10m"
    __table_args__ = (
        UniqueConstraint("server_id", "recorded_at", name="uix_rollup_10m"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id", ondelete="CASCADE"), nullable=False)
    cpu_percent = Column(Float)
    cpu_cores = Column(Float)
    memory_percent = Column(Float)
    memory_used_gib = Column(Float)
    memory_total_gib = Column(Float)
    disk_percent = Column(Float)
    disk_used_human = Column(String(20))
    disk_total_human = Column(String(20))

    load_1m = Column(Float)
    load_5m = Column(Float)
    load_15m = Column(Float)
    swap_percent = Column(Float)
    swap_used_gib = Column(Float)
    swap_total_gib = Column(Float)
    disk_io_read_mb = Column(Float)
    disk_io_write_mb = Column(Float)
    disk_io_json = Column(JSON)
    net_established = Column(Float)
    net_time_wait = Column(Float)
    docker_running = Column(Float)
    docker_total = Column(Float)
    traffic_json = Column(JSON)

    recorded_at = Column(DateTime(timezone=True), index=True)
