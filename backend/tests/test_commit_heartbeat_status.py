# ruff: noqa: S101
"""Unit tests for AgentLifecycleService.commit_heartbeat status promotion.

Verifies that:
1. Agents stuck in "updating" are rescued to "online" via a successful heartbeat.
2. Agents in "provisioning" are also promoted (regression guard).
3. An explicit status_value is applied directly, bypassing the auto-promote.

All tests run without a real database — the session is a lightweight stub.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest

from app.services.openclaw.provisioning_db import AgentLifecycleService


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------


@dataclass
class _FakeSession:
    committed: int = 0
    added: list[object] = field(default_factory=list)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, _value: object) -> None:
        pass

    async def exec(self, _statement: Any) -> object:
        raise RuntimeError("exec should not be called in this test")


@dataclass
class _FakeActivityEvent:
    """Minimal ActivityEvent stub."""

    event_type: str = ""
    agent_id: UUID | None = None
    board_id: UUID | None = None
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class _FakeAgent:
    id: UUID = field(default_factory=uuid4)
    gateway_id: UUID = field(default_factory=uuid4)
    board_id: UUID | None = None
    status: str = "online"
    last_seen_at: datetime | None = None
    updated_at: datetime | None = None
    wake_attempts: int = 5
    checkin_deadline_at: datetime | None = datetime(2099, 1, 1, tzinfo=UTC)
    last_provision_error: str | None = "previous error"
    heartbeat_config: dict[str, Any] | None = None
    name: str = "Test Agent"
    agent_token_hash: str | None = None
    is_board_lead: bool = False
    lifecycle_generation: int = 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_service(agent: _FakeAgent) -> AgentLifecycleService:
    session = _FakeSession()
    return AgentLifecycleService(session)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_commit_heartbeat_promotes_updating_to_online(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An agent stuck in 'updating' must be promoted to 'online' on successful heartbeat."""
    agent = _FakeAgent(status="updating")
    session = _FakeSession()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    # Stub out record_heartbeat (writes ActivityEvent, requires DB)
    monkeypatch.setattr(
        AgentLifecycleService,
        "record_heartbeat",
        staticmethod(lambda _session, _agent: None),
    )
    # Stub out to_agent_read / with_computed_status (require full model)
    monkeypatch.setattr(
        AgentLifecycleService,
        "to_agent_read",
        lambda _self, a: a,
    )
    monkeypatch.setattr(
        AgentLifecycleService,
        "with_computed_status",
        lambda _self, a: a,
    )

    result = await service.commit_heartbeat(agent=agent, status_value=None)  # type: ignore[arg-type]

    assert result.status == "online", (
        f"Expected 'online' after heartbeat from 'updating', got {result.status!r}"
    )
    # Wake escalation state must be cleared
    assert agent.wake_attempts == 0
    assert agent.checkin_deadline_at is None
    assert agent.last_provision_error is None


@pytest.mark.asyncio
async def test_commit_heartbeat_promotes_provisioning_to_online(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression guard: 'provisioning' must still be promoted to 'online'."""
    agent = _FakeAgent(status="provisioning")
    session = _FakeSession()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    monkeypatch.setattr(
        AgentLifecycleService,
        "record_heartbeat",
        staticmethod(lambda _session, _agent: None),
    )
    monkeypatch.setattr(AgentLifecycleService, "to_agent_read", lambda _self, a: a)
    monkeypatch.setattr(AgentLifecycleService, "with_computed_status", lambda _self, a: a)

    result = await service.commit_heartbeat(agent=agent, status_value=None)  # type: ignore[arg-type]

    assert result.status == "online", (
        f"Expected 'online' after heartbeat from 'provisioning', got {result.status!r}"
    )


@pytest.mark.asyncio
async def test_commit_heartbeat_explicit_status_value_takes_precedence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An explicit status_value must be applied directly, overriding auto-promote."""
    agent = _FakeAgent(status="updating")
    session = _FakeSession()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    monkeypatch.setattr(
        AgentLifecycleService,
        "record_heartbeat",
        staticmethod(lambda _session, _agent: None),
    )
    monkeypatch.setattr(AgentLifecycleService, "to_agent_read", lambda _self, a: a)
    monkeypatch.setattr(AgentLifecycleService, "with_computed_status", lambda _self, a: a)

    result = await service.commit_heartbeat(agent=agent, status_value="degraded")  # type: ignore[arg-type]

    assert result.status == "degraded", (
        f"Expected 'degraded' (explicit), got {result.status!r}"
    )


@pytest.mark.asyncio
async def test_commit_heartbeat_online_agent_stays_online(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An already-'online' agent should remain 'online' after heartbeat."""
    agent = _FakeAgent(status="online")
    session = _FakeSession()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    monkeypatch.setattr(
        AgentLifecycleService,
        "record_heartbeat",
        staticmethod(lambda _session, _agent: None),
    )
    monkeypatch.setattr(AgentLifecycleService, "to_agent_read", lambda _self, a: a)
    monkeypatch.setattr(AgentLifecycleService, "with_computed_status", lambda _self, a: a)

    result = await service.commit_heartbeat(agent=agent, status_value=None)  # type: ignore[arg-type]

    assert result.status == "online"
