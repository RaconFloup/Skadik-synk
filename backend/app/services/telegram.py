import httpx
import re


async def fetch_bot_avatar(bot_username: str) -> str:
    username = bot_username.strip().lstrip('@')
    if not username:
        raise Exception("Invalid username")

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        resp = await client.get(f"https://t.me/{username}")
        if resp.status_code != 200:
            raise Exception(f"Page https://t.me/{username} returned status {resp.status_code}")

        html = resp.text

        match = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html)
        if not match:
            match = re.search(r'<meta\s+content="([^"]+)"\s+property="og:image"', html)
        if not match:
            raise Exception(f"Could not find profile photo for @{username}")

        return match.group(1).replace("&amp;", "&")
