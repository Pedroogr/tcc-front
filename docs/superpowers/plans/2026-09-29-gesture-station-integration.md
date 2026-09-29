# Gesture Station Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run real YOLO11 pose inference on the filming team's computer, relay one annotated first-hand snapshot through the existing API, and show it on the mobile operator screen.

**Architecture:** A dedicated `/gesture-station/:auctionId` route owns camera and worker lifecycles. A worker runs the fixed-shape YOLO11s pose ONNX model with WebGPU and a WASM fallback, returning normalized poses to pure tracking and round-state code; the page captures and submits only the selected annotated JPEG. The existing operator socket receives the ephemeral binary payload and feeds the already-shipped alert lifecycle.

**Tech Stack:** React 19, TypeScript 6, Vite 8, ONNX Runtime Web 1.30, Web Workers, MediaDevices, Canvas, Socket.IO, Vitest, Testing Library, Playwright

**Spec:** `../tcc-back/docs/superpowers/specs/2026-09-29-gesture-recognition-design.md`

## Global Constraints

- Continuous camera frames never leave the station; only one annotated JPEG is submitted per accepted round.
- Use the existing `yolo11s-pose.pt`, exported as fixed `1x3x1280x1280` ONNX input with raw `1x56x33600` output.
- Run model loading and inference in a dedicated worker: WebGPU first, WebAssembly fallback.
- Preserve the PoC thresholds exactly: person confidence `0.25`, keypoint confidence `0.35`, raise margin `15` model pixels, minimum box `45x90` model pixels, and the same head/shoulder/hip validity rules.
- Confirm a raised hand only after at least three consecutive samples spanning at least 250 ms.
- Keep the winner fixed for five seconds and re-arm only after 500 continuous ms with no valid raised hand.
- Pause event emission after two consecutive ten-second windows below 5 FPS; resume after one complete healthy window.
- Produce JPEG quality `0.72`, at most `960x540` and `256 KiB`, and never queue a failed/offline event.
- Use auction-house authentication on the station and the operator access token only on `/operator`.
- Do not identify a buyer, create a bid, persist a track/event, or add fake production controls.
- Use only existing design tokens; `--price` remains exclusive to money.

## Review Focus

- A late worker response after stop/device change must not revive detection or submit an event (Task 5 lifecycle tests).
- A person crossing another track must not allow a sustained raised hand to generate a second winner (Task 2 matching/re-arm tests).
- A failed or oversized canvas encoding must not send malformed multipart data (Task 4 encoding tests).
- Socket.IO binary may arrive as `ArrayBuffer`, typed-array view, or Node-style `{ type, data }`; all valid forms must become the exact JPEG bytes (Task 6 payload tests).
- Direct navigation by a buyer, unauthenticated actor, or non-owner must not start a camera/model download (Task 5 authorization tests).

---

### Task 1: Reproducible Model and Runtime Assets

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `public/models/yolo11s-pose.onnx`
- Create: `docs/gesture-model.md`

**Interfaces:**
- Produces: local model URL `/models/yolo11s-pose.onnx`, input name `images`, output name `output0`, input shape `[1,3,1280,1280]`, output shape `[1,56,33600]`.

- [ ] **Step 1: Install the pinned browser runtime**

Run: `npm install onnxruntime-web@1.30.0`

Expected: dependency and lockfile record `onnxruntime-web` 1.30.x.

- [ ] **Step 2: Add the validated ONNX artifact**

Copy the model exported with `ultralytics/ultralytics:8.4.165-python-export`, `imgsz=1280`, `dynamic=False`, `simplify=True`, `opset=17` into `public/models/yolo11s-pose.onnx`.

Expected: approximately 38.9 MB and the fixed interface above.

- [ ] **Step 3: Record provenance and reproduction**

Document source checkpoint, container tag and digest, exact export command, model license metadata, names/shapes, file size and SHA-256 in `docs/gesture-model.md`.

- [ ] **Step 4: Verify dependency and production packaging**

Run: `npm run build`

Expected: PASS and `dist/models/yolo11s-pose.onnx` exists.

- [ ] **Step 5: Commit**

Commit: `build: add browser pose inference model`

### Task 2: Pose Rules, YOLO Postprocessing, and Round Tracking

**Files:**
- Create: `src/gesture/pose-types.ts`
- Create: `src/gesture/pose-rules.ts`
- Create: `src/gesture/yolo-pose.ts`
- Create: `src/gesture/gesture-round-tracker.ts`
- Create: `tests/unit/pose-rules.spec.ts`
- Create: `tests/unit/yolo-pose.spec.ts`
- Create: `tests/unit/gesture-round-tracker.spec.ts`

**Interfaces:**
- Produces: `PoseKeypoint`, `NormalizedBox`, `PersonPose`, `isValidPerson(pose)`, `getRaisedHandSide(pose)`, `decodeYoloPose(output, sourceSize, letterbox)`, and `GestureRoundTracker.update(poses, sampledAtMs)` returning a fixed `RoundSelection | null`.
- Produces: named values for the PoC and temporal thresholds.

- [ ] **Step 1: Write failing PoC-rule tests**

Cover exact confidence/box thresholds, each accepted body-shape branch, wrist above shoulder by 15 pixels, optional elbow no more than 80 pixels below shoulder, and left/right/both results.

Run: `npm run test:unit -- tests/unit/pose-rules.spec.ts`

Expected: FAIL because the gesture modules do not exist.

- [ ] **Step 2: Implement pose types and PoC rules**

Keep model-space dimensions on `PersonPose` for pixel-based PoC checks while also exposing normalized boxes/keypoints to consumers.

Run: `npm run test:unit -- tests/unit/pose-rules.spec.ts`

Expected: PASS.

- [ ] **Step 3: Write failing YOLO output tests**

Build small synthetic channel-major tensors and assert confidence filtering, XYWH-to-box conversion, letterbox reversal, clipping, keypoint decoding, class-agnostic IoU NMS, and rejection of unexpected shape/data length.

Run: `npm run test:unit -- tests/unit/yolo-pose.spec.ts`

Expected: FAIL because `decodeYoloPose` does not exist.

- [ ] **Step 4: Implement raw YOLO11 pose decoding**

Implement `decodeYoloPose(output: Float32Array, candidateCount: number, source: FrameSize, letterbox: LetterboxTransform): PersonPose[]` for 56 channels and use confidence `0.25`, IoU `0.45`, maximum 100 retained people.

Run: `npm run test:unit -- tests/unit/yolo-pose.spec.ts`

Expected: PASS.

- [ ] **Step 5: Write failing round-state tests**

Cover three samples under 250 ms not confirming; transient raise reset; earliest rising timestamp winning; simultaneous tie determinism; five-second fixation; a still-raised hand not retriggering; 500 ms clear re-arm; temporary track loss/forget after 3 s; and IoU/centroid matching across movement/crossing.

Run: `npm run test:unit -- tests/unit/gesture-round-tracker.spec.ts`

Expected: FAIL because `GestureRoundTracker` does not exist.

- [ ] **Step 6: Implement track matching and round state**

Use greedy highest-IoU matching above `0.30`, then nearest normalized centroid within `0.15`; never expose track IDs outside station memory. A confirmed candidate keeps the first raised sample's monotonic timestamp.

Run: `npm run test:unit -- tests/unit/gesture-round-tracker.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `feat: track first raised hand rounds`

### Task 3: Worker-Based ONNX Pose Estimator and Throughput Policy

**Files:**
- Create: `src/gesture/pose-estimator.ts`
- Create: `src/gesture/pose-worker.ts`
- Create: `src/gesture/throughput-monitor.ts`
- Create: `tests/unit/pose-estimator.spec.ts`
- Create: `tests/unit/throughput-monitor.spec.ts`

**Interfaces:**
- Consumes: Task 1 model contract and Task 2 `decodeYoloPose`.
- Produces: `PoseEstimator.start()`, `PoseEstimator.detect(bitmap, sampledAtMs)`, `PoseEstimator.dispose()`, `PoseWorkerResponse`, backend mode `'webgpu' | 'wasm'`, and `ThroughputMonitor.record(timestampMs)`.

- [ ] **Step 1: Write failing throughput-window tests**

Assert two complete sub-5-FPS ten-second windows pause emission, partial windows do not decide, and one complete window at or above 5 FPS resumes.

Run: `npm run test:unit -- tests/unit/throughput-monitor.spec.ts`

Expected: FAIL because the monitor does not exist.

- [ ] **Step 2: Implement throughput policy**

Use monotonic timestamps and expose `{ fps, reliable, completedWindow }` without timers.

Run: `npm run test:unit -- tests/unit/throughput-monitor.spec.ts`

Expected: PASS.

- [ ] **Step 3: Write failing estimator protocol tests**

Mock `Worker` and assert initialization result, one in-flight bitmap, transferable ownership, correlated detection responses, initialization errors, runtime errors, and termination rejecting pending work without leaks.

Run: `npm run test:unit -- tests/unit/pose-estimator.spec.ts`

Expected: FAIL because the estimator does not exist.

- [ ] **Step 4: Implement the worker and estimator adapter**

Inside the worker, letterbox an `ImageBitmap` to a reusable `OffscreenCanvas`, create CHW RGB floats divided by 255, then run input `images` and decode `output0`. Try `executionProviders: ['webgpu']`; on initialization failure create a fresh session with `['wasm']`, reporting the chosen mode. Close every bitmap in `finally`.

Run: `npm run test:unit -- tests/unit/pose-estimator.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: run pose inference in browser worker`

### Task 4: Annotated Snapshot and Relay Client

**Files:**
- Create: `src/gesture/gesture-snapshot.ts`
- Create: `src/api/gestureApi.ts`
- Create: `tests/unit/gesture-snapshot.spec.ts`
- Create: `tests/unit/gesture-api.spec.ts`

**Interfaces:**
- Consumes: Task 2 `NormalizedBox`.
- Produces: `createGestureSnapshot(video, box): Promise<Blob>` and `submitGestureEvent(auctionId, event): Promise<{ eventId: string; expiresAt: string }>`.

- [ ] **Step 1: Write failing snapshot tests**

Mock canvas encoding and assert aspect-preserving maximum `960x540`, official primary-colored box/label, JPEG quality `0.72`, fallback downscaling when the blob exceeds 256 KiB, and a stable error when encoding returns null or cannot fit.

Run: `npm run test:unit -- tests/unit/gesture-snapshot.spec.ts`

Expected: FAIL because snapshot creation does not exist.

- [ ] **Step 2: Implement bounded annotated JPEG creation**

Draw the selected video frame, box, and `PRIMEIRA MÃO` label; retry with smaller dimensions/quality only to meet the hard byte limit and never change MIME type.

Run: `npm run test:unit -- tests/unit/gesture-snapshot.spec.ts`

Expected: PASS.

- [ ] **Step 3: Write failing relay-client tests**

Assert multipart fields `eventId`, `capturedAt`, normalized `personBox`, `snapshot`; authentication remains delegated to `apiRequest`; and abort/network failures are propagated without retry.

Run: `npm run test:unit -- tests/unit/gesture-api.spec.ts`

Expected: FAIL because the API client does not exist.

- [ ] **Step 4: Implement the relay client**

Post to `/auctions/:auctionId/gesture-events` and accept the backend's `202` JSON response; no queue or retry layer.

Run: `npm run test:unit -- tests/unit/gesture-api.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: create and relay gesture snapshots`

### Task 5: Authenticated Gesture Station Screen

**Files:**
- Create: `src/gesture/GestureStationApp.tsx`
- Create: `src/gesture/use-gesture-station.ts`
- Modify: `src/main.tsx`
- Modify: `src/pages/AuctionRoomPage.tsx`
- Create: `tests/unit/gesture-station.spec.tsx`
- Create: `tests/gesture-station.spec.ts`

**Interfaces:**
- Consumes: Tasks 2-4 tracker, estimator, monitor, snapshot, and API client.
- Produces: `/gesture-station/:auctionId` and an owned-auction management action that navigates to it in the same authenticated tab.

- [ ] **Step 1: Write failing station lifecycle tests**

Assert actor/ownership validation happens before camera/model creation; enumerate/select camera; start/stop/device-change closes tracks and terminates workers; one inference at a time; late responses ignored by generation; selected round submits once only while online/reliable; errors offer retry; and unload cleans resources.

Run: `npm run test:unit -- tests/unit/gesture-station.spec.tsx`

Expected: FAIL because the screen/hook do not exist.

- [ ] **Step 2: Implement station orchestration and UI**

Show local video with detection overlay, auction name, camera select, start/stop, backend mode, FPS, connectivity and delivery state. Keep detection running during network loss but suppress submission; show WebGPU/WASM and unreliable-throughput explanations in Portuguese.

Run: `npm run test:unit -- tests/unit/gesture-station.spec.tsx`

Expected: PASS.

- [ ] **Step 3: Add route and management entry point**

Parse and decode the auction ID in `main.tsx`; render the station outside the regular `App` tree. Add `Abrir estação de gestos` only when `canManage && auction`, navigating in the same tab so the existing auction-house `sessionStorage` remains available.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Write and run browser lifecycle coverage**

Mock MediaDevices, Worker, canvas encoding and the HTTP endpoint. Assert unauthorized direct navigation never requests the camera, valid ownership reaches ready/start/stop, camera changes stop the old track, and the production screen contains no demo event control.

Run: `npx playwright test tests/gesture-station.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add dedicated gesture station`

### Task 6: Realtime Operator Integration

**Files:**
- Modify: `src/api/socket.ts`
- Modify: `src/operator/OperatorBidPage.tsx`
- Modify: `tests/unit/gesture-alert.spec.tsx`
- Modify: `tests/operator-bidding.spec.ts`

**Interfaces:**
- Consumes: backend `gesture:first-hand-detected` payload and existing `GestureFirstHandEvent` lifecycle.
- Produces: `GestureFirstHandDetectedPayload` plus `gesturePayloadToEvent(payload)` binary normalization.

- [ ] **Step 1: Write failing binary payload tests**

Assert exact JPEG bytes for `ArrayBuffer`, `Uint8Array` with non-zero offset, and `{ type: 'Buffer', data: number[] }`; reject wrong MIME, invalid binary, wrong auction and expired events; newer valid events replace the alert.

Run: `npm run test:unit -- tests/unit/gesture-alert.spec.tsx`

Expected: FAIL because the socket event is not subscribed and no binary converter exists.

- [ ] **Step 2: Implement typed event conversion and subscription**

Subscribe on the existing operator socket before cleanup, filter by current auction, convert a defensive byte copy to `Blob`, and store the realtime event in `OperatorBidPage`. Keep the optional prop as a test seam, with an explicit prop taking precedence when supplied.

Run: `npm run test:unit -- tests/unit/gesture-alert.spec.tsx`

Expected: PASS.

- [ ] **Step 3: Add mobile Socket.IO browser coverage**

Extend the websocket route harness to send Socket.IO binary attachment frames, assert the semantic alert/image/countdown on a `390x844` viewport, verify wrong-auction and duplicate events are ignored, and confirm bidding remains usable after expiry.

Run: `npx playwright test tests/operator-bidding.spec.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Commit: `feat: deliver gesture alerts to operators`

### Task 7: Whole-Feature Verification and Handoff

**Files:**
- Modify only if verification exposes a tested defect.

**Interfaces:**
- Consumes: all earlier tasks and the already-pushed backend relay at `f72701e`.
- Produces: a verified frontend branch ready to fast-forward and push.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run test:unit && npm run check:tokens && npm run lint && npm run build && npm run test:e2e`

Expected: all tests pass; only the established Vite chunk-size warning may remain.

- [ ] **Step 2: Verify real API relay**

With the backend test stack running, authenticate an auction house and operator for the same auction, submit one generated JPEG through the station client contract, and confirm the operator Socket.IO client receives the exact binary payload with a five-second server expiry. Record the command/output in the execution ledger; do not require physical camera/GPU in CI.

- [ ] **Step 3: Audit production dependencies**

Run: `npm audit --omit=dev`

Expected: record any remaining production finding before handoff.

- [ ] **Step 4: Review the entire branch against the spec**

Inspect from the `master` merge base, specifically the five Review Focus cases and privacy/non-goals. Fix Critical/Important findings with a failing test first.

- [ ] **Step 5: Integrate and push**

Fast-forward local `master`, re-run the final verification there, and push `origin/master` as explicitly authorized by the user.

