import sys
import os
import shutil
import traceback
from pathlib import Path

# Add backend directory to sys.path so app modules are resolvable
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure fallback to packaged SQLite database if no external DATABASE_URL provided
SEEDED_DB = BACKEND_DIR / "app" / "windscope_seeded.db"
if not os.environ.get("DATABASE_URL") and SEEDED_DB.exists():
    try:
        tmp_dir = Path("/tmp")
        if tmp_dir.exists() and os.access(tmp_dir, os.W_OK):
            writable_db = tmp_dir / "windscope_seeded.db"
            if not writable_db.exists() or writable_db.stat().st_size == 0:
                # copyfile avoids copystat permission errors on AWS Lambda/Vercel
                shutil.copyfile(str(SEEDED_DB.resolve()), str(writable_db))
            os.environ["DATABASE_URL"] = f"sqlite:///{writable_db.resolve()}"
        else:
            os.environ["DATABASE_URL"] = f"sqlite:///{SEEDED_DB.resolve()}"
    except Exception as exc:
        print(f"Warning: could not copy SQLite DB to /tmp ({exc}); using read-only source.", file=sys.stderr)
        os.environ["DATABASE_URL"] = f"sqlite:///{SEEDED_DB.resolve()}"

try:
    from backend.app.main import app
except ImportError:
    try:
        from app.main import app
    except Exception as exc:
        # Fallback diagnostic handler if import fails
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        app = FastAPI()
        err_msg = str(exc)
        tb_str = traceback.format_exc()

        @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
        def debug_view(path: str):
            return JSONResponse(
                status_code=500,
                content={"error": "ModuleImportError", "detail": err_msg, "traceback": tb_str},
            )
except Exception as exc:
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI()
    err_msg = str(exc)
    tb_str = traceback.format_exc()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])
    def debug_view(path: str):
        return JSONResponse(
            status_code=500,
            content={"error": "StartupError", "detail": err_msg, "traceback": tb_str},
        )

# Export ASGI application for Vercel Python runtime
handler = app
app = app
