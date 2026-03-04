# ruff: noqa: S101
"""Unit tests for lifecycle coordination and onboarding messaging services."""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

import app.services.openclaw.coordination_service as coordination_lifecycle
import app.services.openclaw.onboarding_service as onboarding_lifecycle
from app.services.openclaw.gateway_rpc import GatewayConfig as GatewayClientConfig
from app.services.openclaw.gateway_rpc import OpenClawGatewayError
from app.services.openclaw.shared import GatewayAgentIdentity


@dataclass
class _FakeSession:
    committed: int = 0
    added: list[object] = field(default_factory=list)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.committed += 1


@dataclass
class _AgentStub:
    id: UUID
    name: str
    openclaw_session_id: str | None = None
    board_id: UUID | None = None


@dataclass
class _BoardStub:
    id: UUID
    gateway_id: UUID | None
    name: str


@pytest.mark.asyncio
async def test_gateway_coordination_nudge_success(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession()
    service = coordination_lifecycle.GatewayCoordinationService(session)  # type: ignore[arg-type]
    board = _BoardStub(id=uuid4(), gateway_id=uuid4(), name="Roadmap")
    actor = _AgentStub(id=uuid4(), name="Lead Agent", board_id=board.id)
    target = _AgentStub(
        id=uuid4(),
        name="Worker Agent",
        openclaw_session_id="agent:worker:main",
        board_id=board.id,
    )
    captured: list[dict[str, Any]] = []

    async def _fake_board_agent_or_404(
        self: coordination_lifecycle.GatewayCoordinationService,
        *,
        board: object,
        agent_id: str,
    ) -> _AgentStub:
        _ = (self, board, agent_id)
        return target

    async def _fake_require_gateway_config_for_board(
        self: coordination_lifecycle.GatewayDispatchService,
        _board: object,
    ) -> tuple[object, GatewayClientConfig]:
        _ = self
        gateway = SimpleNamespace(id=uuid4(), url="ws://gateway.example/ws")
        return gateway, GatewayClientConfig(url="ws://gateway.example/ws", token=None)

    async def _fake_send_agent_message(self, **kwargs: Any) -> None:
        _ = self
        captured.append(kwargs)
        return None

    monkeypatch.setattr(
        coordination_lifecycle.GatewayCoordinationService,
        "_board_agent_or_404",
        _fake_board_agent_or_404,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "require_gateway_config_for_board",
        _fake_require_gateway_config_for_board,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "send_agent_message",
        _fake_send_agent_message,
    )

    await service.nudge_board_agent(
        board=board,  # type: ignore[arg-type]
        actor_agent=actor,  # type: ignore[arg-type]
        target_agent_id=str(target.id),
        message="Please run session startup checklist",
        correlation_id="nudge-corr-id",
    )

    assert len(captured) == 1
    assert captured[0]["session_key"] == "agent:worker:main"
    assert captured[0]["agent_name"] == "Worker Agent"
    assert captured[0]["deliver"] is True
    assert session.committed == 1


@pytest.mark.asyncio
async def test_gateway_coordination_nudge_maps_gateway_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()
    service = coordination_lifecycle.GatewayCoordinationService(session)  # type: ignore[arg-type]
    board = _BoardStub(id=uuid4(), gateway_id=uuid4(), name="Roadmap")
    actor = _AgentStub(id=uuid4(), name="Lead Agent", board_id=board.id)
    target = _AgentStub(
        id=uuid4(),
        name="Worker Agent",
        openclaw_session_id="agent:worker:main",
        board_id=board.id,
    )

    async def _fake_board_agent_or_404(
        self: coordination_lifecycle.GatewayCoordinationService,
        *,
        board: object,
        agent_id: str,
    ) -> _AgentStub:
        _ = (self, board, agent_id)
        return target

    async def _fake_require_gateway_config_for_board(
        self: coordination_lifecycle.GatewayDispatchService,
        _board: object,
    ) -> tuple[object, GatewayClientConfig]:
        _ = self
        gateway = SimpleNamespace(id=uuid4(), url="ws://gateway.example/ws")
        return gateway, GatewayClientConfig(url="ws://gateway.example/ws", token=None)

    async def _fake_send_agent_message(self, **_kwargs: Any) -> None:
        _ = self
        raise OpenClawGatewayError("dial tcp: connection refused")

    monkeypatch.setattr(
        coordination_lifecycle.GatewayCoordinationService,
        "_board_agent_or_404",
        _fake_board_agent_or_404,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "require_gateway_config_for_board",
        _fake_require_gateway_config_for_board,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "send_agent_message",
        _fake_send_agent_message,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.nudge_board_agent(
            board=board,  # type: ignore[arg-type]
            actor_agent=actor,  # type: ignore[arg-type]
            target_agent_id=str(target.id),
            message="Please run session startup checklist",
            correlation_id="nudge-corr-id",
        )

    assert exc_info.value.status_code == status.HTTP_502_BAD_GATEWAY
    assert "Gateway nudge failed:" in str(exc_info.value.detail)
    assert session.committed == 1


@pytest.mark.asyncio
async def test_board_onboarding_dispatch_start_returns_session_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()
    service = onboarding_lifecycle.BoardOnboardingMessagingService(session)  # type: ignore[arg-type]
    gateway_id = uuid4()
    board = _BoardStub(id=uuid4(), gateway_id=gateway_id, name="Roadmap")
    captured: list[dict[str, Any]] = []

    async def _fake_require_gateway_config_for_board(
        self: onboarding_lifecycle.GatewayDispatchService,
        _board: object,
    ) -> tuple[object, GatewayClientConfig]:
        _ = self
        gateway = SimpleNamespace(id=gateway_id, url="ws://gateway.example/ws")
        return gateway, GatewayClientConfig(url="ws://gateway.example/ws", token=None)

    async def _fake_send_agent_message(self, **kwargs: Any) -> None:
        _ = self
        captured.append(kwargs)
        return None

    monkeypatch.setattr(
        onboarding_lifecycle.GatewayDispatchService,
        "require_gateway_config_for_board",
        _fake_require_gateway_config_for_board,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "send_agent_message",
        _fake_send_agent_message,
    )

    session_key = await service.dispatch_start_prompt(
        board=board,  # type: ignore[arg-type]
        prompt="BOARD ONBOARDING REQUEST",
        correlation_id="onboarding-corr-id",
    )

    assert session_key == GatewayAgentIdentity.session_key_for_id(gateway_id)
    assert len(captured) == 1
    assert captured[0]["agent_name"] == "Gateway Agent"
    assert captured[0]["deliver"] is False


@pytest.mark.asyncio
async def test_board_onboarding_dispatch_answer_maps_timeout_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = _FakeSession()
    service = onboarding_lifecycle.BoardOnboardingMessagingService(session)  # type: ignore[arg-type]
    gateway_id = uuid4()
    board = _BoardStub(id=uuid4(), gateway_id=gateway_id, name="Roadmap")
    onboarding = SimpleNamespace(
        id=uuid4(),
        session_key=GatewayAgentIdentity.session_key_for_id(gateway_id),
    )

    async def _fake_require_gateway_config_for_board(
        self: onboarding_lifecycle.GatewayDispatchService,
        _board: object,
    ) -> tuple[object, GatewayClientConfig]:
        _ = self
        gateway = SimpleNamespace(id=gateway_id, url="ws://gateway.example/ws")
        return gateway, GatewayClientConfig(url="ws://gateway.example/ws", token=None)

    async def _fake_send_agent_message(self, **_kwargs: Any) -> None:
        _ = self
        raise TimeoutError("gateway timeout")

    monkeypatch.setattr(
        onboarding_lifecycle.GatewayDispatchService,
        "require_gateway_config_for_board",
        _fake_require_gateway_config_for_board,
    )
    monkeypatch.setattr(
        coordination_lifecycle.GatewayDispatchService,
        "send_agent_message",
        _fake_send_agent_message,
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.dispatch_answer(
            board=board,  # type: ignore[arg-type]
            onboarding=onboarding,
            answer_text="I prefer concise updates.",
            correlation_id="onboarding-answer-corr-id",
        )

    assert exc_info.value.status_code == status.HTTP_502_BAD_GATEWAY
    assert "Gateway onboarding answer dispatch failed:" in str(exc_info.value.detail)


# ---------------------------------------------------------------------------
# commit_heartbeat: 修复验证 - updating 状态应被提升为 online
# ---------------------------------------------------------------------------


@dataclass
class _AgentStatusStub:
    """Minimal agent stub for commit_heartbeat tests."""

    id: UUID = None  # type: ignore[assignment]
    name: str = "Test Agent"
    status: str = "online"
    last_seen_at: object = None
    updated_at: object = None

    def __post_init__(self) -> None:
        if self.id is None:
            self.id = uuid4()


@dataclass
class _FakeSessionWithRefresh(_FakeSession):
    async def refresh(self, obj: object) -> None:
        pass


@pytest.mark.asyncio
async def test_commit_heartbeat_promotes_updating_to_online() -> None:
    """Fix 2: commit_heartbeat 应当把 updating 状态的 agent 提升为 online。

    修复前：只有 provisioning 状态能被自动提升，updating 会被遗漏。
    修复后：provisioning 和 updating 都能被心跳提升为 online。
    """
    from app.services.openclaw.provisioning_db import AgentLifecycleService

    session = _FakeSessionWithRefresh()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    agent = _AgentStatusStub(status="updating")

    # Patch to_agent_read and with_computed_status so we don't need full DB setup
    def _fake_record_heartbeat(_session: object, _agent: object) -> None:
        pass

    def _fake_with_computed_status(a: object) -> object:
        return a

    def _fake_to_agent_read(a: object) -> object:
        return a

    service.record_heartbeat = _fake_record_heartbeat  # type: ignore[method-assign]
    service.with_computed_status = _fake_with_computed_status  # type: ignore[method-assign]
    service.to_agent_read = _fake_to_agent_read  # type: ignore[method-assign]

    await service.commit_heartbeat(agent=agent, status_value=None)  # type: ignore[arg-type]

    assert agent.status == "online", (
        "commit_heartbeat 应当将 updating 状态的 agent 提升为 online（Fix 2）"
    )
    assert session.committed >= 1


@pytest.mark.asyncio
async def test_commit_heartbeat_explicit_status_overrides_updating() -> None:
    """Fix 2 边界：如果显式传入 status_value，该值应优先于自动提升逻辑。"""
    from app.services.openclaw.provisioning_db import AgentLifecycleService

    session = _FakeSessionWithRefresh()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    agent = _AgentStatusStub(status="updating")

    def _fake_record_heartbeat(_session: object, _agent: object) -> None:
        pass

    def _fake_with_computed_status(a: object) -> object:
        return a

    def _fake_to_agent_read(a: object) -> object:
        return a

    service.record_heartbeat = _fake_record_heartbeat  # type: ignore[method-assign]
    service.with_computed_status = _fake_with_computed_status  # type: ignore[method-assign]
    service.to_agent_read = _fake_to_agent_read  # type: ignore[method-assign]

    await service.commit_heartbeat(agent=agent, status_value="busy")  # type: ignore[arg-type]

    assert agent.status == "busy", (
        "显式 status_value 应优先于 updating→online 的自动提升逻辑"
    )


@pytest.mark.asyncio
async def test_commit_heartbeat_promotes_provisioning_to_online() -> None:
    """回归测试：原有的 provisioning→online 提升逻辑不应被破坏。"""
    from app.services.openclaw.provisioning_db import AgentLifecycleService

    session = _FakeSessionWithRefresh()
    service = AgentLifecycleService(session)  # type: ignore[arg-type]

    agent = _AgentStatusStub(status="provisioning")

    def _fake_record_heartbeat(_session: object, _agent: object) -> None:
        pass

    def _fake_with_computed_status(a: object) -> object:
        return a

    def _fake_to_agent_read(a: object) -> object:
        return a

    service.record_heartbeat = _fake_record_heartbeat  # type: ignore[method-assign]
    service.with_computed_status = _fake_with_computed_status  # type: ignore[method-assign]
    service.to_agent_read = _fake_to_agent_read  # type: ignore[method-assign]

    await service.commit_heartbeat(agent=agent, status_value=None)  # type: ignore[arg-type]

    assert agent.status == "online", "provisioning→online 的原有逻辑不应被破坏"
