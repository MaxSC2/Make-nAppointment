"""ORM-модели.

Каждый подмодуль — отдельная предметная область. Импортируйте модели явно,
чтобы избежать циклических зависимостей:

    from db.models.auth import User, Role
    from db.models.queue import Ticket, TicketEvent
    from db.models.ris import Order, Study, Protocol
    from db.models.audit import AuditLog
"""
