from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime, timedelta
from models.action_proposal import ActionProposal, ApprovalStatus
import logging

logger = logging.getLogger("sentinal.pending_actions")

# In-memory store — replace with DB for production
_pending: Dict[str, ActionProposal] = {}

APPROVAL_TIMEOUT_MINUTES = 30


def add(proposal: ActionProposal) -> None:
    _pending[proposal.action_id] = proposal
    logger.info(f"[SENTINAL] Added pending action {proposal.action_id} for IP {proposal.source_ip}")


def get(action_id: str) -> Optional[ActionProposal]:
    return _pending.get(action_id)


def list_pending() -> list[ActionProposal]:
    now = datetime.utcnow()
    result = []
    for p in _pending.values():
        if p.status == ApprovalStatus.PENDING:
            age = now - p.created_at
            if age > timedelta(minutes=APPROVAL_TIMEOUT_MINUTES):
                p.status = ApprovalStatus.EXPIRED
                logger.warning(f"[SENTINAL] Action {p.action_id} expired after {APPROVAL_TIMEOUT_MINUTES}min")
            else:
                result.append(p)
    return result


def approve(action_id: str, approved_by: str = "telegram_admin", armoriq_token: str = None) -> Optional[ActionProposal]:
    proposal = _pending.get(action_id)
    if not proposal or proposal.status != ApprovalStatus.PENDING:
        return None
    proposal.status = ApprovalStatus.APPROVED
    proposal.approved_by = approved_by
    proposal.decided_at = datetime.utcnow()
    proposal.armoriq_token = armoriq_token
    logger.info(f"[SENTINAL] Action {action_id} approved by {approved_by}")
    return proposal


def reject(action_id: str, rejected_by: str = "telegram_admin", reason: str = "") -> Optional[ActionProposal]:
    proposal = _pending.get(action_id)
    if not proposal or proposal.status != ApprovalStatus.PENDING:
        return None
    proposal.status = ApprovalStatus.REJECTED
    proposal.rejected_by = rejected_by
    proposal.rejection_reason = reason
    proposal.decided_at = datetime.utcnow()
    logger.info(f"[SENTINAL] Action {action_id} rejected by {rejected_by}: {reason}")
    return proposal


def mark_executed(action_id: str, result: str) -> Optional[ActionProposal]:
    proposal = _pending.get(action_id)
    if not proposal:
        return None
    proposal.executed_at = datetime.utcnow()
    proposal.execution_result = result
    logger.info(f"[SENTINAL] Action {action_id} executed: {result}")
    return proposal
