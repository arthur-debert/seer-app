# Execution & Interaction Model

## Problem

Circe is an interactive image editor. The user adjusts parameters — drags sliders, tweaks curves, toggles adjustments — and expects to see results immediately. But per-pixel image processing is expensive: a complex pipeline on a large image takes 100ms–2s+ to evaluate. This creates a fundamental tension between responsiveness and computation.

The naive implementation (evaluate synchronously on every parameter change) freezes the UI for the duration of each evaluation. No mouse events, no slider feedback, no repaints. The user drags a slider and the application locks up. This is the worst possible experience — the user can't even tell whether the drag registered.

The key insight: **gaps between image updates are acceptable; a frozen UI is not.** A photographer dragging a slider doesn't need to see every intermediate value rendered — they need the slider to feel responsive and the image to catch up. A 200ms delay in the preview is fine. A 200ms freeze where the cursor stops moving is not.

---

## Three Axes

There are three complementary approaches to responsive editing under expensive computation:

1. **Algorithmic optimization** — make each evaluation faster (GPU acceleration, SIMD, better algorithms). Always valuable but has limits — some operations are inherently expensive.

2. **Caching and preview resolution** — avoid redundant work (per-adjustment caching, cache invalidation from changed adjustment downstream) and reduce work during interaction (evaluate at 1/4 resolution while dragging, full resolution on release).

3. **Perceived responsiveness** — keep the UI alive even when computation is slow. The user's input is never blocked, the interface always responds, and expensive work happens without freezing the main thread.

This spec addresses axis 3 (with notes on axis 2 for future work). Axis 1 is handled by the processing adjustments themselves.

---

## Design: Off-Main-Thread Evaluation

### Principle: The UI Thread Does No Image Processing

All WASM/pipeline evaluation runs in a **Web Worker**. The main thread never touches the EditGraph after initialization. This guarantees that even a 2-second evaluation cannot freeze the UI — mouse events, slider feedback, and repaints all continue uninterrupted.

The Worker owns the EditGraph instance, all WASM state, and the history system. The main thread communicates through message passing — it sends mutation requests and receives state updates and pixel data back.

### Principle: Latest-Wins, Not Queuing

When the user drags a slider, the system receives a rapid sequence of parameter updates. If each update queues behind the previous one, the pipeline evaluates every intermediate value — most of which the user has already moved past. The result is a growing backlog and a preview that lags further and further behind.

Instead, the scheduler uses **latest-wins** semantics: when a new request arrives while the Worker is busy evaluating a previous one, the new request _replaces_ (not queues behind) the pending request. Intermediate values are dropped. When the Worker finishes, it picks up the most recent request — which is the one closest to where the user's slider actually is.

```
User drags:        ──A──B──C──D──E──
                     │           │
Worker evaluates:    A ─────────→ then E
                     (B, C, D dropped — user already moved past them)
```

The user sees two updates (A and E) instead of five sequential evaluations. The preview is always as close to current as possible, without queuing stale work.

---

## Design: Request Coalescing

### Problem Within the Problem

Even with latest-wins scheduling, a slider drag at 60–120Hz+ generates one message per pointer event. Each `postMessage` has serialization cost, and the Worker starts evaluating immediately on receipt — potentially beginning a 500ms evaluation for a value the user will change 8ms later.

### Two Layers of Coalescing

The system batches rapid updates at two levels:

**Frame-rate batching (TypeScript, ~16ms window).** The scheduler buffers `update-params` actions within a single `requestAnimationFrame` tick. Multiple parameter changes within one frame are merged — same adjustment, latest value wins — and sent as a single message when the frame fires. This reduces postMessage frequency from pointer rate (~120Hz) to frame rate (~60Hz).

Only parameter updates coalesce. Structural actions (add adjustment, remove adjustment, toggle) flush the buffer and send immediately — the user expects instant feedback for discrete actions.

**Semantic coalescing (Rust, 30-second window).** Each message from the scheduler creates its own history group. During a slider drag, consecutive frames produce consecutive single-step groups. The history system automatically merges these: when closing a single-step `UpdateParams` group, it checks whether the previous completed group is also a single-step `UpdateParams` for the same adjustment within a 30-second window. If so, the groups merge — keeping the original "before" value and updating "after" to the latest.

The result: a 2-second slider drag (120+ input events) produces ~60 postMessages (after frame-rate batching) and **one** history entry (after semantic coalescing).

### Boundary Principle: Rust Decides, TypeScript Times

The TypeScript scheduler handles browser-timing concerns — rAF batching, Worker lifecycle, message serialization. It makes no semantic decisions about what constitutes a meaningful change.

The Rust history system handles semantic concerns — what counts as the same action, when to merge groups, how to label changes. It knows nothing about browser frames or Worker threads.

This split means the coalescing logic is testable in isolation on both sides, and neither side needs to understand the other's domain.

---

## Design: Direct Pixel Upload

The original rendering path encoded pipeline output to PNG, decoded it, then uploaded to the GPU — wasting 100–500ms per frame on a pointless round-trip through a compressed format.

The renderer accepts raw RGBA bytes and writes them directly to a GPU texture. No encoding, no decoding, no intermediate formats. The Worker transfers the pixel buffer (zero-copy via Transferable) and the renderer uploads it in one `writeTexture` call.

---

## Future: Preview Resolution

During active interaction (slider drag), evaluate at reduced resolution (e.g., 1/4 size) for fast feedback — a 4x speedup for most operations. Re-evaluate at full resolution when the user releases the slider.

This is axis 2 (caching/preview) complementing axis 3 (perceived responsiveness). Together they mean: the UI never freezes (Worker), the preview updates fast (reduced resolution), and the final result is sharp (full resolution on release).

---

## What This Does Not Change

- **Processing adjustments** — same API, same evaluation, same caching. They don't know they're running in a Worker.
- **History data model** — groups, steps, mutations, before/after state. The Worker wraps each perform message in a history group, but the data model is unchanged.
- **UI components** — AdjustmentList, ParamPanel, HistoryPanel receive the same state shape. They don't know about Workers or coalescing.
- **Segmentation** — still runs on the main thread (ONNX runtime). Moving it to a Worker is possible but orthogonal.
