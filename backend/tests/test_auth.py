"""Тесты аутентификации: login, refresh, logout.

Auth — критичный модуль: если он падает, не работает всё.
"""

from __future__ import annotations

import pytest


pytestmark = pytest.mark.asyncio


async def test_login_success(client, seed_admin) -> None:
    """Логин admin/admin123 возвращает access + refresh токены."""
    resp = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["expires_in"] > 0
    assert len(data["access_token"]) > 50
    assert len(data["refresh_token"]) > 50


async def test_login_wrong_password(client, seed_admin) -> None:
    """Неверный пароль → 401."""
    resp = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong_password"},
    )
    assert resp.status_code == 401
    # Деталь может быть "Invalid credentials" или "Неверный пароль"
    assert "detail" in resp.json()


async def test_login_unknown_user(client) -> None:
    """Несуществующий пользователь → 401 (а не 404 — нельзя палить наличие)."""
    resp = await client.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "any"},
    )
    assert resp.status_code == 401


async def test_login_validation(client) -> None:
    """Пустое тело → 422 (Pydantic validation)."""
    resp = await client.post("/api/auth/login", json={})
    assert resp.status_code == 422


async def test_protected_endpoint_with_token(client, admin_auth_headers) -> None:
    """С валидным токеном защищённый эндпоинт пропускает."""
    resp = await client.get("/api/orders", headers=admin_auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_refresh_token(client, seed_admin) -> None:
    """Refresh-токен работает и возвращает новый access."""
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    refresh = login.json()["refresh_token"]

    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_refresh_with_access_token_rejected(client, seed_admin) -> None:
    """Access-токен не должен приниматься за refresh."""
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    access = login.json()["access_token"]

    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": access},
    )
    assert resp.status_code == 401


async def test_logout_invalidates_refresh(client, seed_admin) -> None:
    """После logout refresh-токен не работает."""
    login = await client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    refresh = login.json()["refresh_token"]
    access = login.json()["access_token"]

    logout = await client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert logout.status_code in (200, 204)

    resp = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh},
    )
    assert resp.status_code == 401
