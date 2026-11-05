import sys
import os
from pathlib import Path

# Add backend directory to sys.path so app modules are resolvable
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure fallback to packaged SQLite database if no external DATABASE_URL provided
SEEDED_DB = BACKEND_DIR / "app" / "windscope_seeded.db"
if not os.environ.get("DATABASE_URL") and SEEDED_DB.exists():
    os.environ["DATABASE_URL"] = f"sqlite:///{SEEDED_DB.resolve()}"

from app.main import app

# Export ASGI application for Vercel Python runtime
handler = app
