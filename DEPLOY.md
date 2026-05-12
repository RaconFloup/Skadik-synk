# Развёртывание на выделенном сервере

## 1. Подготовка сервера

```bash
# Docker и Docker Compose
apt update && apt install -y docker.io docker-compose-v2

# Создать пользователя (не обязательно)
adduser skadik
usermod -aG docker skadik
su - skadik
```

## 2. Клонировать репозиторий

```bash
git clone https://github.com/RaconFloup/Skadik-synk.git
cd Skadik-synk
```

## 3. Настроить .env

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Обязательно поменять:
- `SECRET_KEY` — любая случайная строка
- `AUTH_PASSWORD` — пароль для входа в панель
- `JWT_SECRET` — любая случайная строка

Опционально:
- `CORS_ORIGINS` — указать домен, если фронтенд на другом адресе
- `TIMEZONE` — например `Europe/Moscow` или `Asia/Yekaterinburg`

## 4. Настроить HTTPS (обязательно)

Вариант A — Caddy (рекомендуется):

```bash
# docker-compose.yml дополнить сервисом caddy
```

```yaml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - frontend

volumes:
  caddy_data:
```

```nginx
# Caddyfile
your-domain.com {
    reverse_proxy frontend:80
}
```

Вариант B — nginx на хосте с certbot:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

## 5. Запустить

```bash
docker compose up -d --build
```

Проверить:

```bash
curl http://localhost:8001/api/health
# {"status":"ok"}
```

## 6. Первоначальная настройка в панели

1. Открыть `https://your-domain.com`
2. Ввести `AUTH_PASSWORD` из `.env`
3. Зайти в **Настройки → Общие**, выбрать основную валюту
4. Настроить интеграции: Telegram, Termix, Google Drive
5. Обновить курсы валют на странице биллинга

## Полезные команды

```bash
# Логи
docker compose logs -f backend
docker compose logs -f frontend

# Пересобрать и перезапустить
docker compose up -d --build

# Остановить
docker compose down

# Полностью удалить данные БД
docker compose down -v
```
