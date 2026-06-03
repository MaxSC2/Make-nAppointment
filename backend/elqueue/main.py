"""Электронная очередь — FastAPI приложение.

Сервис регистрации пациентов и управления потоком.
БД: PostgreSQL (схемы `queue`, `auth`, `ris`).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import jinja2
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.templating import _TemplateResponse

from db.config import settings
from db.error_handlers import register_error_handlers
from elqueue.routers import auth as auth_router
from elqueue.routers import tickets as tickets_router


# ======================== ШАБЛОНЫ ========================

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=True,
)


def render(name: str, context: dict) -> _TemplateResponse:
    template = jinja_env.get_template(name)
    html = template.render(context)
    return HTMLResponse(html)


# ======================== LIFESPAN ========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """При старте: лог информационных сообщений."""
    print(f"[elqueue] старт, шаблоны: {TEMPLATES_DIR}")
    print(f"[elqueue] БД: {settings.database_url.split('@')[-1]}")
    print(f"[elqueue] RIS: {settings.ris_url}")
    yield
    print("[elqueue] остановлен")


# ======================== ПРИЛОЖЕНИЕ ========================

app = FastAPI(
    title="Electronic Queue",
    version="2.0.0",
    description="Электронная очередь для регистратуры на базе PostgreSQL",
    lifespan=lifespan,
)

# Глобальные обработчики ошибок с русскими сообщениями
register_error_handlers(app)

# Подключаем роутеры
app.include_router(auth_router.router)
app.include_router(tickets_router.router)


# ======================== HTML-СТРАНИЦЫ ========================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request, cabinet: str = "") -> _TemplateResponse:
    return render("index.html", {"request": request, "cabinet": cabinet})


@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request, cabinet: str = "101") -> _TemplateResponse:
    return render("admin.html", {"request": request, "cabinet": cabinet})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> _TemplateResponse:
    return render("login.html", {"request": request})


@app.get("/health")
async def health() -> dict:
    """Health-check для оркестратора (k8s/docker-compose)."""
    return {"status": "ok", "service": "elqueue"}


# ======================== ЗАПУСК ========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "elqueue.main:app",
        host="0.0.0.0",
        port=settings.elqueue_port,
        reload=False,
    )
