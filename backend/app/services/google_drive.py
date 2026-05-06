from google.oauth2.credentials import Credentials
from googleapiclient import discovery as googleapiclient
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaInMemoryUpload
from typing import Optional
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


def get_credentials():
    return Credentials(
        token=None,
        refresh_token=settings.GOOGLE_REFRESH_TOKEN,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token"
    )


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
        creds = get_credentials()
        service = googleapiclient.build('drive', 'v3', credentials=creds)

        filename = f"{server.get('country', '')} {server.get('provider', 'Unknown')}.md"
        content = generate_md_content(server)

        file_metadata = {
            'name': filename,
            'mimeType': 'text/markdown',
            'parents': [settings.GOOGLE_FOLDER_ID]
        }

        media = MediaInMemoryUpload(
            content.encode('utf-8'),
            mimetype='text/markdown'
        )

        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()

        return {"success": True, "file_id": file.get('id')}

    except HttpError as error:
        return {"success": False, "error": str(error)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def update_google_doc(file_id: str, server: dict) -> dict:
    try:
        creds = get_credentials()
        service = googleapiclient.build('drive', 'v3', credentials=creds)

        content = generate_md_content(server)

        media = MediaInMemoryUpload(
            content.encode('utf-8'),
            mimetype='text/markdown'
        )

        service.files().update(
            fileId=file_id,
            media_body=media
        ).execute()

        return {"success": True}

    except HttpError as error:
        return {"success": False, "error": str(error)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def delete_google_doc(file_id: str) -> dict:
    try:
        creds = get_credentials()
        service = googleapiclient.build('drive', 'v3', credentials=creds)

        service.files().delete(fileId=file_id).execute()

        return {"success": True}

    except HttpError as error:
        return {"success": False, "error": str(error)}
    except Exception as e:
        return {"success": False, "error": str(e)}