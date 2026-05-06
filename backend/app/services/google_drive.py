import httpx
import json
from app.config import settings

COUNTRY_FLAGS = {
    "🇵🇱 Poland": "🇵🇱 Poland",
    "🇩🇪 Germany": "🇩🇪 Germany",
    "🇺🇸 USA": "🇺🇸 USA",
    "🇷🇺 Russia": "🇷🇺 Russia",
    "🇳🇱 Netherlands": "🇳🇱 Netherlands",
    "🇫🇷 France": "🇫🇷 France",
    "🇬🇧 UK": "🇬🇧 UK",
}


def generate_md_content(server: dict) -> str:
    country_flag = COUNTRY_FLAGS.get(server.get("country", ""), server.get("country", ""))
    purpose = server.get("purpose", "Unknown")
    hosting = server.get("hosting", "Unknown")
    ip = server.get("ip", "")
    traffic = server.get("traffic", "")
    cost = server.get("cost", "")
    currency = server.get("currency", "")
    created = server.get("created", "")
    next_payment = server.get("next_payment", "")
    ssh_port = server.get("ssh_port", 22)
    ssh_username = server.get("ssh_username", "")
    ssh_password = server.get("ssh_password", "")
    notes = server.get("notes", "")
    services = server.get("services", {})
    
    services_list = "\n".join([f"- [ ] `{k}` — {v}" for k, v in services.items()]) if services else "- (нет)"
    
    return f"""---
tags:
  - {purpose}
  - server
  - {hosting.lower()}
country: {country_flag}
hosting: {hosting}
purpose: {purpose}
status: active
ip: {ip}
created: {created}
next_payment: {next_payment}
cost: "{cost}{currency}/мес"
---

# {purpose} [{country_flag}] {hosting}

## 🖥️ Основная информация

| Поле            | Значение              |
| --------------- | --------------------- |
| 🌍 Страна       | {country_flag}            |
| 🏢 Хостинг     | {hosting}           |
| 🏷️ Назначение   | {purpose}                  |
| 📡 Статус       | ✅ Активен            |

## 🔌 Подключение

| Поле        | Значение              |
| ----------- | --------------------- |
| 🌐 IP       | `{ip}`       |
| 🔒 SSH Port | `{ssh_port}`              |
| 👤 Логин    | `{ssh_username}`                |
| 🔑 Пароль   | `{ssh_password}` |

```bash
ssh {ssh_username}@{ip}
```

## 💳 Аренда

| Поле                  | Значение       |
| --------------------- | -------------- |
| 💰 Стоимость          | {cost}{currency}/мес      |
| 📅 Дата начала аренды | {created}     |
| 🔔 Следующая оплата   | {next_payment}     |

## 🌐 Трафик

| Поле       | Значение   |
| ---------- | ---------- |
| 🌐 Трафик  | {traffic}   |

## 📦 Сервисы

{services_list}

## 📝 Заметки

> {notes if notes else "Здесь можно добавить любые дополнительные заметки по серверу."}

---
*Последнее обновление: {next_payment}*
"""


async def create_google_doc(server: dict) -> dict:
    try:
        purpose = server.get("purpose", "Unknown")
        country_flag = COUNTRY_FLAGS.get(server.get("country", ""), server.get("country", ""))
        hosting = server.get("hosting", "Unknown")
        filename = f"{purpose} [{country_flag}] {hosting}.md"
        
        content = generate_md_content(server)
        
        payload = json.dumps({
            "action": "create",
            "folderId": settings.GOOGLE_FOLDER_ID,
            "name": filename,
            "content": content
        }).encode('utf-8')
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.GOOGLE_SCRIPT_URL,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "Content-Length": str(len(payload))
                },
                follow_redirects=True,
                timeout=30.0
            )
            
            result = response.json()
            
            if result.get("success"):
                return {"success": True, "file_id": result.get("fileId")}
            return {"success": False, "error": result.get("error", "Unknown error")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


async def update_google_doc(file_id: str, server: dict) -> dict:
    try:
        content = generate_md_content(server)
        purpose = server.get("purpose", "Unknown")
        country_flag = COUNTRY_FLAGS.get(server.get("country", ""), server.get("country", ""))
        hosting = server.get("hosting", "Unknown")
        filename = f"{purpose} [{country_flag}] {hosting}.md"
        
        payload = json.dumps({
            "action": "update",
            "fileId": file_id,
            "name": filename,
            "content": content
        }).encode('utf-8')
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.GOOGLE_SCRIPT_URL,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "Content-Length": str(len(payload))
                },
                follow_redirects=True,
                timeout=30.0
            )
            
            result = response.json()
            return {"success": result.get("success", False), "error": result.get("error")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}


async def delete_google_doc(file_id: str) -> dict:
    try:
        payload = json.dumps({
            "action": "delete",
            "fileId": file_id
        }).encode('utf-8')
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.GOOGLE_SCRIPT_URL,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "Content-Length": str(len(payload))
                },
                follow_redirects=True,
                timeout=30.0
            )
            
            result = response.json()
            return {"success": result.get("success", False), "error": result.get("error")}
            
    except Exception as e:
        return {"success": False, "error": str(e)}
