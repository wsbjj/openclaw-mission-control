# ruff: noqa: S101
"""Unit tests for AgentLifecycleOrchestrator error-path status recovery.

These tests verify that when gateway provisioning fails, the agent status is
reset from "updating" / "provisioning" to "offline" rather than being left
permanently stuck.  They run without a real database by providing lightweight
stubs for Session and Agent.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.services.openclaw.gateway_rpc import OpenClawGatewayError
from app.services.openclaw.lifecycle_orchestrator import AgentLifecycleOrchestrator


# ---------------------------------------------------------------------------
# Stubs
# ---------------------------------------------------------------------------


@dataclass
class _FakeResult:
    _item: object

    def first(self) -> object:
        return self._item


@dataclass
class _FakeSession:
    committed: int = 0
    added: list[object] = field(default_factory=list)
    refreshed: list[object] = field(default_factory=list)
    _agent: object = field(default=None, repr=False)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed += 1

    async def refresh(self, value: object) -> None:
        self.refreshed.append(value)

    async def exec(self, _statement: Any) -> _FakeResult:
        return _FakeResult(self._agent)

    async def flush(self) -> None:
        pass


@dataclass
class _FakeAgent:
    """Minimal Agent-compatible stub with all fields touched by run_lifecycle."""

    id: UUID = field(default_factory=uuid4)
    gateway_id: UUID = field(default_factory=uuid4)
    board_id: UUID | None = None
    status: str = "online"
    last_provision_error: str | None = None
    updated_at: datetime | None = None
    lifecycle_generation: int = 0
    wake_attempts: int = 0
    last_wake_sent_at: datetime | None = None
    checkin_deadline_at: datetime | None = None
    agent_token_hash: str | None = None
    # Fields required by mark_provision_requested
    heartbeat_config: dict[str, Any] | None = None
    provision_requested_at: datetime | None = None
    provision_action: str | None = None


@dataclass
class _FakeGateway:
    id: UUID = field(default_factory=uuid4)
    organization_id: UUID = field(default_factory=uuid4)
    url: str = "ws://gateway.example/ws"
    token: str | None = None
    allow_insecure_tls: bool = False
    disable_device_pairing: bool = False


@dataclass
class _FakeUser:
    """Minimal user stub — prevents get_org_owner_user DB call."""

    id: UUID = field(default_factory=uuid4)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_orchestrator(agent: _FakeAgent) -> tuple[AgentLifecycleOrchestrator, _FakeSession]:
    """Build an orchestrator pre-wired with the given agent stub."""
    session = _FakeSession()
    session._agent = agent  # type: ignore[assignment]
    return AgentLifecycleOrchestrator(session), session  # type: ignore[arg-type]


def _fake_apply_gateway_error(*_args: Any, **_kwargs: Any) -> None:
    raise OpenClawGatewayError("connection refused")


def _fake_apply_os_error(*_args: Any, **_kwargs: Any) -> None:
    raise OSError("network unreachable")


# ---------------------------------------------------------------------------
# Tests — OpenClawGatewayError resets status
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gateway_error_resets_updating_status_to_offline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GatewayError during an update must move status 'updating' → 'offline'."""
    agent = _FakeAgent(status="online")  # will be set to "updating" by mark_provision_requested
    gateway = _FakeGateway()
    orchestrator, session = _make_orchestrator(agent)

    async def _fail(*_args: Any, **_kwargs: Any) -> None:
        raise OpenClawGatewayError("connection refused")

    monkeypatch.setattr(
        "app.services.openclaw.lifecycle_orchestrator.OpenClawGatewayProvisioner.apply_agent_lifecycle",
        _fail,
    )

    with pytest.raises(HTTPException) as exc_info:
        await orchestrator.run_lifecycle(
            gateway=gateway,  # type: ignore[arg-type]
            agent_id=agent.id,
            board=None,
            user=_FakeUser(),  # type: ignore[arg-type]  — prevents get_org_owner_user DB call
            action="update",
            auth_token="fake-token",
            wake=False,
            deliver_wakeup=False,
            wakeup_verb=None,
            clear_confirm_token=False,
            raise_gateway_errors=True,
        )

    assert exc_info.value.status_code == 502
    assert agent.status == "offline", (
        f"Expected 'offline' after gateway error, got {agent.status!r}"
    )
    assert session.committed >= 1


@pytest.mark.asyncio
async def test_gateway_error_resets_provisioning_status_to_offline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GatewayError during provisioning must move status 'provisioning' → 'offline'."""
    agent = _FakeAgent(status="online")
    gateway = _FakeGateway()
    orchestrator, session = _make_orchestrator(agent)

    async def _fail(*_args: Any, **_kwargs: Any) -> None:
        raise OpenClawGatewayError("timeout")

    monkeypatch.setattr(
        "app.services.openclaw.lifecycle_orchestrator.OpenClawGatewayProvisioner.apply_agent_lifecycle",
        _fail,
    )

    with pytest.raises(HTTPException) as exc_info:
        await orchestrator.run_lifecycle(
            gateway=gateway,  # type: ignore[arg-type]
            agent_id=agent.id,
            board=None,
            user=_FakeUser(),  # type: ignore[arg-type]
            action="provision",
            auth_token="fake-token",
            wake=False,
            deliver_wakeup=False,
            wakeup_verb=None,
            clear_confirm_token=False,
            raise_gateway_errors=True,
        )

    assert exc_info.value.status_code == 502
    assert agent.status == "offline", (
        f"Expected 'offline' after gateway provision error, got {agent.status!r}"
    )
    assert agent.last_provision_error == "timeout"


@pytest.mark.asyncio
async def test_os_error_resets_updating_status_to_offline(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """OSError during update must also reset 'updating' → 'offline'."""
    agent = _FakeAgent(status="online")
    gateway = _FakeGateway()
    orchestrator, session = _make_orchestrator(agent)

    async def _fail(*_args: Any, **_kwargs: Any) -> None:
        raise OSError("network unreachable")

    monkeypatch.setattr(
        "app.services.openclaw.lifecycle_orchestrator.OpenClawGatewayProvisioner.apply_agent_lifecycle",
        _fail,
    )

    with pytest.raises(HTTPException) as exc_info:
        await orchestrator.run_lifecycle(
            gateway=gateway,  # type: ignore[arg-type]
            agent_id=agent.id,
            board=None,
            user=_FakeUser(),  # type: ignore[arg-type]
            action="update",
            auth_token="fake-token",
            wake=False,
            deliver_wakeup=False,
            wakeup_verb=None,
            clear_confirm_token=False,
            raise_gateway_errors=True,
        )

    assert exc_info.value.status_code == 500
    assert agent.status == "offline", (
        f"Expected 'offline' after OSError, got {agent.status!r}"
    )


@pytest.mark.asyncio
async def test_gateway_error_no_raise_still_resets_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When raise_gateway_errors=False, status must still be reset (no HTTPException raised)."""
    agent = _FakeAgent(status="online")
    gateway = _FakeGateway()
    orchestrator, _ = _make_orchestrator(agent)

    async def _fail(*_args: Any, **_kwargs: Any) -> None:
        raise OpenClawGatewayError("silent failure")

    monkeypatch.setattr(
        "app.services.openclaw.lifecycle_orchestrator.OpenClawGatewayProvisioner.apply_agent_lifecycle",
        _fail,
    )

    result = await orchestrator.run_lifecycle(
        gateway=gateway,  # type: ignore[arg-type]
        agent_id=agent.id,
        board=None,
        user=_FakeUser(),  # type: ignore[arg-type]
        action="update",
        auth_token="fake-token",
        wake=False,
        deliver_wakeup=False,
        wakeup_verb=None,
        clear_confirm_token=False,
        raise_gateway_errors=False,
    )

    assert result.status == "offline", (  # type: ignore[union-attr]
        f"Expected 'offline' even without raise, got {result.status!r}"  # type: ignore[union-attr]
    )
