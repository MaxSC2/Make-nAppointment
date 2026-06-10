"""Глобальные обработчики ошибок FastAPI с русскими сообщениями.

Подключаются в `ris/main.py` и `elqueue/main.py` через `register_error_handlers(app)`.
Заменяют стандартные английские сообщения FastAPI на русские.

Не переводит:
- DICOM-теги (стандарт = Latin-1)
- HL7 segment names (стандарт = EN)
- Имена полей БД / API endpoints
"""

from __future__ import annotations

import logging
import traceback
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


# ======================== СПРАВОЧНИК ПЕРЕВОДОВ ========================

_STATUS_TRANSLATIONS: dict[int, str] = {
    400: "Некорректный запрос",
    401: "Требуется авторизация. Войдите в систему.",
    403: "Доступ запрещён. Недостаточно прав.",
    404: "Ресурс не найден",
    405: "Метод не разрешён",
    409: "Конфликт. Ресурс уже существует или состояние несовместимо.",
    422: "Ошибка валидации данных",
    429: "Слишком много запросов. Попробуйте позже.",
    500: "Внутренняя ошибка сервера. Попробуйте позже или обратитесь к администратору.",
    502: "Ошибка связи с внешним сервисом (PACS/МИС)",
    503: "Сервис временно недоступен. Попробуйте позже.",
    504: "Превышено время ожидания от внешнего сервиса",
}

logger = logging.getLogger("error_handler")


# ======================== ОБРАБОТЧИКИ ========================


def _make_error_response(
    status_code: int,
    message: str,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    """Стандартный формат ошибки (русский)."""
    body: dict[str, Any] = {
        "detail": message,
        "status": status_code,
        "status_phrase": _STATUS_TRANSLATIONS.get(status_code, "Ошибка"),
    }
    if extra:
        body.update(extra)
    return JSONResponse(status_code=status_code, content=body)


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """HTTPException → русский detail. Не затирает явный detail (если он уже на русском)."""
    raw = exc.detail
    # Если detail уже строка с кириллицей — оставляем как есть
    if isinstance(raw, str) and _is_russian_or_neutral(raw):
        message = raw
    elif isinstance(raw, str) and raw in _STATUS_TRANSLATIONS.values():
        message = raw
    elif isinstance(raw, str) and not _is_standard_http_phrase(raw):
        # Кастомное сообщение (даже на английском) — сохраняем
        message = raw
    else:
        # Стандартное HTTP-сообщение → переводим на русский
        message = _STATUS_TRANSLATIONS.get(exc.status_code, "Ошибка")
    return _make_error_response(exc.status_code, message)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """422 — ошибка валидации pydantic. Делаем понятные сообщения."""
    errors = exc.errors()
    pretty = []
    for e in errors:
        loc = " → ".join(str(x) for x in e.get("loc", []))
        msg = _translate_validation_message(e.get("msg", ""), e.get("type", ""))
        pretty.append({"field": loc, "message": msg})
    return _make_error_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Ошибка валидации данных: " + "; ".join(p["message"] for p in pretty[:3]),
        extra={"errors": pretty},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """500 — необработанные исключения. Логируем, клиенту — общее сообщение."""
    logger.error(
        "Необработанное исключение на %s %s: %s\n%s",
        request.method,
        request.url.path,
        exc,
        traceback.format_exc(),
    )
    return _make_error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        _STATUS_TRANSLATIONS[500],
    )


# ======================== УТИЛИТЫ ========================


_HTTP_DEFAULT_PHRASES = {
    "Bad Request", "Unauthorized", "Forbidden", "Not Found",
    "Method Not Allowed", "Conflict", "Unprocessable Entity",
    "Too Many Requests", "Internal Server Error",
}


def _is_standard_http_phrase(text: str) -> bool:
    return text.strip() in _HTTP_DEFAULT_PHRASES


def _is_russian_or_neutral(text: str) -> bool:
    """Эвристика: текст уже на русском или нейтральный (код, имя, число)."""
    cyrillic = sum(1 for c in text if "Ѐ" <= c <= "ӿ")
    return cyrillic >= 3 or (cyrillic >= 1 and len(text) < 60 and not text.isascii())


def _translate_validation_message(msg: str, err_type: str) -> str:
    """Перевод типовых pydantic-сообщений на русский."""
    if err_type == "missing":
        return "поле обязательно"
    if err_type == "string_too_short":
        return "слишком короткое значение"
    if err_type == "string_too_long":
        return "слишком длинное значение"
    if err_type.startswith("type_error") or err_type.startswith("value_error"):
        return f"неверный тип/формат: {msg}"
    if err_type == "int_parsing" or err_type == "float_parsing":
        return "ожидается число"
    if err_type == "uuid_parsing":
        return "ожидается UUID"
    if err_type == "datetime_parsing" or err_type == "date_parsing":
        return "ожидается дата/время"
    if err_type == "json_invalid":
        return "невалидный JSON"
    return msg or "невалидное значение"


# ======================== РЕГИСТРАЦИЯ ========================


def register_error_handlers(app: FastAPI) -> None:
    """Зарегистрировать обработчики ошибок в приложении FastAPI.

    Использование:
        from db.error_handlers import register_error_handlers
        app = FastAPI(...)
        register_error_handlers(app)
    """
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
