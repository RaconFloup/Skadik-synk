from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers.servers import router as servers_router
from app.routers.sync import router as sync_router
from app.routers.activity import router as activity_router
from app.routers.hostings import router as hostings_router
from app.routers.settings import router as settings_router
from app.routers.telegram import router as telegram_router
from app.routers.exchange_rates import router as exchange_rates_router
from app.routers.auth import router as auth_router
from app.routers.uptime import router as uptime_router
from app.dependencies.auth import auth_middleware
from app.services.uptime_checker import start_scheduler

app = FastAPI(title="Skadik Synk API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(auth_middleware)

app.include_router(servers_router)
app.include_router(sync_router)
app.include_router(activity_router)
app.include_router(hostings_router)
app.include_router(settings_router)
app.include_router(telegram_router)
app.include_router(exchange_rates_router)
app.include_router(auth_router)
app.include_router(uptime_router)


@app.on_event("startup")
def startup():
    init_db()
    start_scheduler()


@app.get("/api/health")
def health():
    return {"status": "ok"}