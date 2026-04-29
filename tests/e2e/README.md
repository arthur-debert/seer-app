# E2E Tests

End-to-end tests for the Seer image editor using Playwright.

## Running

```bash
# Run all E2E tests (starts dev server automatically)
npx playwright test

# Run a specific test file
npx playwright test editor-crop

# Run with UI mode for debugging
npx playwright test --ui

# View the HTML report after a run
npx playwright show-report
```

## Architecture

```
tests/e2e/
├── lib/                          # Shared infrastructure
│   ├── timeouts.ts               # Tiered timeout constants (Poll.fast/action/pipeline/heavy)
│   ├── types.ts                  # TypeScript types for window globals
│   ├── helpers.ts                # requireBox(), getComputedStyles(), px()
│   └── diagnostics.ts            # Failure screenshots, state dumps, console logs
├── base-fixture.ts               # Console error capture + auto-diagnostics
├── editor-fixture.ts             # EditorHarness: state reads, actions, assertions
├── ui-interaction-fixture.ts     # UIHarness: slider drag, popup, radial menu
├── viewer-fixture.ts             # ViewerHarness: zoom, pan, canvas
├── mirror-fixture.ts             # MirrorHarness: dual-viewer sync
└── *.spec.ts                     # Test files
```

### Fixture hierarchy

```
@playwright/test
  └── base-fixture         (console errors, diagnostics)
       ├── editor-fixture   (EditorHarness + pipeline wait)
       │    └── ui-interaction-fixture  (UIHarness for widgets)
       ├── viewer-fixture   (ViewerHarness)
       └── mirror-fixture   (MirrorHarness)
```

Always import `test` and `expect` from the most specific fixture you need.

## Timeouts

Never use hardcoded timeout numbers. Import from `lib/timeouts.ts`:

| Constant        | Timeout | Use for                             |
| --------------- | ------- | ----------------------------------- |
| `Poll.fast`     | 5s      | DOM visibility, simple state checks |
| `Poll.action`   | 10s     | State mutations after user actions  |
| `Poll.pipeline` | 30s     | WASM pipeline init, image load      |
| `Poll.heavy`    | 60s     | GPU rendering, segmentation         |

All use progressive backoff intervals (100ms → 200ms → 500ms → 1s).

## Assertions

**Prefer state over DOM.** The app exposes `window.__editorState` and `window.__editorActions` in DEV mode. Use harness methods:

```typescript
// Good: assert on application state
await editor.expectAdjustmentExists('seer.tone-curve');
await editor.expectPipelineLength(2);

// Bad: assert on DOM structure
await expect(page.locator('.adjustment-card')).toHaveCount(2);
```

**Never use `waitForTimeout`.** Use Playwright's built-in retry mechanisms or `Poll.*` with `.toPass()`.

## Test Bridge

The app exposes `window.__testBridge` in DEV mode (`src/lib/test-bridge.ts`):

```typescript
window.__testBridge = {
  ready: { pipeline: boolean, wasm: boolean, viewer: boolean },
  events: TestEvent[],           // Last 200 events
  emit(type, detail?),           // App emits lifecycle events
  waitForEvent(type): Promise,   // Tests can await specific events
}
```

Events emitted: `wasm:loaded`, `viewer:rendered`, `pipeline:evaluated`.

## Debugging failures

On test failure, the diagnostics module automatically attaches:

- **failure-screenshot** — full-page screenshot
- **editor-state** — JSON dump of `__editorState`
- **console-logs** — all console output during the test
- **console-errors** — filtered error messages
- **page-url** — current page URL

View these in the Playwright HTML report (`npx playwright show-report`).

In CI, traces are uploaded as artifacts on failure (download from the GitHub Actions run).

## Writing new tests

1. Pick the right fixture (editor, viewer, mirror, or ui-interaction)
2. Use `test.step()` for multi-phase tests
3. Use `Poll.*` constants for all `.toPass()` calls
4. Use `requireBox()` instead of `(await locator.boundingBox())!`
5. Assert on state, not DOM, wherever possible
6. Add harness methods for reusable assertions rather than inline checks
