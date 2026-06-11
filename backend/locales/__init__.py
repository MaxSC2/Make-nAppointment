import json
import contextvars
from pathlib import Path

LOCALES_DIR = Path(__file__).parent
_cache: dict[str, dict[str, str]] = {}
_locale_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar("locale", default="ru")


def load_locale(locale: str) -> dict[str, str]:
    if locale not in _cache:
        path = LOCALES_DIR / f"{locale}.json"
        if path.exists():
            def _flatten(d: dict, prefix: str = "") -> dict[str, str]:
                result = {}
                for k, v in d.items():
                    key = f"{prefix}.{k}" if prefix else k
                    if isinstance(v, dict):
                        result.update(_flatten(v, key))
                    else:
                        result[key] = v
                return result
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            _cache[locale] = _flatten(data)
        else:
            _cache[locale] = {}
    return _cache[locale]


def set_locale(locale: str):
    _locale_ctx_var.set(locale)


def gettext(text: str) -> str:
    locale = _locale_ctx_var.get()
    if locale == "ru":
        return text
    translations = load_locale(locale)
    return translations.get(text, text)


async def locale_middleware(request, call_next):
    locale = request.cookies.get("NEXT_LOCALE", "ru")
    if locale not in ("ru", "en", "kk"):
        locale = "ru"
    set_locale(locale)
    response = await call_next(request)
    return response
