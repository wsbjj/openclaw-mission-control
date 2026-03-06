# Gateway Agent Provisioning and Check-In Troubleshooting

This guide explains how agent provisioning converges to a healthy state, and how to debug when an agent appears stuck.

## Fast Convergence Policy

Mission Control now uses a fast convergence policy for wake/check-in:

- Check-in deadline after each wake: **30 seconds**
- Maximum wake attempts without check-in: **3**
- If no check-in after the third attempt: agent is marked **offline** and provisioning escalation stops

This applies to both gateway-main and board agents.

## Expected Lifecycle

1. Mission Control provisions/updates the agent and sends wake.
2. A delayed reconcile task is queued for the check-in deadline.
3. Agent should call heartbeat quickly after startup/bootstrap.
4. If heartbeat arrives:
   - `last_seen_at` is updated
   - wake escalation state is reset (`wake_attempts=0`, check-in deadline cleared)
5. If heartbeat does not arrive by deadline:
   - reconcile re-runs lifecycle (wake again)
   - up to 3 total wake attempts
6. If still no heartbeat after 3 attempts:
   - agent status becomes `offline`
   - `last_provision_error` is set

## Startup Check-In Behavior

Templates now explicitly require immediate first-cycle check-in:

- Main agent heartbeat instructions require immediate check-in after wake/bootstrap.
- Board lead bootstrap requires heartbeat check-in before orchestration.
- Board worker bootstrap already included immediate check-in.

If a gateway still has older templates, run template sync and reprovision/wake.

## What You Should See in Logs

Healthy flow usually includes:

- `lifecycle.queue.enqueued`
- `queue.worker.success` (for lifecycle tasks)
- `lifecycle.reconcile.skip_not_stuck` (after heartbeat lands)

If agent is not checking in:

- `lifecycle.reconcile.deferred` (before deadline)
- `lifecycle.reconcile.retriggered` (retry wake)
- `lifecycle.reconcile.max_attempts_reached` (final fail-safe at attempt 3)

If you do not see lifecycle events at all, verify queue worker health first.

## Common Failure Modes

### Wake was sent, but no check-in arrived

Possible causes:

- Agent process never started or crashed during bootstrap
- Agent ignored startup instructions due to stale templates
- Heartbeat call failed (network/auth/base URL mismatch)

Actions:

1. Confirm current templates were synced to gateway.
2. Re-run provisioning/update to trigger a fresh wake.
3. Verify agent can reach Mission Control API and send heartbeat with `X-Agent-Token`.

### Agent stays provisioning/updating with no retries

Possible causes:

- Queue worker not running
- Queue/Redis mismatch between API process and worker process

Actions:

1. Verify worker process is running continuously.
2. Verify `rq_redis_url` and `rq_queue_name` are identical for API and worker.
3. Check worker logs for dequeue/handler errors.

### Agent ended offline quickly

This is expected when no check-in is received after 3 wake attempts. The system fails fast by design.

Actions:

1. Fix check-in path first (startup, network, token, API reachability).
2. Re-run provisioning/update to start a new attempt cycle.

## Operator Recovery Checklist

1. Ensure queue worker is running.
2. Sync templates for the gateway.
3. Trigger agent update/provision from Mission Control.
4. Watch logs for:
   - `lifecycle.queue.enqueued`
   - `lifecycle.reconcile.retriggered` (if needed)
   - heartbeat activity / `skip_not_stuck`
5. If still failing, capture:
   - gateway logs around bootstrap
   - worker logs around lifecycle events
   - agent `last_provision_error`, `wake_attempts`, `last_seen_at`

---

## Agent 一直显示 provisioning（中文排查清单）

现象：网关状态显示已连接（如 1Panel 上 openclaw 与 mission-control 的 ws config.schema 成功），但 Agent 状态一直是 **provisioning**，不变成 online。

### 可能原因与对应检查

1. **网关在数据库里没有配置 URL**
   - 前端「网关状态」可能是通过请求参数里的 `gateway_url` 去探测的，和数据库里保存的网关 URL 可能不一致。
   - **操作**：在 Mission Control 里进入「网关」→ 编辑该网关 → 确认 **URL** 已填写（例如 `ws://192.168.8.155:18789`）并保存。保存会触发 main agent 的 `ensure_main_agent(..., action="update")`，重新执行下发。
   - 若此前网关 URL 为空，本次代码已修复：无 URL 时会将该 agent 设为 **offline** 并写入 `last_provision_error`，不再长期停在 provisioning。

2. **从未成功执行过 provision（或执行时报错未正确处理）**
   - 若添加/编辑网关时后端报错，或曾出现未捕获异常，agent 可能一直停留在创建时的默认状态 provisioning。
   - **操作**：编辑网关并保存（或使用「同步模板」），触发重新下发；同时查看 **backend** 日志中是否有：
     - `gateway.main_agent.provision_success`（成功）
     - `gateway.main_agent.provision_failed`（失败）
     - `lifecycle.run_lifecycle.unexpected_error`（未预期的异常，现已会记录并将 agent 设为 offline）

3. **Queue Worker 未运行**
   - 下发成功后会入队一条「30 秒后检查 check-in」的 reconcile 任务。若 worker 未跑，不会重试 wake，也不会在 3 次失败后把 agent 标为 offline（但成功下发后 agent 会先被设为 **online**，所以若一直是 provisioning，多半是上面 1 或 2）。
   - **操作**：确认 compose 里 **webhook-worker** 服务在运行，且与 backend 使用相同的 `RQ_REDIS_URL` 和 `RQ_QUEUE_NAME`（默认均为 `default`）。可查看 worker 日志是否有 `queue.worker.success`、`lifecycle.reconcile.*`。

4. **OpenClaw 侧 agent 未向 Mission Control 上报心跳**
   - 下发成功后，openclaw 上的 agent 进程需在启动后调用 Mission Control 的 `POST /api/v1/agent/heartbeat`（带 `X-Agent-Token`）。若网络不通、BASE_URL 错误或 token 错误，Mission Control 收不到心跳；但首次下发成功时状态会先变为 **online**，只有后续 reconcile 在 3 次重试后才会改为 offline。
   - 若你看到的是 **先 online 再变 offline**，可按文档前面 “Wake was sent, but no check-in arrived” 排查心跳与模板。

### 建议操作顺序

1. 在 Mission Control 中**编辑该网关**，确认 URL、Token 正确并保存，观察 agent 状态是否变为 online 或至少变为 offline（并查看 `last_provision_error`）。
2. 查看 **backend** 最近日志中的 `gateway.main_agent.*` 与 `lifecycle.run_lifecycle.*`。
3. 确认 **webhook-worker** 在运行，并查看其日志中的 `queue.worker.*`、`lifecycle.reconcile.*`。
4. 若 agent 变为 offline，查看该 agent 的 `last_provision_error`、`wake_attempts`、`last_seen_at`，并确认 openclaw 上的 agent 能访问 Mission Control 的 BASE_URL 并正确发送心跳。
