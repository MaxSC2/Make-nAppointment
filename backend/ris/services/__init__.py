"""RIS-сервисы: PACS-фасад поверх Orthanc.

PACS-фасад скрывает Orthanc от frontend. Frontend работает только с RIS API,
а RIS сам ходит в Orthanc по REST и объединяет данные с PostgreSQL.
"""

from ris.services import pacs_facade

__all__ = ["pacs_facade"]
