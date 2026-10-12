import os
import sys
from supabase import create_client
from dotenv import load_dotenv

def main():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    
    if not url or not anon_key:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be configured in your environment.")
        sys.exit(1)
        
    db = create_client(url, anon_key)
    
    email = sys.argv[1] if len(sys.argv) > 1 else "test@example.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "password"
    
    print(f"Signing in as {email}...")
    try:
        res = db.auth.sign_in_with_password({"email": email, "password": password})
        print("\n--- YOUR ACCESS TOKEN ---\n")
        print(res.session.access_token)
        print("\n-------------------------\n")
        print("Paste this into the Swagger 'Authorize' box.")
    except Exception as e:
        print(f"Failed to sign in: {e}")
        print("Make sure the user exists and the password is correct.")

if __name__ == "__main__":
    main()
