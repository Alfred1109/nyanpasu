# Clash Data Readiness Troubleshooting

This note summarizes the data-readiness incident we fixed on April 13-14, 2026.

It is meant to prevent the same class of bugs from coming back:

- TUN toggle fails with `error sending request for url (...) /configs`
- `Providers` page is empty even though the core/service is running
- `Dashboard` shows `0 B/s`, `0 B`, `0`, or long-lived empty cards
- A page works after a manual restart, but not after startup or service-mode transition

## Short Version

The underlying problem was not just "the core is down".

It was a readiness/timing bug across multiple layers:

1. Backend code treated "service process is running" as equivalent to "Clash API is ready".
2. Some frontend pages fetched too early, got connection-refused once, and then stayed in an empty state.
3. Some dashboard cards depended mostly on WebSocket first packets, without a reliable HTTP snapshot fallback.
4. Tauri environment detection was inconsistent between modules, so some hooks could be disabled accidentally.

## Main Root Causes

### 1. TUN state change was compared against `draft` instead of persisted state

When patching verge config, the code wrote to `draft()` first and then used `latest()` to compare the old and new TUN state.

That is wrong because `latest()` returns the draft value once a draft exists.

Effect:

- real TUN state changes looked like "no change"
- code chose hot-update (`PUT /configs`) instead of a required core restart
- requests could hit a port that was not ready anymore

Fix:

- capture the persisted value before writing the draft
- compare `previous_tun_mode` against `desired_tun_mode`

Relevant file:

- `backend/tauri/src/feat.rs`

### 2. Service mode "running" did not guarantee Clash API readiness

The service-side core could report `Running` before the external controller port was actually serving requests.

Effect:

- early HTTP calls to `/providers/proxies`, `/proxies`, `/configs` failed with `ECONNREFUSED`
- pages loaded into an empty/error state

Fix:

- after `run_core()` succeeds, wait until `GET /version` actually returns success
- only then emit `refresh_clash()`

Relevant file:

- `backend/tauri/src/core/clash/core.rs`

### 3. Dashboard relied too heavily on WebSocket first packets

`Dashboard` cards were mostly populated from frontend WebSocket caches.

If the first WebSocket packet arrived late, or if the page rendered before the WS subscription became active, the cards could remain visually empty or at zero.

Fix:

- give `connections` an HTTP snapshot fallback
- derive initial traffic samples from connection totals
- show deterministic zero values instead of empty/NaN-like states
- trigger health checks immediately on mount instead of waiting for the first interval tick

Relevant files:

- `frontend/interface/src/ipc/use-clash-connections.ts`
- `frontend/interface/src/service/clash-api.ts`
- `frontend/nyanpasu/src/components/dashboard/data-panel.tsx`
- `frontend/nyanpasu/src/components/dashboard/dataline.tsx`
- `frontend/nyanpasu/src/components/dashboard/health-panel.tsx`

### 4. Tauri environment detection was inconsistent

Some modules only checked `__TAURI__`, while other code already handled `__TAURI_INTERNALS__` and `tauri:` protocol.

Effect:

- some hooks could think they were running in browser mode
- requests or refetches could be skipped unexpectedly

Fix:

- unify detection to support:
  - `__TAURI__`
  - `__TAURI_INTERNALS__`
  - `window.location.protocol === 'tauri:'`

Relevant file:

- `frontend/utils/src/env/index.ts`

## What "Healthy" Looks Like

When the app is healthy in service mode:

- `pgrep -af 'nyanpasu|nyanpasu-service|mihomo'` shows the UI, service, and core processes
- `curl http://127.0.0.1:<controller>/version` succeeds
- `curl http://127.0.0.1:<controller>/connections` returns non-empty JSON
- WebSocket endpoints can produce messages:
  - `/traffic`
  - `/connections`
  - `/memory`
- `Providers` page shows proxy providers and subscription traffic cards
- `Dashboard` does not stay permanently at zero if the system has active traffic

## Fast Diagnosis Checklist

### Step 1. Verify the controller port in runtime config

Check:

- `~/.config/clash-nyanpasu/clash-config.yaml`

Look for:

- `external-controller: 127.0.0.1:<port>`
- `secret: <token>`

### Step 2. Verify the API directly

Example:

```bash
curl -s \
  -H 'Authorization: Bearer <secret>' \
  http://127.0.0.1:<port>/version
```

Then:

```bash
curl -s \
  -H 'Authorization: Bearer <secret>' \
  http://127.0.0.1:<port>/connections
```

If this fails, the issue is backend/core readiness, not frontend rendering.

### Step 3. Verify WebSocket endpoints

At minimum, confirm that:

- `/traffic`
- `/connections`
- `/memory`

can produce first packets.

If HTTP works but WS does not, the dashboard may remain stale.

### Step 4. Check app logs for readiness ordering

Look for these messages in app logs:

- `clash api became ready after ...`
- `WS connector started successfully`
- `error sending request for url (...)`

Bad sequence:

1. page fetches start
2. `ECONNREFUSED`
3. API becomes ready later

Good sequence:

1. core starts
2. API readiness is confirmed
3. refresh event is emitted
4. page queries and WS subscriptions start succeeding

## Fix Pattern

When touching startup/service/TUN code, follow this rule:

> Do not treat process state as data-plane readiness.
> Treat successful API access as readiness.

In practice:

1. Start or restart the core.
2. Poll `/version` until it responds successfully.
3. Only then emit frontend refresh events.
4. Provide at least one HTTP snapshot fallback for pages that mainly depend on WebSockets.

## Regression Tests / Guardrails

### Backend

Add or keep tests around:

- TUN change detection using persisted state, not `draft.latest()`
- service-mode core startup with API readiness polling

### Frontend

Prefer designs where:

- dashboard cards can render from a snapshot before WS packets arrive
- empty state is distinguishable from zero state
- Tauri detection is centralized and reused

## Files Touched During the Fix

Backend:

- `backend/tauri/src/feat.rs`
- `backend/tauri/src/core/clash/core.rs`
- `backend/tauri/src/utils/resolve.rs`

Frontend:

- `frontend/interface/src/service/clash-api.ts`
- `frontend/interface/src/ipc/use-clash-connections.ts`
- `frontend/nyanpasu/src/components/dashboard/data-panel.tsx`
- `frontend/nyanpasu/src/components/dashboard/dataline.tsx`
- `frontend/nyanpasu/src/components/dashboard/health-panel.tsx`
- `frontend/utils/src/env/index.ts`

Tooling:

- `scripts/generate-git-info.ts`

## Recommended Rule for Future Changes

Before merging any change related to:

- service mode
- TUN mode
- core restart
- controller port
- dashboard data sources
- provider data sources

verify all of the following:

1. Fresh startup with service mode enabled
2. TUN enable/disable from UI
3. `Dashboard` gets data without manual restart
4. `Providers` page shows provider/subscription info
5. First page load works even if WebSocket packets arrive late

If a page depends on live WS data, always ask:

> "What does this page show before the first packet arrives?"

If the answer is "nothing useful", add an HTTP snapshot fallback.
