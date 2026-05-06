import os
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def main():
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')

    if not client_id or not client_secret:
        print("ERROR: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars")
        print("Or paste them below:")
        client_id = client_id or input("Client ID: ").strip()
        client_secret = client_secret or input("Client Secret: ").strip()

    flow = InstalledAppFlow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        SCOPES,
    )

    print("\nOpening browser for OAuth...")
    creds = flow.run_local_server(port=0)

    print("\n=== NEW TOKENS ===")
    print(f"GOOGLE_REFRESH_TOKEN={creds.refresh_token}")
    print(f"\nAccess Token (valid 1hr): {creds.token}")
    print("\nAdd GOOGLE_REFRESH_TOKEN to backend/.env")

if __name__ == "__main__":
    main()
