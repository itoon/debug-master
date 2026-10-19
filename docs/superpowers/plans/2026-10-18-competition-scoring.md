# Competition Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the agreed Competition scoring formula, session aggregation, and ranking rules to browser play and this project's Live server.

**Architecture:** A pure shared scoring/session model owns points, stars, level timing, and idempotent operations. Browser repositories persist that model locally; the Live Worker evaluates ordered gameplay events and sends canonical results to clients. Existing boards consume finalized session projections rather than independently writable score copies.

**Tech Stack:** TypeScript, Nuxt 4, Vue 3, localStorage with Web Locks, Cloudflare Workers/Durable Objects/WebSockets, Vitest, pnpm, Node 22 or later.

**Spec:** `docs/superpowers/specs/2026-10-18-competition-scoring-design.md` (approved 2026-10-18, amended to exclude all previous-formula compatibility).

## Global Constraints

- Ordinary play calculates and saves results in the browser. Live play uses this project's Cloudflare Worker. Neither flow connects to `codeventure-mvp-api`.
- Three stars require zero mistakes, two require one mistake, and one requires two or more mistakes. An incomplete answer awards zero points.
- Difficulty defaults to one. A/B/C labels do not implicitly set numeric difficulty. `scoringStrategy` defaults to `BEST`.
- Use fractional seconds and round each level score once. Retry, manual reset, reload, and reconnect do not clear the level's start timestamp or mistakes.
- Practice remains unscored and outside leaderboards. Dead Mode retains five hearts and its generated-level progression.
- Each session freezes difficulty, strategy, level set, and time limit. Browser boards retain their Asia/Bangkok calendar-day scope.
- There are no previous-formula scores to preserve. Add no score conversion, filtering, separate history boards, or previous-score/room migration.
- Add no external service, dependency, competition-admin interface, or deployment step. Preserve existing player identity, room identity, and mode settings.
- Prefix shell commands with `rtk` as required by the project instructions.

## Review Focus

1. A completion queued behind the last animation uses the final input timestamp and still scores when that input preceded the deadline; Task 4 tests both orders of timeout/completion callbacks.
2. A device clock offset changing on reconnect cannot rewrite queued event timestamps or create a shorter level; Task 6 tests immutable outbox events, and Task 5 rejects backward/future timestamps.
3. Two tabs resuming the same session cannot overwrite accepted progress; Task 2 tests a stale revision and Task 4 tests resynchronization before input resumes.
4. A latest zero-score session hides the player's older positive result under LATEST; Task 3 tests selection before eligibility filtering and ensures summary rank belongs to the selected session.
5. A server restart after accepting input but before delivering its acknowledgement cannot award twice or lose acknowledged state; Tasks 5 and 6 test persistence/ack ordering and replay after reconnect.

## File Responsibilities

| File or group | Responsibility |
| --- | --- |
| `app/types/competition.ts` | Shared configuration, session, level ledger, operation, receipt, and gameplay-checkpoint types. |
| `app/utils/competition/scoring.ts` | Formula, input validation, and the approved star rubric. |
| `app/utils/competition/session.ts` | Pure session transitions, stable operation IDs, revision changes, best-per-level aggregation, and timing. |
| `app/storage/CompetitionSessionRepository.ts` | Validated atomic local session persistence. |
| `app/storage/LocalStorageAdapter.ts`, `contracts.ts` | Session repository wiring and finalized score projections; existing player/mode repositories. |
| `app/utils/ranking.ts`, `app/data/home-config.ts`, existing board consumers | Frozen scoring configuration, BEST/LATEST selection, consistent summary/profile comparisons. |
| `app/composables/useCompetitionSession.ts` | Browser orchestration, pending writes, resume, and authoritative session state for the page. |
| `app/components/ResumeSessionDialog.vue`, `ScoringSaveDialog.vue` | Focus-managed, accessible recovery choices and checkpoint error/retry controls. |
| `app/pages/index.vue`, `app/types/debug-game.ts`, `app/i18n/messages.ts` | Gameplay integration, score popup stars/delta, final-input timing, and localized copy. |
| `live-server/src/scoring.ts`, `room-logic.ts`, `live-room.ts`, `validate.ts` | Server gameplay evaluation, session state, protocol validation, durable acknowledgements, public standings. |
| `app/utils/live/protocol.ts`, `outbox.ts`, `composables/useLiveRoom.ts` | Ordered event contract, durable client outbox, private canonical resume/results, transport integration. |
| `tests/competition/*`, `tests/live/*`, `live-server/test/*` | Contract tests, lifecycle tests, server and transport regression tests. |
| Existing Live smoke script and project docs | End-to-end protocol checks and operational guidance. |

## Shared Interface Decisions

Define shared domain types in `app/types/competition.ts` before implementing consumers. Keep `ScoringStrategy = 'BEST' | 'LATEST'` and `CompetitionConfig = { difficulty: number; scoringStrategy: ScoringStrategy }`. `CompetitionSession` contains immutable session/player/board metadata and config, `revision`, `status: 'active' | 'finished'`, timestamps in epoch milliseconds, optional absolute deadline, completed level ledger, active gameplay checkpoint, total score, and distinct completion count.

Each level record contains its unique key, first-ready timestamp, cumulative mistakes, attempt cursor, best stored score, and best-result stars/elapsed seconds. The checkpoint also covers active level index, combo statistics, total accepted inputs, and optional Dead Mode seed/hearts. Use JSON-compatible values so the same model survives localStorage and Durable Object storage.

`SessionOperation` is a discriminated union with stable `id`, `at` timestamp, and `expectedRevision`, covering enter-level, accepted correct input, wrong input, reset-attempt, correct completion, and finish. The operation supplies evidence or a validated candidate, never an independently writable cumulative total. `SessionReceipt` contains operation ID, new revision, candidate points, stored level points, positive delta, stars, session total, completion count, and canonical session. The reducer returns `{ session, receipt, changed }`; already-applied IDs are idempotent, and conflicting/stale operations are explicit errors.

Keep `Score` as a finalized display projection. Add required `updatedAt`, numeric `difficulty`, and `scoringStrategy` metadata. `Score.id` is the session ID. `createdAt` retains the session's start time; views use `updatedAt` for the specified selection/tie rules. A `ScorePopup` contains `{ levelId, points, stars }`, where `points` is the positive delta.

### Task 1: Shared scoring and session transitions

**Files:** Create `app/types/competition.ts`, `app/utils/competition/scoring.ts`, `app/utils/competition/session.ts`, `tests/competition/scoring.test.ts`, `tests/competition/session.test.ts`, and `tests/competition/fixtures.ts`.

**Interfaces:**

- Produce `calculateCompetitionScore(input: { correct: boolean; stars: number; difficulty?: number; timeSpentSeconds: number }): number` and `starsForMistakes(mistakes: number): 1 | 2 | 3`.
- Produce `createCompetitionSession(input: NewCompetitionSession): CompetitionSession` and `applySessionOperation(session: CompetitionSession, operation: SessionOperation): SessionTransition` using the shared types above. Store the level first-ready timestamp once; derive elapsed time from immutable submission timestamps.
- Produce `toScore(session: CompetitionSession): Score` for finished sessions, rejecting active sessions.

- [x] **Step 1: Write formula tests with exact acceptance values.**

```ts
it.each([[10, 1537], [30, 1248], [60, 1084], [120, 946]])(
  'awards %s-second reference points', (timeSpentSeconds, expected) => {
    expect(calculateCompetitionScore({ correct: true, stars: 3, difficulty: 1, timeSpentSeconds })).toBe(expected);
  },
);
expect(calculateCompetitionScore({ correct: true, stars: 0, timeSpentSeconds: 0 })).toBe(500);
expect(calculateCompetitionScore({ correct: false, stars: 3, timeSpentSeconds: 10 })).toBe(0);
expect([0, 1, 2, 9].map(starsForMistakes)).toEqual([3, 2, 1, 1]);
```

Add table-driven rejection assertions for NaN, Infinity, negative elapsed seconds, fractional/out-of-range stars, and zero/fractional difficulty. Assert that 10.25 seconds uses `Math.round(2000 / Math.log10(20.25))` without rounding elapsed seconds.

- [x] **Step 2: Write transition tests.** Use reusable typed fixtures and explicit timestamps. Assert that a wrong input at 4 seconds followed by a correct completion at 10.25 seconds has two stars and elapsed time 10.25. Reset must preserve the original ready time and mistake count. Assert ledger candidate sequence `1000 → 1200 → 900 → wrong` has deltas `[1000, 200, 0, 0]`, total 1200, and one distinct completed level. Repeating an operation ID must preserve score, revision, `updatedAt`, and completion count. Duplicate numeric IDs from different sets/seeds must use different keys. Assert frozen config, invalid backward operations, and finish idempotency.
- [x] **Step 3: Run** `rtk pnpm exec vitest run tests/competition/scoring.test.ts tests/competition/session.test.ts` **from `game/`; confirm failure because the new exports do not exist.**
- [x] **Step 4: Implement the three shared files and fixtures.** Keep the formula independent from the game's rubric, so correct zero-star formula coverage remains possible. Keep input validation and raw event evidence validation separate from accepting a validated level candidate in the session reducer.
- [x] **Step 5: Re-run the targeted tests and confirm all pass.**
- [x] **Step 6: Commit only Task 1 files** with message `feat(scoring): add competition formula and session ledger`.

### Task 2: Atomic local session storage

**Files:** Create `app/storage/CompetitionSessionRepository.ts` and `tests/competition/storage.test.ts`; modify `app/storage/contracts.ts`, `app/storage/LocalStorageAdapter.ts`, and `app/types/debug-game.ts`.

**Interfaces:**

- Consume `CompetitionSession`, `SessionOperation`, `SessionReceipt`, and shared transitions from Task 1.
- Produce `CompetitionSessionRepository` with `list(): CompetitionSession[]`, `get(id: string): CompetitionSession | undefined`, `create(session: CompetitionSession): Promise<void>`, `apply(id: string, operation: SessionOperation): Promise<SessionReceipt>`, `removeMany(ids: readonly string[]): Promise<void>`, and `subscribe(listener: () => void): () => void`.
- `createLocalRepositories()` returns `{ players, scores, modes, sessions }`. `scores.list/today/rank/remove/removeMany/subscribe` project finalized sessions and operate on their source records. Replace old finish-time `scores.save` callers during Task 4; do not retain a second independent score store.

- [x] **Step 1: Write storage tests** using an in-memory localStorage and serial Web Locks stub. Test `checkpoint_survives_new_repository_instance`, `retry_operation_does_not_double_award`, `stale_revision_cannot_overwrite`, `separate_sessions_survive_interleaved_writes`, `active_session_is_not_a_score_row`, `delete_updates_session_source`, `subscription_tracks_session_writes`, and `malformed_session_reports_load_error`. Their assertions must include restored total, original timestamp, mistakes, cursor, hearts, deadline, and revision. Force `setItem` to throw and assert no successful receipt is returned; retry must use the same operation ID.
- [x] **Step 2: Run** `rtk pnpm exec vitest run tests/competition/storage.test.ts` **and confirm the intended missing-repository failure.**
- [x] **Step 3: Implement repository validation and atomic read/transition/write under one existing adapter key lock.** Reuse the adapter's envelope and event conventions. Ensure same-operation replay is checked before stale revision rejection so a successfully persisted operation whose response was lost can be retried safely. Keep player/mode repositories operational and add no previous-score compatibility logic.
- [x] **Step 4: Run all Task 1 and Task 2 tests; confirm passing output.**
- [x] **Step 5: Commit only Task 2 files** with message `feat(storage): persist resumable competition sessions`.

### Task 3: BEST/LATEST boards and scoring configuration

**Files:** Modify `app/utils/ranking.ts`, `app/data/home-config.ts`, `app/components/HomeV2.vue`, `ModeDetailsPanel.vue`, `SessionPanel.vue`, `app/composables/useScoreBoard.ts`, and relevant board construction in `app/pages/index.vue`; create `tests/competition/ranking.test.ts`.

**Interfaces:**

- Consume the finalized `Score` projection from Task 2.
- Extend `RankingBoard` with numeric `difficulty` and `scoringStrategy`. Extend `ChallengeMode` with `difficulty` and `scoringStrategy`; defaults for A/B/C are `1` and `'BEST'`. Export `DEFAULT_COMPETITION_CONFIG` for scored modes without a ChallengeMode.
- Produce `selectPlayerSessions(scores: readonly Score[], strategy: ScoringStrategy): Score[]`, `compareCompetitionScores(a: Score, b: Score, strategy: ScoringStrategy): number`, `bestPlayerScore(...)`, and `latestPlayerScore(...)` with board/player arguments typed explicitly. `todayRanking` filters the board/day, selects sessions, excludes selected zero rows, sorts, and finally limits.

- [x] **Step 1: Write ranking fixtures** containing two players with tied scores and unequal levels, exact score/level ties with unequal update times, a latest lower run, a latest zero run, and exact ties resolved by ID. Assert BEST chooses more levels before earliest update; LATEST chooses newest even at zero; leaderboard tie timestamps run in opposite directions. Assert selection precedes limit and zero exclusion. Use Asia/Bangkok midnight fixtures and different numeric difficulties to prove board isolation.
- [x] **Step 2: Add rank/highlight assertions.** A player's unselected run cannot claim the selected session's rank. `bestPlayerScore` remains best under LATEST, the profile latest field returns its latest session, and Your Score remains the finished current session.
- [x] **Step 3: Run** `rtk pnpm exec vitest run tests/competition/ranking.test.ts` **and confirm the new rules fail against existing behavior.**
- [x] **Step 4: Implement shared comparison/selection functions and update all board constructors.** Replace `createdAt`/elapsed-time and score-improvement-only summary heuristics where they conflict with the selected-session rules. Use a single selected-session identity for highlight/rank.
- [x] **Step 5: Run the competition tests and the existing app test suite; confirm passing output.**
- [x] **Step 6: Commit Task 3 files** with message `feat(ranking): apply BEST and LATEST session selection`.

### Task 4: Browser gameplay, checkpoints, recovery, and scoring UI

**Files:** Create `app/composables/useCompetitionSession.ts`, `app/components/ResumeSessionDialog.vue`, `app/components/ScoringSaveDialog.vue`, and `tests/competition/controller.test.ts`; modify `app/pages/index.vue`, `app/types/debug-game.ts`, `app/i18n/messages.ts`, and `app/components/SessionPanel.vue`.

**Interfaces:**

- Consume repository/session/config/ranking interfaces from Tasks 1–3.
- Produce `useCompetitionSession(repository)` with refs `session`, `pendingOperation`, `saveError`, `busy` and methods `start(input)`, `resume(id)`, `apply(operation)`, `retry()`, and `finish(at)`. Input is blocked while a checkpoint is pending/failed. Make its transition orchestration testable without mounting the entire game page.
- Resume dialog emits `resume(sessionId)` or `startNew`; save dialog emits `retry` or `leave`. Use established dialog focus and keyboard patterns.

- [x] **Step 1: Write controller tests** for `wrong_then_retry_preserves_time_and_stars`, `reset_preserves_scoring_window`, `final_input_time_precedes_animation`, `completion_and_timeout_callback_orders_match`, `expired_resume_finalizes_stored_total`, `reload_does_not_extend_deadline`, `failed_write_blocks_next_input_and_retry_is_idempotent`, and `stale_tab_resyncs_before_next_input`. In fake time, a last accepted move at `deadline - 1` and its callback at `deadline + 79` must use the pre-deadline completion; a new move at `deadline + 1` must not score. A pending wrong input retry must remove only one heart.
- [x] **Step 2: Run** `rtk pnpm exec vitest run tests/competition/controller.test.ts` **and confirm the expected missing-controller failure.**
- [x] **Step 3: Implement the controller and integrate the page lifecycle.** Split first-entry scoring setup from per-attempt board reset. Persist current cursor, mistakes, combo/input statistics, and seed/hearts. Reconstruct board/interpreter by replaying canonical correct moves up to the saved cursor. Capture final input time immediately and freeze the result before visual delay. Derive round time from absolute deadline, preserving tutorial/countdown and transition boundaries.
- [x] **Step 4: Replace every finish/save path** (normal completion, timeout, exit, save retry, Dead Mode hearts exhausted) with the same stable session finalization. Ensure new sessions use a stable player identity even in the developer setup flow. On reload, offer resume/start-new; do not automatically assign the prior booth session. Show localized save failures and safe retry controls. Practice bypasses scoring persistence and keeps its existing summary.
- [x] **Step 5: Replace popup multiplier text with stars and positive delta** in Thai and English. Remove the old formula function and score-only state mutations; combo remains feedback. Update summary/profile values through the Task 3 helpers.
- [x] **Step 6: Run all app tests and** `rtk pnpm generate` **from `game/`; confirm tests pass and static output builds.**
- [x] **Step 7: Commit Task 4 files** with message `feat(game): use resumable competition scoring in browser play`.

### Task 5: Authoritative Live evaluation and durable acknowledgements

**Files:** Modify `app/utils/live/protocol.ts`, `live-server/src/room-logic.ts`, `live-room.ts`, `validate.ts`, and `live-server/tsconfig.json` if shared imports require it. Create `live-server/src/scoring.ts`, `live-server/test/scoring.test.ts`, and `live-server/test/scoring-persistence.test.ts`; update existing race/lobby/protocol/validation tests.

**Interfaces:**

- Consume the shared session model and actual A/B/C level sets plus the existing parser/interpreter. Move the parser's pure entry point to a utility only if needed; keep its existing public wrapper usable.
- Produce versioned `GameplayEventMsg = { type: 'gameplay'; protocolVersion: number; roundId: number; sessionId: string; sequence: number; levelId: number; at: number; action: 'ready' | 'direction' | 'reset'; direction?: Direction }`.
- Produce `LiveScoringState` containing canonical session, last accepted sequence/time, and attempt cursor. `applyGameplayEvent(room, pid, event, receivedAt): LiveEventResult` verifies gameplay and returns a private resume/receipt payload plus change status; it never trusts client totals or stars.
- Add private `scoring` server messages carrying canonical session, acknowledged sequence, receipt if present, or next expected sequence/error for resync. Keep room `state` public and explicitly serialize public fields. Freeze difficulty/strategy in round state.

- [x] **Step 1: Write Worker tests** that play the actual first level via ordered directional events at deterministic times. Assert 3-star reference score, then one/two wrong attempts yielding two/one stars and unchanged first-ready time. Assert duplicate sequence has no effect; gap requests the missing sequence; queued players, unknown levels, early transitions, wrong session/round, unsupported version, forged cumulative fields, invalid timestamps, and after-deadline inputs cannot award points. No wrong/reset event clears mistakes or timing.
- [x] **Step 2: Add persistence/privacy/ranking tests.** Spy on Durable Object storage and socket sends: the private accepted-sequence acknowledgement must follow a successful persistent write. Force that write to fail, retry the same event, then reconstruct from saved room state and assert points/sequence remain canonical. Check public snapshots contain no device pid, level ledger, pending events, or private session checkpoint. Check tie ordering uses frozen BEST/LATEST `updatedAt` direction and a new round resets ledgers/sequences without carrying scores.
- [x] **Step 3: Run** `rtk pnpm --dir live-server exec vitest run test/scoring.test.ts test/scoring-persistence.test.ts` **from `game/`; confirm the intended failure.**
- [x] **Step 4: Implement Worker event validation/evaluation and room integration.** Resolve expected moves from canonical project levels. Reject out-of-order/future times and require ready before directions. Apply wrong/reset/completion operations to shared session state. Accept pre-deadline events during the existing two-second delivery grace; reject events produced after a shortened End Early deadline. Persist accepted state before acknowledgement. Maintain existing host, queue, lane, alarm, heartbeat, and public-secret identity behavior.
- [x] **Step 5: Replace cumulative `progress` acceptance and old score caps.** Preserve no previous-score migration path. Explicitly allow harmless acknowledgement replay after a round ends, while rejecting new scoring events beyond the grace. Notify incompatible clients to reload.
- [x] **Step 6: Run Worker tests, app protocol tests, and** `rtk pnpm --dir live-server typecheck` **until passing.** Update the existing tests to exercise the new message contract, preserving unrelated room regression coverage.
- [x] **Step 7: Commit Task 5 files** with message `feat(live): validate gameplay and calculate competition scores on server`.

### Task 6: Live client replay, authoritative displays, and end-to-end verification

**Files:** Create `app/utils/live/outbox.ts` and `tests/live/outbox.test.ts`; modify `app/utils/live/socket.ts`, `session.ts`, `app/composables/useLiveRoom.ts`, `app/pages/index.vue`, `app/components/live/LivePlayerPanel.vue`, `LiveResults.vue`, `LiveBoard.vue`, and related views only where canonical fields require them. Update `tests/live/socket.test.ts`, `session.test.ts`, `protocol.test.ts`, `live-server/scripts/smoke.mjs`, `live-server/README.md`, `docs/HANDOFF.md`, and `docs/structure.md`.

**Interfaces:**

- Consume Task 5 `GameplayEventMsg` and private canonical scoring messages.
- Produce `LiveOutbox` with `enqueue(event): void`, `acknowledge(sequence): void`, `pending(): GameplayEventMsg[]`, and `clear(): void`. Scope persistence by room, round, player, and session. Persist immutable sequence/timestamp payloads before sending; acknowledgement trims only the accepted prefix. A persisted event retry never receives a new ID or timestamp.
- Extend `LiveRoom` with private canonical `scoring` state and `sendGameplay(event)` orchestration. Hello/private reconciliation precedes replay and new input. Keep distinct gameplay events out of the socket's replaceable cumulative coalescing path.

- [x] **Step 1: Write outbox/transport tests.** Assert ordered persistence and replay after a new outbox instance, prefix-only acknowledgement, immutable timestamps across clock-offset changes, no coalescing of distinct directions, wrong-round isolation, and acknowledgement-loss replay after server restart. If local outbox storage fails, no unpersisted scored event is silently sent. Assert reconnect obtains private state before replay and blocks new input until reconciliation.
- [x] **Step 2: Run** `rtk pnpm exec vitest run tests/live/outbox.test.ts tests/live/socket.test.ts` **and confirm new behavior fails.**
- [x] **Step 3: Implement outbox, private scoring handlers, and page integration.** Local animation may proceed optimistically after event persistence, but HUD score/completed count, popup delta, and final results use canonical server receipts only. On reload, reconstruct the accepted checkpoint and replay only the unacknowledged suffix before accepting new actions. Remove cumulative score sending and `Math.max(clientScore, serverScore)` restoration. Show usable pending/resync/reload-required states in both languages.
- [x] **Step 4: Update the Live smoke script** to join players, complete canonical levels through the new event protocol, and assert Worker-calculated score, ordered public standings, duplicate-message idempotency, reconnect, round rollover, and deadline/grace behavior. Assert current-round podium never pulls a player's prior-round best.
- [x] **Step 5: Run final automated verification from `game/`.** Run `rtk pnpm test`, `rtk pnpm --dir live-server test`, `rtk pnpm --dir live-server typecheck`, and `rtk pnpm generate`. Start the local Worker and run `rtk pnpm --dir live-server smoke` against it. Inspect failures before changing code and rerun checks justified by the fix.
- [x] **Step 6: Verify real browser flows.** Use the develop-web-game loop for browser play and a local Live room. Capture browser screenshots and inspect console errors. Exercise keyboard and touch directions, one/two mistakes, fractional completion timing, manual reset, reload/resume, checkpoint error/retry, disconnect/reconnect, current-round score agreement, timeout, and Practice/Dead Mode. Check narrow-screen dialogs and keyboard focus. Retain screenshot evidence and report any unverified environment-dependent behavior explicitly.
- [x] **Step 7: Update operational documentation** with formula, stars, difficulty/strategy defaults, browser persistence/resume, authoritative Live behavior, and coordinated client/Worker protocol rollout. Run `rtk git diff --check`, review the final diff against the acceptance list, and commit Task 6 with message `feat(live): resume ordered scoring events and display canonical results`.

## Self-Review

The six tasks cover every section of the approved spec. Task 1 owns formula/aggregation/timing primitives; Task 2 owns persistence and revisions; Task 3 owns selection and presentation identity; Task 4 owns browser lifecycle and UI; Task 5 owns server evaluation and durable receipts; Task 6 owns reconnect transport, final displays, and end-to-end validation. Every Review Focus item has an explicit owning test step.

All cross-task contracts originate in Task 1 shared types, Task 2 repository APIs, Task 3 ranking helpers, or Task 5 protocol messages. No compatibility work for previous-formula scores is included. Existing player/room identity behavior stays separate from this scoring-data decision.

## Execution Review

The plan requires user review before implementation. Recommended execution is Native: one implementer works through these dependent interfaces in this chat and requests a whole-change review after verification. Subagent-driven execution remains an alternative if the user prefers separate implementation/review cycles per task.

## Completion record

Implementation and reviews are complete on 2026-10-19 at product commit `00db31e`. See [the delivery report](../reports/2026-10-19-competition-scoring.md) for verification, evidence limits, and execution decisions, including the Thai-only dictionary ruling. No push, merge, or deployment is included.
