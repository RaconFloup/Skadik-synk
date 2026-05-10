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

        conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    run_migrations()