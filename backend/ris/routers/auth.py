"""RIS-эндпоинт: аутентификация.

RIS использует ту же БД `auth`, поэтому роутер подключается из `elqueue.routers.auth`.
Здесь — только re-export для локального импорта.
"""

from elqueue.routers.auth import router  # noqa: F401
