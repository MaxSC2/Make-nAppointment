"""RIS (Radiology Information System) — FastAPI приложение.

Сервис управления заказами на лучевые исследования.
БД: PostgreSQL (схемы `ris`, `auth`, `queue`).
PACS: Orthanc (прокси).
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import jinja2

logger = logging.getLogger("ris")
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from starlette.templating import _TemplateResponse

from db.config import settings
from db.error_handlers import register_error_handlers
from db.session import async_session_maker
from locales import gettext, locale_middleware
from elqueue.routers import auth as auth_router
from ris.routers import dicomweb as dicomweb_router
from ris.routers import monitoring as monitoring_router
from ris.routers import orders as orders_router
from ris.routers import queue_integration as queue_integration_router
from ris.routers import studies as studies_router
from ris.services.smartq_listener import start_listener, stop_listener


# ======================== ШАБЛОНЫ ========================

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=True,
)
jinja_env.globals["_"] = gettext


def render(name: str, context: dict) -> _TemplateResponse:
    template = jinja_env.get_template(name)
    return HTMLResponse(template.render(context))


# ======================== LIFESPAN ========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("старт, шаблоны: %s", TEMPLATES_DIR)
    logger.info("БД: %s", settings.database_url.split('@')[-1])
    logger.info("Orthanc: %s", settings.orthanc_url)
    await start_listener(async_session_maker)
    yield
    await stop_listener()
    logger.info("остановлен")


# ======================== ПРИЛОЖЕНИЕ ========================

app = FastAPI(
    title="RIS Service",
    version="2.0.0",
    description="Radiology Information System на базе PostgreSQL + Orthanc",
    lifespan=lifespan,
)

# CORS — разрешаем фронт на любом origin (dev режим)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Locale middleware (чтение NEXT_LOCALE из cookie)
app.middleware("http")(locale_middleware)

# Глобальные обработчики ошибок с русскими сообщениями
register_error_handlers(app)

app.include_router(auth_router.router)
app.include_router(orders_router.router)
app.include_router(studies_router.router)
app.include_router(monitoring_router.router)
app.include_router(dicomweb_router.router)
app.include_router(queue_integration_router.router)


# ======================== HTML-СТРАНИЦЫ ========================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> _TemplateResponse:
    return render("index.html", {"request": request})


@app.get("/studies", response_class=HTMLResponse)
async def studies_page(request: Request) -> _TemplateResponse:
    return render("studies.html", {"request": request})


@app.get("/viewer/{study_uid}", response_class=HTMLResponse)
async def view_study(request: Request, study_uid: str) -> _TemplateResponse:
    return render("viewer.html", {"request": request, "study_uid": study_uid})


@app.get("/orders/{order_id}/protocol", response_class=HTMLResponse)
async def protocol_page(request: Request, order_id: str) -> _TemplateResponse:
    return render("protocol.html", {"request": request, "order_id": order_id})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ris"}


# ======================== ЗАПУСК ========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "ris.main:app",
        host="0.0.0.0",
        port=settings.ris_port,
        reload=False,
    )
