# Mobile Operator Gesture Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved mobile first-hand alert to the existing operator screen, ready for a future realtime event but hidden in production until that integration exists.

**Architecture:** A lifecycle hook converts one binary gesture event into a short-lived view model, owns the object URL, countdown, feedback, and cleanup. A presentational overlay renders that view model with the existing design tokens. `OperatorBidPage` accepts an optional event prop and composes the hook and overlay without creating a mock or production event source.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, Vitest, React Testing Library, jsdom, Playwright.

**Spec:** `../tcc-back/docs/superpowers/specs/2026-09-29-gesture-recognition-design.md`

## Global Constraints

- This plan implements only the frontend operator-screen delivery; do not add camera capture, ONNX, HTTP endpoints, new Socket.IO events, or backend code.
- Production contains no demo query, fake snapshot, test button, or other preview event source.
- The alert remains hidden when `gestureEvent` is absent, which is the normal production state until the integration cycle.
- Display duration is derived from the server-shaped `expiresAt`; the approved event window is five seconds.
- Feedback is a 200-millisecond sound plus vibration pattern `[150, 75, 150]` when supported; unsupported or blocked APIs never block the visual alert.
- Use existing tokens only: background `#0b120f`, card `#121b17`, primary `#3fa47b`, border `#24312b`, foreground `#e9efeb`, and price `#d07e4f` only for money.
- Preserve all existing buyer search, bid validation, confirmation, authoritative refresh, and logout behavior.
- Verify, commit, and push this frontend delivery before starting recognition or API integration.

## Review Focus

- An already-expired event must create neither an object URL nor sound/vibration; Task 1 pins this with fake time.
- Re-rendering the same `eventId` must not replay feedback or allocate a second URL; Task 1 covers duplicate identity.
- Replacing or unmounting an alert must revoke each allocated object URL exactly once and clear timers; Task 1 covers both paths.
- Missing, throwing, or browser-blocked feedback APIs must leave the visual alert functional; Task 1 covers vibration and audio failures.
- The normal operator route must show no alert and retain the complete mobile bid flow; Task 2 covers absence in component tests and Task 3 reruns the existing 390 px Playwright journey.

---

## File Structure

- `src/operator/gesture-alert.ts`: event/view types, constants, browser feedback, and the lifecycle hook.
- `src/operator/GestureFirstHandAlert.tsx`: presentation-only mobile overlay using official tokens.
- `src/operator/OperatorBidPage.tsx`: optional event boundary and composition with the existing operator workflow.
- `tests/unit/gesture-alert.spec.tsx`: deterministic lifecycle, feedback, accessibility, and integration tests.
- `tests/unit/setup.ts`: DOM matcher and test cleanup setup.
- `vitest.config.ts`: jsdom, React transform, alias, and setup configuration.
- `package.json` / `package-lock.json`: unit-test script and test-only dependencies.
- `docs/superpowers/plans/2026-09-29-operator-gesture-alert.md`: this executable plan.

---

### Task 1: Gesture Alert Lifecycle and Feedback

**Files:**
- Create: `src/operator/gesture-alert.ts`
- Create: `tests/unit/gesture-alert.spec.tsx`
- Create: `tests/unit/setup.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Include: `docs/superpowers/plans/2026-09-29-operator-gesture-alert.md`

**Interfaces:**
- Produces: `GestureFirstHandEvent`, `ActiveGestureAlert`, `useGestureFirstHandAlert(event)`, `triggerGestureAlertFeedback()`, `GESTURE_ALERT_SOUND_MS`, and `GESTURE_ALERT_VIBRATION_PATTERN`.
- `GestureFirstHandEvent` fields: `eventId: string`, `capturedAt: string`, `expiresAt: string`, `snapshot: Blob`.
- `ActiveGestureAlert` fields: `eventId: string`, `capturedAt: string`, `expiresAt: string`, `snapshotUrl: string`, `remainingSeconds: number`.
- `useGestureFirstHandAlert(event: GestureFirstHandEvent | null): ActiveGestureAlert | null` is the sole owner of object URL allocation/revocation, countdown timing, duplicate suppression, and one-time feedback.

- [ ] **Step 1: Install and configure the unit-test runner**

Run:

```powershell
npm.cmd install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add `"test:unit": "vitest run"` to `package.json`. Create `vitest.config.ts` with the React plugin, `@` alias, `environment: 'jsdom'`, and `setupFiles: ['./tests/unit/setup.ts']`. The setup imports `@testing-library/jest-dom/vitest` and runs Testing Library cleanup after each test.

- [ ] **Step 2: Write failing lifecycle tests**

In `tests/unit/gesture-alert.spec.tsx`, create a small hook harness and tests with fake time that assert:

```ts
expect(screen.getByTestId('event-id')).toHaveTextContent('gesture-1');
expect(screen.getByTestId('remaining')).toHaveTextContent('5');
expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
expect(navigator.vibrate).toHaveBeenCalledWith([150, 75, 150]);
```

Advance time to expiry and assert the harness renders `inactive`, the allocated URL is revoked once, and no timer remains. Rerender with a newer event and assert old-URL cleanup. Rerender a new object with the same `eventId` and assert no second URL or feedback. Pass an already-expired event and assert no allocation or feedback.

- [ ] **Step 3: Write failing feedback-failure tests**

Stub absent and throwing `navigator.vibrate` and `AudioContext` implementations. Assert `triggerGestureAlertFeedback()` never throws. With a working audio mock, assert the oscillator is stopped at `currentTime + 0.2` and the context is closed after `ended`.

- [ ] **Step 4: Run the tests and verify RED**

Run:

```powershell
npm.cmd run test:unit -- tests/unit/gesture-alert.spec.tsx
```

Expected: FAIL because `@/operator/gesture-alert` does not exist.

- [ ] **Step 5: Implement the lifecycle module**

Create `src/operator/gesture-alert.ts` with the exact interfaces above. Calculate remaining seconds as `Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))`. Ignore invalid or expired timestamps. Allocate one object URL per new event ID, tick at 250 milliseconds, release resources at expiry/replacement/unmount, and suppress every repeated ID for the lifetime of the mounted hook.

`triggerGestureAlertFeedback()` requests the constant vibration pattern and creates a short oscillator/gain notification lasting exactly 200 milliseconds. Wrap each capability independently so a failure in one cannot prevent the other or the visual state.

- [ ] **Step 6: Run lifecycle tests and verify GREEN**

Run:

```powershell
npm.cmd run test:unit -- tests/unit/gesture-alert.spec.tsx
```

Expected: all lifecycle and feedback tests pass with no timer-leak warning.

- [ ] **Step 7: Verify Task 1 and commit**

Run:

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: all commands exit 0. Then commit only Task 1 files:

```powershell
git add package.json package-lock.json vitest.config.ts tests/unit/setup.ts tests/unit/gesture-alert.spec.tsx src/operator/gesture-alert.ts docs/superpowers/plans/2026-09-29-operator-gesture-alert.md
git commit -m "feat: add operator gesture alert lifecycle"
```

---

### Task 2: Mobile Overlay and Passive Operator Integration

**Files:**
- Create: `src/operator/GestureFirstHandAlert.tsx`
- Modify: `src/operator/OperatorBidPage.tsx`
- Modify: `tests/unit/gesture-alert.spec.tsx`

**Interfaces:**
- Consumes: `ActiveGestureAlert` and `useGestureFirstHandAlert()` from Task 1.
- Produces: `GestureFirstHandAlert({ alert }: { alert: ActiveGestureAlert })`.
- Extends: `OperatorBidPageProps` with `gestureEvent?: GestureFirstHandEvent | null`; `OperatorApp` deliberately omits the optional prop until the realtime integration cycle.

- [ ] **Step 1: Write failing overlay tests**

Render `GestureFirstHandAlert` with an `ActiveGestureAlert` fixture. Assert:

- `role="alert"` with accessible text `Primeira mão detectada`;
- image alt `Pessoa com a primeira mão levantada, destacada pela estação de gestos`;
- visible `5s`, `Imagem capturada agora`, and `Som e vibração quando disponíveis`;
- the alert root uses token utilities `border-primary`, `bg-card`, and `text-foreground` rather than literal colors;
- there is no dismiss or confirmation button.

Mock the existing API/socket modules, render `OperatorBidPage` once without `gestureEvent` and once with a future event. Assert the normal render has no gesture alert; the event render shows the alert while `Registrar lance presencial`, buyer search, and `Revisar lance` remain mounted behind it.

- [ ] **Step 2: Run overlay tests and verify RED**

Run:

```powershell
npm.cmd run test:unit -- tests/unit/gesture-alert.spec.tsx
```

Expected: FAIL because `GestureFirstHandAlert` and the optional page boundary do not exist.

- [ ] **Step 3: Implement the presentational overlay**

Create `src/operator/GestureFirstHandAlert.tsx`. Use a fixed mobile overlay with safe-area top spacing, `z-50`, `max-w-sm`, official token utilities, a primary pulse and countdown pill, a 16:9 annotated snapshot, and a compact footer. Use `motion-safe` for the pulse and preserve a readable static state under reduced motion.

The component has no timer, socket, Blob, or feedback side effects. It renders only the supplied `ActiveGestureAlert`.

- [ ] **Step 4: Integrate passively into `OperatorBidPage`**

Add optional `gestureEvent` to the page props, call `useGestureFirstHandAlert(gestureEvent ?? null)`, and conditionally render the overlay. Keep `OperatorApp` unchanged so production has no alert source yet. Add safe-area-aware page padding without changing existing control labels, validation, or actions.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
npm.cmd run test:unit -- tests/unit/gesture-alert.spec.tsx
```

Expected: lifecycle, overlay, normal-state, and passive-integration tests all pass.

- [ ] **Step 6: Run the existing mobile operator regression**

Run:

```powershell
npx.cmd playwright test tests/operator-bidding.spec.ts
```

Expected: all operator tests pass, including the 390 by 844 mobile journey and authoritative conflict cases. No gesture alert is visible because no event source exists.

- [ ] **Step 7: Verify Task 2 and commit**

Run:

```powershell
npm.cmd run test:unit
npm.cmd run check:tokens
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: every command exits 0. Then commit:

```powershell
git add src/operator/GestureFirstHandAlert.tsx src/operator/OperatorBidPage.tsx tests/unit/gesture-alert.spec.tsx
git commit -m "feat: add mobile first-hand alert"
```

---

### Task 3: Delivery Verification and Push

**Files:**
- Inspect only: all files changed by Tasks 1 and 2.

**Interfaces:**
- Consumes: both frontend commits.
- Produces: a clean, pushed `master` whose operator screen is ready for the future realtime event.

- [ ] **Step 1: Run the complete relevant verification suite**

Run:

```powershell
npm.cmd run test:unit
npx.cmd playwright test tests/operator-bidding.spec.ts
npm.cmd run check:tokens
npm.cmd run lint
npm.cmd run build
```

Expected: zero unit or Playwright failures, token check passes, ESLint exits 0, and Vite production build completes.

- [ ] **Step 2: Review the final diff and repository state**

Run:

```powershell
git diff origin/master...HEAD --check
git diff origin/master...HEAD --stat
git status --short --branch
```

Expected: only plan, test infrastructure, gesture alert, and operator page files differ; the working tree is clean; `master` is ahead of `origin/master` by the new commits.

- [ ] **Step 3: Push the frontend delivery**

Run:

```powershell
git push origin master
```

Expected: the remote `master` advances to the local frontend HEAD. Do not begin backend or recognition implementation until this push succeeds.
