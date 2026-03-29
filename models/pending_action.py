"""
Pending Action
--------------
In-memory store for actions awaiting human approval.
Replace with a persistent store (Redis/SQLite) for production.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PendingAction(BaseModel):
    id: str
    alert_id: str
    source_ip: str
    action: str
    confidence: float
    severity: str
    reasoning: str
    created_at: datetime
    timeout_at: Optional[datetime] = None


# In-memory store — replace with Redis/SQLite in production
_pending: dict[str, PendingAction] = {}


def add(action: PendingAction) -> None:
    _pending[action.id] = action


def get(action_id: str) -> Optional[PendingAction]:
    return _pending.get(action_id)


def remove(action_id: str) -> Optional[PendingAction]:
    return _pending.pop(action_id, None)


def list_all() -> list[PendingAction]:
    return list(_pending.values())
