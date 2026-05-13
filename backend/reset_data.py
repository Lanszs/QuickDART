"""
One-shot data reset:
  - Clears all reports, teams, deployments, messages, assets, and non-admin users
  - Wipes all non-admin Supabase Auth users
  - Wipes all orphaned files in the Storage 'uploads/' folder
  - Schema is preserved
  - Admin (sysadmin@quickdart.com) is kept; only its team_id is cleared
    if pointing at a team being deleted (to avoid FK violation)

Usage:  python reset_data.py
"""
import os
import sys

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from supabase import create_client

from models.database import SessionLocal

ADMIN_AGENCY_ID = "sysadmin@quickdart.com"
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "quickdart-uploads")

TABLES_FOR_COUNT = ["messages", "deployments", "assets", "reports", "users", "teams"]


def show_counts(session, label):
    print(f"--- {label} ---")
    for t in TABLES_FOR_COUNT:
        n = session.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
        print(f"  {t:<13} {n}")


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    s = SessionLocal()

    show_counts(s, "BEFORE")

    print("\n--- DELETING DB ROWS ---")
    # Delete in dependency order (children before parents)
    s.execute(text("DELETE FROM messages"))
    s.execute(text("DELETE FROM deployments"))
    s.execute(text("DELETE FROM assets"))
    s.execute(text("DELETE FROM reports"))
    s.execute(
        text("DELETE FROM users WHERE agency_id != :admin"),
        {"admin": ADMIN_AGENCY_ID},
    )
    # Defensive: clear admin's team_id so the upcoming team delete can't FK-violate
    s.execute(
        text("UPDATE users SET team_id = NULL WHERE agency_id = :admin"),
        {"admin": ADMIN_AGENCY_ID},
    )
    s.execute(text("DELETE FROM teams"))
    s.commit()

    show_counts(s, "AFTER")

    # Verify admin still exists
    admin_row = s.execute(
        text("SELECT id, agency_id, role, team_id FROM users WHERE agency_id = :a"),
        {"a": ADMIN_AGENCY_ID},
    ).fetchone()
    print(f"\nAdmin row preserved: {admin_row}")
    s.close()

    # ---- Supabase Auth: wipe non-admin users ----
    print("\n--- SUPABASE AUTH WIPE ---")
    try:
        users_resp = sb.auth.admin.list_users()
        users = getattr(users_resp, "users", users_resp) or []
        deleted = 0
        for u in users:
            email = getattr(u, "email", None) or (u.get("email") if isinstance(u, dict) else None)
            uid = getattr(u, "id", None) or (u.get("id") if isinstance(u, dict) else None)
            if email == ADMIN_AGENCY_ID:
                print(f"  PROTECT  {email}")
                continue
            if not uid:
                continue
            try:
                sb.auth.admin.delete_user(uid)
                deleted += 1
                print(f"  DELETE   {email}")
            except Exception as e:
                print(f"  FAILED   {email}: {e}")
        print(f"  Deleted {deleted} auth user(s)")
    except Exception as e:
        print(f"  WARNING: auth listing failed: {e}")

    # ---- Storage: wipe everything under uploads/ ----
    print(f"\n--- STORAGE WIPE: {SUPABASE_BUCKET}/uploads/ ---")
    try:
        files = sb.storage.from_(SUPABASE_BUCKET).list("uploads") or []
        names = []
        for f in files:
            n = getattr(f, "name", None) or (f.get("name") if isinstance(f, dict) else None)
            if n:
                names.append(n)
        if not names:
            print("  No files in uploads/ — nothing to do")
        else:
            paths = [f"uploads/{n}" for n in names]
            sb.storage.from_(SUPABASE_BUCKET).remove(paths)
            print(f"  Deleted {len(paths)} file(s)")
    except Exception as e:
        print(f"  WARNING: storage wipe failed: {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
