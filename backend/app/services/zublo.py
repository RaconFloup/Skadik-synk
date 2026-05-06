import httpx
from typing import Optional
from app.config import settings

CURRENCY_ID_MAP = {
    "RUB": "1",
    "USD": "2", 
    "EUR": "3"
}

CYCLE_ID_MAP = {
    "monthly": "1",
    "yearly": "2"
}


async def create_subscription(
    name: str,
    price: float,
    currency: str,
    cycle: str,
    next_payment: str
) -> dict:
    currency_id = CURRENCY_ID_MAP.get(currency, "2")
    cycle_id = CYCLE_ID_MAP.get(cycle, "1")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.ZUBLO_URL}/api/external/subscriptions",
            headers={
                "Authorization": f"Bearer {settings.ZUBLO_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "name": name,
                "price": price,
                "currency_id": currency_id,
                "cycle_id": cycle_id,
                "frequency": 1,
                "next_payment": next_payment,
                "auto_renew": True,
                "notify": True,
                "notify_days_before": 3
            }
        )
        if response.status_code in (200, 201):
            data = response.json()
            return {"success": True, "subscription_id": data.get("id")}
        return {"success": False, "error": response.text}


async def update_subscription(
    subscription_id: str,
    name: str,
    price: float,
    currency: str,
    cycle: str,
    next_payment: str
) -> dict:
    currency_id = CURRENCY_ID_MAP.get(currency, "2")
    cycle_id = CYCLE_ID_MAP.get(cycle, "1")
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"{settings.ZUBLO_URL}/api/external/subscriptions/{subscription_id}",
            headers={
                "Authorization": f"Bearer {settings.ZUBLO_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "name": name,
                "price": price,
                "currency_id": currency_id,
                "cycle_id": cycle_id,
                "frequency": 1,
                "next_payment": next_payment,
                "auto_renew": True,
                "notify": True,
                "notify_days_before": 3
            }
        )
        if response.status_code == 200:
            return {"success": True}
        return {"success": False, "error": response.text}


async def delete_subscription(subscription_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{settings.ZUBLO_URL}/api/external/subscriptions/{subscription_id}",
            headers={
                "Authorization": f"Bearer {settings.ZUBLO_API_KEY}"
            }
        )
        if response.status_code == 200:
            return {"success": True}
        return {"success": False, "error": response.text}