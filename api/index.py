import sys
import os
import shutil
from pathlib import Path

# Add backend directory to sys.path so app modules are resolvable
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure fallback to packaged SQLite database if no external DATABASE_URL provided
SEEDED_DB = BACKEND_DIR / "app" / "windscope_seeded.db"
if not os.environ.get("DATABASE_URL") and SEEDED_DB.exists():
    # In serverless environments (AWS Lambda / Vercel), /var/task is read-only.
    # Copy the pre-seeded SQLite DB into /tmp so write operations (ingestion runs, table creation, locks) succeed.
    tmp_dir = Path("/tmp")
    if tmp_dir.exists() and os.access(tmp_dir, os.W_OK):
        writable_db = tmp_dir / "windscope_seeded.db"
        if not writable_db.exists() or writable_db.stat().st_size == 0:
            shutil.copy2(str(SEEDED_DB.resolve()), str(writable_db))
        os.environ["DATABASE_URL"] = f"sqlite:///{writable_db.resolve()}"
    else:
        os.environ["DATABASE_URL"] = f"sqlite:///{SEEDED_DB.resolve()}"

try:
    from backend.app.main import app
except ImportError:
    from app.main import app

# Export ASGI application for Vercel Python runtime
handler = app
app = app
