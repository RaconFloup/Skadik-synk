from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from app.config import settings

ALGORITHM = "HS256"
OPEN_PATHS = {"/api/auth/login", "/api/auth/verify", "/api/health", "/docs", "/openapi.json"}


async def auth_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path.rstrip("/")
    if path in OPEN_PATHS or any(path.startswith(p) for p in ["/api/auth", "/api/health"]) or path in ("/docs", "/openapi.json"):
        return await call_next(request)

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Not authenticated"})

    try:
        jwt.decode(auth[7:], settings.JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Invalid token"})

    return await call_next(request)
