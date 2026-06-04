"""DICOMweb-прокси: /dicom/* → Orthanc /dicom-web/*

Обеспечивает QIDO-RS / WADO-RS / STOW-RS для DWV-просмотрщика.
Orthanc имеет встроенный DICOMweb-сервер на /dicom-web/.
Этот роутер проксирует запросы, корректно обрабатывая
multipart/related (WADO-RS pixel data) и application/dicom+json.

Использование:
    GET  /dicom/studies              — QIDO-RS список исследований
    GET  /dicom/studies/{uid}/series — QIDO-RS серии исследования
    GET  /dicom/studies/{uid}/series/{suid}/instances — QIDO-RS инстансы
    GET  /dicom/studies/{uid}/series/{suid}/instances/{iuid}/frames/{n} — WADO-RS
    POST /dicom/studies              — STOW-RS загрузка DICOM
"""

from __future__ import annotations

from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import StreamingResponse

from db.config import settings
from db.dependencies import get_current_user
from db.models.auth import User

router = APIRouter(prefix="/dicom", tags=["DICOMweb"])

ORTHANC_DICOMWEB_BASE = f"{settings.orthanc_url}/dicom-web"
PROXY_TIMEOUT = 120


async def _proxy(request: Request, path: str) -> Response:
    """Прокси запроса к Orthanc DICOMweb."""
    url = f"{ORTHANC_DICOMWEB_BASE}/{path.lstrip('/')}"
    body = await request.body()

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            content=body if body else None,
            params=dict(request.query_params),
        )

    content_type = resp.headers.get("content-type", "application/octet-stream")

    if "multipart/related" in content_type:
        return StreamingResponse(
            content=resp.iter_bytes(),
            status_code=resp.status_code,
            media_type=content_type,
            headers=_forward_headers(resp.headers),
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=content_type,
        headers=_forward_headers(resp.headers),
    )


def _forward_headers(headers: dict[str, Any]) -> dict[str, str]:
    """Пробрасываем только нужные заголовки от Orthanc."""
    allowed = {
        "content-type",
        "content-length",
        "content-disposition",
        "transfer-syntax",
        "cache-control",
    }
    return {
        k: v
        for k, v in headers.items()
        if k.lower() in allowed
    }


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def dicomweb_proxy(
    path: str,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Универсальный прокси для всех DICOMweb запросов."""
    return await _proxy(request, path)
