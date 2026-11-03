---
name: handy-api-v3
description: Build apps that control a Handy device (Ohdoki / Sweet Tech, handyfeeling.com) through Handy REST API v3. Use whenever the user wants to control a Handy, Handy 1, Handy 2 or Oh from code, play funscripts or synced video, stream live motion, build a web or Node client, issue client tokens, handle SSE device events, or asks whether a device or firmware works with API v3. Covers auth, device compatibility, every protocol (HAMP, HVP, HDSP, HSSP, HSP, STREAM, HRPP), clock sync and script hosting.
---

# Handy REST API v3

Base URL: `https://www.handyfeeling.com/api/handy-rest/v3`. Beta, core is considered stable. Pre-release channel: `/v3-next`.

Full material lives in `references/`. Read these instead of guessing endpoint shapes:

- `references/api-v3-docs.md`: the official Notion docs as markdown (auth, firmware, SSE, every protocol).
- `references/openapi-v3.yaml`: the OpenAPI 3.0.3 spec, 67 operations. Grep it for request and response schemas.
- `references/hosting-api-v2.yaml`: temporary script hosting for HSSP.
- `references/examples/`: the official demo repo (browser JS, no build step) with a complete client in `handy-rest-api-v3-client.js`.

Live sources: Swagger UI `.../v3/docs/`, spec `.../v3/docs/spec.yaml`, examples `https://gitlab.com/sweettechas/platform/platform-api-examples`, docs `https://ohdoki.notion.site/api-v3`.

## Device compatibility

- v3 requires firmware 4 or later. The first-gen Handy works only after a firmware 4 update (done at handyverse.com/#/ota or new.handyfeeling.com, or the Handy Onboarding app).
- On firmware 3 only `GET /connected`, `GET /info` and `GET /sse` work (SSE needs fw 3.0.0 or later). Everything else returns "Device not connected".
- Compatibility check: `/connected`, then `/info`. `fw_status` is 0 up-to-date, 1 update-available, 2 update-required. At 2, send the user to `https://handyverse.com/#/ota`.
- `GET /capabilities` lists hardware: `slider`, `lra`, `erm`, `battery`, LED fields. Check it before offering a protocol. A first-gen Handy has a slider and no vibration motors, so HVP does not apply to it.
- `/info` returns `hw_model_name`, `hw_model_no`, `fw_version`, `session_id`.

## Auth

A developer account is required (invite only, `https://user.handyfeeling.com/invite`). The account access token only logs in to the web UI. API calls use issued credentials:

| Credential | Where | Access |
| --- | --- | --- |
| Application ID | client-side code is fine | non-privileged endpoints |
| Application Key | server only, never in client code | privileged endpoints, can issue client tokens |
| Client token | client-side, short lived | like an Application ID, with restrictions |

Headers on device calls:

- `X-Connection-Key`: the device connection key. Required on every device call, even with a device-restricted token.
- Application ID or client token: `Authorization: Bearer <token>` or `X-Api-Key: <id>`.
- `X-Api-Key: <application key>` for server-side calls.
- Query form for SSE (EventSource cannot set headers): `?ck=<connection key>&apikey=<token>`.

Issue a client token server-side with `GET /auth/token/issue` (Application Key). Query params: `ttl` (60 to 86400 s, default 3600), `to` (device connection key), `ip`, `origin`, `r`, `ua`, `al`, `ae`, `cc`. Response has `token`, `expires_at`, `renew` (URL to extend before expiry). Browser apps should fetch tokens from their own backend, see `references/examples/handy-rest-api-v3/auth/auth-proxy-server`.

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. HTTP 429 on exceed.

## Response shape

Success: `{ result: {...} }`. Failure: `{ error: { connected, name, message, code, data } }`. Every device endpoint takes `?timeout=` (5000 to 60000 ms, default 5000). Raise it for high-latency devices.

## Pick a protocol

| Goal | Protocol |
| --- | --- |
| Simple on/off with speed and stroke, like the buttons | HAMP |
| Play a funscript in sync with video or audio | HSSP |
| Live or generated motion with synchronization and full buffer control | HSP |
| Live append-only data shared by several devices, server pushes points | STREAM (needs the Stream API to create streams) |
| Immediate commands from a real-time source (games, sliders), no sync | HDSP |
| Built-in patterns stored on the device (fw 4) | HRPP |
| Vibration devices (LRA, ERM) | HVP |

Modes (`GET /mode`): 0 hamp, 1 hssp, 2 hdsp, 3 maintenance, 4 hsp, 5 ota, 6 button, 7 idle, 8 vibrate, 9 hrpp. The device switches mode automatically when a protocol command arrives, so setting it explicitly is rarely needed.

## Slider

`PUT /slider/stroke` `{min, max}` (0 to 1) sets the usable range for every mode. HAMP stroke is relative to that range: slider 0.5 to 1 with HAMP 0.5 to 1 gives an effective 0.75 to 1.

## HAMP

`PUT /hamp/start`, `/hamp/stop`, `PUT /hamp/velocity {velocity: 0..1}`, `PUT /hamp/stroke {min, max}`, `GET/PUT /hamp/state`. Start begins at velocity 0, so set velocity after starting.

## HDSP

Six commands, no setup: `/hdsp/xava`, `xavp`, `xpva`, `xpvp`, `xat`, `xpt`. Naming: `x` position, `a` or `p` absolute (mm) or percent, `v` velocity, `t` time in ms. Example `PUT /hdsp/xpva {xp: 0..100, va, stop_on_target?, immediate_rsp?}`. Commands are not buffered and have no sync. Keep `stop_on_target` false for smooth motion.

## Clock sync (required for HSSP, HSP, STREAM)

`play` and `synctime` need `server_time`, the client's estimate of server time (Tcest).

1. Call `GET /servertime` about 30 times. Record send and receive times.
2. Per sample: `rtd = Treceive - Tsend`, `Ts_est = Ts + rtd/2`, `offset = Ts_est - Treceive`.
3. `cs_offset` is the mean of the offsets.
4. `Tcest = Date.now() + cs_offset`.

Recompute if sync drifts. Reference implementation: `references/examples/handy-rest-api-v3/server-time-sync/main.js`.

Device-side clock: `GET /hstp/clocksync`, `PUT/GET /hstp/offset` (user-adjustable ms offset to nudge script timing).

## HSSP (synced scripts)

1. `PUT /hssp/setup` with one of `url` (public internet only, no private network), `csv`, or `actions` (funscript actions array). Add `notify: true` for HSP-style SSE notifications. No script size limit on fw 4, the server streams points to the device. Use the Hosting API if you cannot host the script.
2. `PUT /hssp/play {start_time, server_time, playback_rate?, loop?}`.
3. While playing, send `PUT /hssp/synctime {current_time, server_time, filter?}` every 2 s for the first 10 s, then every 10 s. Repeat after every seek.
4. `PUT /hssp/stop`, `/hssp/pause`, `/hssp/resume`, `GET /hssp/state`.

Script formats: funscript JSON (`actions: [{at, pos}]`, `at` in ms, `pos` 0 to 100) and Handy CSV (`time,position` per line). The OpenAPI schema for `PointPosition` says maximum 50 while the docs say 0 to 100; trust the docs and verify on a device. Fw 4 device buffer is typically 3000 to 4000 points (as low as 300 with Bluetooth and Wi-Fi both on). Seeking outside the buffer costs one extra server-device round trip. For game sprite-style scripts, split them or use HSP.

Hosting API v2: `POST https://www.handyfeeling.com/api/hosting/v2/upload` returns a temporary download URL to pass as `url` (see `references/hosting-api-v2.yaml`).

## HSP (device-buffered stream)

1. `PUT /hsp/setup {stream_id?, notify?}` resets the session. Returns state including `max_points` (fixed for the session).
2. `PUT /hsp/add {points: [{t, x}], tail_point_stream_index, flush?, tail_point_threshold?}`, up to 100 points per call, `t` in ms, `x` 0 to 100. `tail_point_stream_index` is required. Adding beyond capacity drops the oldest points.
3. `PUT /hsp/play {start_time, server_time, playback_rate?, loop?, pause_on_starving?, add?}`.
4. Keep the buffer fed. Notifications over SSE: `hsp_threshold_reached` (add more points), `hsp_starving`, `hsp_looping`, `hsp_state_changed`. `PUT /hsp/threshold` sets the stream index that triggers the threshold event.
5. Also `/hsp/stop`, `/hsp/pause`, `/hsp/resume {pick_up}`, `/hsp/flush`, `/hsp/loop`, `/hsp/playbackrate`, `/hsp/pause/onstarving`, `/hsp/synctime`, `GET /hsp/state`.

`pause_on_starving` stops the device clock when the buffer runs dry so late data is never in the past.

## STREAM

`PUT /stream/setup {stream_ref, notify?}`, `/stream/play`, `/stream/stop`, `/stream/synctime`, `GET /stream/state`. Streams are created and filled through the separate Stream API (`https://www.handyfeeling.com/api/stream/v0/docs/`), append only, shareable across devices. No threshold handling on the client.

## HRPP and HVP

HRPP: `GET /hrpp/state`, `PUT /hrpp/start`, `/hrpp/stop`, `/hrpp/playbackrate`, `/hrpp/amplitude`, `GET /hrpp/patterns`, `PUT /hrpp/patterns/{slotNo}/activate`. Fw 4 only, plays patterns stored on the device.

HVP: `PUT /hvp/start`, `/hvp/stop`, `PUT/GET /hvp/state {amplitude: 0..1, frequency: 0..10000 Hz (LRA only), position?}`.

## SSE

`GET /sse?ck=<key>&apikey=<token>&events=a,b,c` (omit `events` for all). Use `EventSource`. Event types: device_status, device_error, device_connected, device_disconnected, device_clock_synchronized, error, button_event, mode_changed, hamp_state_changed, hdsp_state_changed, hsp_state_changed, hsp_looping, hsp_starving, hsp_threshold_reached, stroke_changed, ota_progress. Payloads: `EventTypes` in `references/examples/handy-rest-api-v3-client.js` and the `/sse` entry in the OpenAPI spec. Prefer SSE over polling `/info` or state endpoints.

## Building

- Start from `references/examples/handy-rest-api-v3-client.js`, a pure JS client covering every endpoint plus an HSP consumer that handles thresholds and starving. Copy and type it for TypeScript rather than rewriting from scratch.
- Never ship an Application Key to a browser. Mint client tokens on a server and pass `to=<connection key>` plus `origin`.
- Always send `X-Connection-Key`. Handle `fw_status === 2` and `connected === false` before offering controls.
- Use SSE for connection and state, `server_time` from `/servertime`, and `synctime` during playback.
- Run the official demos with `npm install && npm start` inside `references/examples/` (http-server on 127.0.0.1:8080).
- Older API versions (v1, v2) still exist for firmware 3 devices. v2 needs no auth. Use them only if the target device cannot be updated.
