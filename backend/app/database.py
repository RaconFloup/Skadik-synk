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
        conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    run_migrations()