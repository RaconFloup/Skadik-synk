from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers.servers import router as servers_router
from app.routers.sync import router as sync_router
from app.routers.activity import router as activity_router
from app.routers.hostings import router as hostings_router

app = FastAPI(title="Skadik Synk API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(servers_router)
app.include_router(sync_router)
app.include_router(activity_router)
app.include_router(hostings_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}