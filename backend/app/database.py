from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    with engine.connect() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'servers' AND column_name = 'needs_sync'
                ) THEN
                    ALTER TABLE servers ADD COLUMN needs_sync BOOLEAN DEFAULT TRUE;
                END IF;
            END $$;
        """))

        conn.execute(text("""
            UPDATE servers SET country = 'pl Poland' WHERE country = '\U0001F1F5\U0001F1F1 Poland';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'de Germany' WHERE country = '\U0001F1E9\U0001F1EA Germany';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'us USA' WHERE country = '\U0001F1FA\U0001F1F8 USA';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'ru Russia' WHERE country = '\U0001F1F7\U0001F1FA Russia';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'nl Netherlands' WHERE country = '\U0001F1F3\U0001F1F1 Netherlands';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'fr France' WHERE country = '\U0001F1EB\U0001F1F7 France';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'gb UK' WHERE country = '\U0001F1EC\U0001F1E7 UK';
        """))
        conn.execute(text("""
            UPDATE servers SET country = 'ua Ukraine' WHERE country = '\U0001F1FA\U0001F1E6 Ukraine';
        """))

        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'servers' AND column_name = 'not_renewing'
                ) THEN
                    ALTER TABLE servers ADD COLUMN not_renewing BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        """))

        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'servers' AND column_name = 'last_paid_at'
                ) THEN
                    ALTER TABLE servers ADD COLUMN last_paid_at DATE;
                END IF;
            END $$;
        """))

        for col, typ in [("uptime_formatted", "VARCHAR(30)"), ("uptime_seconds", "FLOAT"), ("system_hostname", "VARCHAR(255)"), ("system_kernel", "VARCHAR(255)"), ("system_os", "VARCHAR(255)")]:
            conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'host_metric_snapshots' AND column_name = '{col}'
                    ) THEN
                        ALTER TABLE host_metric_snapshots ADD COLUMN {col} {typ};
                    END IF;
                END $$;
            """))

        snap_cols = [
            ("load_1m", "FLOAT"), ("load_5m", "FLOAT"), ("load_15m", "FLOAT"),
            ("swap_percent", "FLOAT"), ("swap_used_gib", "FLOAT"), ("swap_total_gib", "FLOAT"),
            ("disk_io_read_mb", "FLOAT"), ("disk_io_write_mb", "FLOAT"),
            ("net_established", "FLOAT"), ("net_time_wait", "FLOAT"),
            ("docker_running", "FLOAT"), ("docker_total", "FLOAT"),
            ("containers_json", "JSONB"), ("traffic_json", "JSONB"), ("top_processes_json", "JSONB"),
        ]
        for tables in [["host_metric_snapshots"], ["host_metric_rollup_1m", "host_metric_rollup_5m", "host_metric_rollup_10m"]]:
            for col, typ in snap_cols:
                if typ == "JSONB" and tables != ["host_metric_snapshots"]:
                    continue
                for table in tables:
                    conn.execute(text(f"""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_name = '{table}' AND column_name = '{col}'
                            ) THEN
                                ALTER TABLE {table} ADD COLUMN {col} {typ};
                            END IF;
                        END $$;
                    """))

        # traffic_json for rollup tables
        for table in ["host_metric_rollup_1m", "host_metric_rollup_5m", "host_metric_rollup_10m"]:
            conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = '{table}' AND column_name = 'traffic_json'
                    ) THEN
                        ALTER TABLE {table} ADD COLUMN traffic_json JSONB;
                    END IF;
                END $$;
            """))

        # disk_io_json for all metric tables
        for table in ["host_metric_snapshots", "host_metric_rollup_1m", "host_metric_rollup_5m", "host_metric_rollup_10m"]:
            conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = '{table}' AND column_name = 'disk_io_json'
                    ) THEN
                        ALTER TABLE {table} ADD COLUMN disk_io_json JSONB;
                    END IF;
                END $$;
            """))

        # cpu_ticks_json for raw snapshots only
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'host_metric_snapshots' AND column_name = 'cpu_ticks_json'
                ) THEN
                    ALTER TABLE host_metric_snapshots ADD COLUMN cpu_ticks_json JSONB;
                END IF;
            END $$;
        """))

        # sshsessions_json
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'host_metric_snapshots' AND column_name = 'sshsessions_json'
                ) THEN
                    ALTER TABLE host_metric_snapshots ADD COLUMN sshsessions_json JSONB;
                END IF;
            END $$;
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_uptime_checks_monitor_checked
            ON uptime_checks (monitor_id, checked_at);
        """))

        conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    run_migrations()