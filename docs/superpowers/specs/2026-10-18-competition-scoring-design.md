# Debug Master Competition scoring

Date: 2026-10-18
Status: Proposed design for review. Product code is unchanged.

## Outcome and agreed requirements

Debug Master uses the supplied Competition formula for every mode that awards points. Ordinary play calculates and saves results in the browser. Live play uses this project's Cloudflare Worker to validate gameplay, calculate points, and send authoritative scores and standings to player devices and the big screen. Neither flow connects to `codeventure-mvp-api`.

Three separate values describe a result: the stored best score for one level in a session, the total of those level scores for the session, and the session selected for a player's leaderboard entry. The implementation must not confuse a level's stored score with either an increment or a session total.

The user approves this star rubric. A completed level earns three stars with no wrong directional inputs, two stars with one wrong directional input, and one star with two or more wrong directional inputs. An incomplete or failed answer awards zero points. Mistakes accumulate for the entire level within the session, including retries and reloads.

Existing unscored Practice remains unscored and outside leaderboards. The project has no separate Main or Learning integrations to add. Combo can remain visible as gameplay feedback, but it does not multiply points. Dead Mode retains its five hearts and its generated-level progression.

## Current implementation

- `app/pages/index.vue` calculates `base × speed × combo` and adds points in `completeLevel()`.
- `beginLevel()` clears the level timer and per-attempt input counters. Both failed retries and manual restarts call it, which currently grants a fresh scoring timer.
- `app/storage/LocalStorageAdapter.ts` stores finished score rows in localStorage, uses Web Locks for mutations, and upserts rows by ID. It does not persist an active scoring session.
- `app/utils/ranking.ts` orders results by score and elapsed time. Challenge boards select one best run per player. Rows have `createdAt`, but no session `updatedAt`, scoring version, or per-level score ledger.
- `app/utils/live/protocol.ts` sends cumulative client scores through `progress`. `live-server/src/room-logic.ts` checks growth limits and then accepts those scores; it does not calculate them.
- Live reconnect restores cumulative score and cleared-level count. The saved browser Live session contains identity, not enough scoring or gameplay state to resume a partially completed level.
- A/B/C select different level packs. They do not currently define the numeric `difficulty` used by the Competition formula.

## Shared scoring contract

A pure TypeScript scoring module, imported by the browser and Worker, owns the formula, star evaluation, best-per-level aggregation, and session comparison helpers. It imports no Vue APIs, browser globals, or Worker runtime APIs. The protocol exposes a scoring version so incompatible clients cannot silently submit legacy totals.

For a correct completion, calculate:

```ts
const starMultiplier = 1 + 0.5 * (stars - 1);
const difficultyMultiplier = 1 + 0.25 * (difficulty - 1);
const score = Math.round(
  (1000 * starMultiplier * difficultyMultiplier)
  / Math.log10(timeSpentSeconds + 10),
);
```

Round each level score once before storing it. Wrong or incomplete answers return zero without entering the formula. The primitive supports a correct zero-star answer with multiplier 0.5, although the approved Debug Master rubric assigns successful completions one to three stars.

Validate inputs at the boundary: stars must be an integer from zero to three, difficulty must be a finite positive integer, and elapsed seconds must be finite and nonnegative. Missing difficulty defaults to one; malformed values are rejected rather than silently coerced. Zero elapsed time is valid for the primitive and has a denominator of one. Production timing derives elapsed time from actual start and submission timestamps.

Numeric difficulty comes from project configuration. A/B/C each default to difficulty one; their labels do not implicitly become multipliers 1/2/3. Legacy scored modes use the same default. Each session freezes difficulty, strategy, scoring version, level set, and time limit when it starts, so a configuration change does not alter an existing result.

## Level identity, timing, and stars

The level key combines the level-set identity with the level ID. Generated Dead Mode levels also include the run seed. A numeric ID by itself is not a globally unique level key.

Separate entering a level from resetting its board. First entry creates its scoring start timestamp and mistake counter. Retry, Run/restart, and reconnect reset or restore the board without replacing that timestamp or clearing mistakes. A new session receives new level records.

Start timing only when the level is ready for input, after a tutorial or countdown finishes. The next level starts after its transition finishes and becomes playable. The timer includes thinking, wrong attempts, retry animations, manual resets, and time spent away during a reload; it excludes the transition before the level becomes playable.

Capture the submission timestamp on the final accepted directional input, before the existing 80 ms animation callback. Use `(submittedAt - levelStartedAt) / 1000` without integer rounding. A wrong directional input increments the level mistake counter once and resets the attempt cursor. Ignored inputs while controls are disabled do not count as mistakes. Manual reset preserves the existing mistakes and start time and awards no points.

A correct completion stores the evaluated stars, elapsed seconds, and rounded score. The session ledger stores the maximum score for that level. It changes the total only by `max(0, candidateScore - previousBestScore)` and derives `levelsCompleted` from the number of distinct completed level keys. A repeated completion callback, response, or restore cannot increase the completed count or total twice.

The generic reducer can accept a later improved result for a completed level. The current scored gameplay continues to advance through levels automatically; this change does not introduce a new replay-level interface. The timer and mistake history for an existing level remain attached to its session record.

## Browser session storage and resume

Add a versioned session repository behind the existing storage adapter. A session contains a stable session ID and player ID, board identity, frozen scoring configuration, start and update timestamps, status, deadline for timed modes, level ledger, current level, mistakes, and sufficient attempt progress to reconstruct the board. Dead Mode also stores the seed, generated position, and remaining hearts. The displayed total comes from this session model.

Use the existing per-key Web Lock pattern to read, update, and write a session atomically. Each session carries a revision. A stale revision cannot overwrite a newer session from another tab; the caller reloads the canonical state before resuming input. Separate sessions can coexist without overwriting each other's checkpoints.

Persist meaningful gameplay events and level results, including mistakes and reset state, before treating them as durably recorded. Handle write failures with the existing visible save/retry pattern, preserving a stable pending operation ID. Do not continue accepting further scored inputs after a failed checkpoint until the pending operation succeeds or the player explicitly leaves the session. Retrying a write must not award points or remove hearts twice.

At a reload, offer the saved unfinished session as a resume choice instead of silently assigning it to a new booth player. Resume restores the ledger, original level start, mistakes, and board progress. Starting a new round creates a new session ID; it never reuses an unfinished session's scoring state.

Timed sessions use an absolute deadline, so reload, background throttling, and reconnect cannot extend the round. An expired saved session finalizes its last stored results and shows its summary. Untimed sessions retain their elapsed level time while the page is closed. Finished results are upserted by the stable session ID on every finish/save retry path.

Keep the existing score repository interface usable for leaderboard and history components by projecting completed versioned sessions into score rows. The session repository is the source of truth for new results; do not maintain two independently writable copies of new scores. Subscribe consumers to the source used by their view.

## Browser leaderboards and summaries

Add `scoringStrategy: 'BEST' | 'LATEST'` to project mode configuration, defaulting to `BEST`. Keep leaderboards separate by player identity, challenge/set, mode, time limit, scoring version, and numeric difficulty. Continue the project's existing calendar-day boundary in Asia/Bangkok. Only finalized sessions enter the ordinary leaderboard.

Select one session for each player before ordering the board:

| Strategy | Select a session | Order selected sessions |
| --- | --- | --- |
| BEST | Highest score, then most distinct completed levels, then earliest `updatedAt`. | Highest score, most completed levels, earliest `updatedAt`. |
| LATEST | Latest `updatedAt`, even when its score is lower or zero. | Highest score, most completed levels, latest `updatedAt`. |

Use a stable session ID as a final deterministic fallback when all specified values tie. Do not use elapsed round time or player join time as a scoring tie-breaker. Transport acknowledgements, duplicate submissions, reconnects, and viewing a result do not update the scoring timestamp. `updatedAt` advances for a newly processed gameplay submission or first session finalization, including a genuine wrong answer or non-improving attempt; retransmission of that operation does not advance it.

Preserve the project's rule that zero-score results have no displayed leaderboard position. Apply that rule after selecting the player's session: under LATEST, a latest zero-score session must not reveal an older positive run instead. The zero-score result remains available in history and in the player's latest result.

Best score always uses the best version-compatible session regardless of the configured selection strategy. The latest-score profile field uses the latest compatible session. Your Score uses the current finalized session. Compute summary highlighting and rank from the selected session, so a LATEST result does not accidentally show an older BEST result as its own rank.

## Live scoring and protocol

Retain this project's Worker, Durable Objects, room codes, host controls, WebSockets, countdown, and room storage. Replace cumulative score submissions with an ordered stream of small gameplay events. A player cannot provide authoritative stars, score, cleared-level count, difficulty, or ranking timestamps.

Each event identifies the protocol version, current round, session, level, stable monotonically increasing sequence number, event time, and action. Actions cover level-ready, direction, and manual board reset. Keep messages bounded by the existing message-size limit and batch only bounded groups of events; never coalesce distinct directional inputs into one replaceable cumulative message.

The Worker resolves the mode and level data from the same project data used by the browser. It computes expected directional sequences with the existing parser and interpreter. The parser is already framework-free apart from its composable name; move or wrap its pure entry point only as needed to make that dependency explicit. The server compares each directional input with the expected sequence, maintains the attempt cursor and mistake count, and calculates stars only when the valid sequence completes. Invalid level IDs, early level changes, wrong round/session IDs, queued players, and unsupported protocol versions cannot award points.

The player locally animates inputs for responsiveness. The Worker owns accepted level results, session total, completion count, and standings. Player HUD, results, score popup, and big screen consume accepted Worker values. A popup displays the actual positive delta from an accepted level receipt; duplicate receipts do not replay the increment. Combo feedback may be derived locally, but any public combo statistic is server-derived and has no effect on points.

### Event timestamps and deadlines

The browser records event timestamps in the server-adjusted clock domain using the connection's existing offset. The Worker validates that timestamps are finite, ordered, no earlier than round start, and no later than receipt time or round deadline. A level-ready timestamp cannot precede the preceding completion; the first cannot precede the end of countdown. The server retains accepted timestamps and never replaces them during a retry or reconnect.

Scoring uses the submitted event time, rather than network receipt latency, to keep the same elapsed-time definition as browser play. This remains client-reported event timing, as in the supplied handoff; server calculation does not imply a trusted device clock. Invalid future or backward events are rejected and trigger a resync rather than granting a shorter elapsed time.

The existing two-second delivery grace permits already-produced events to arrive after the deadline; it does not permit gameplay with event times after the deadline. End Early uses the shortened server deadline. No level can begin or complete before countdown finishes, and events for a prior round never affect the next round.

### Acknowledgements, reconnect, and reload

Persist the ordered player outbox in the browser until the Worker acknowledges its accepted sequence. On reconnect, send hello, obtain the private scoring snapshot, discard acknowledged events, and retransmit only the remaining events in order. Persist the server sequence and scoring state before acknowledging it. If acknowledgement is lost, retransmitting the same sequence has no scoring or timing effect.

The server rejects gaps with the next expected sequence rather than discarding missing inputs. Retransmitted conflicting actions cannot replace accepted actions. A client sends the same immutable event payload on every retry, including its original timestamp. Reconnect processing must complete the private state reconciliation before a fresh stream accepts input.

The private resume snapshot contains accepted sequence, active-level timing and mistakes, attempt cursor, per-level results needed for resume, and accepted total. Reconstruct the board deterministically from the canonical level and attempt cursor. Public room snapshots contain only the values needed for public displays. They must explicitly select public fields; adding private state to a stored player must not leak it through the current object-rest snapshot operation.

Remove the `Math.max(clientScore, serverScore)` restore rule and the legacy `maxLevelPoints(bestCombo)` trust boundary. A protocol mismatch shows a reload-required state. Migration preserves old room identity but marks an active legacy-score round incompatible with new clients; the host ends that round and starts a fresh versioned round. Never reinterpret an existing legacy cumulative score as a new level ledger.

### Live round ranking scope

The existing race screen shows the current room round. Each player has one session in that round, so BEST/LATEST do not select an earlier race round for its lane or podium. Freeze the configured strategy for the round and use its timestamp direction for current-round score/level ties. Use the shared session selector wherever there are multiple candidate sessions, such as browser historical boards.

This change does not add cross-round Live player-history rankings or carry points into a new race. Starting a new round creates fresh scoring ledgers and sequences; reconnect to the same round restores its canonical session. The server sends the current-round ordered player list, and clients do not independently re-sort it.

## Compatibility and presentation

Mark new results with a scoring version such as `competition-v1`. Legacy rows without that marker remain readable and manageable as history, but new boards, Best score, latest compatible score, and returning-player score comparisons exclude them. Do not delete old records or guess how to convert them to the new formula. Player identity reuse can still use existing profiles without importing their legacy scores into new results.

The score popup shows awarded stars and `+delta`, replacing the obsolete speed/combo multiplier breakdown. Time and combo displays keep their gameplay purposes. Configuration exposes difficulty and strategy through project data; this change does not require a new competition-admin interface.

Update both Thai and English product copy where it describes scoring. Document that ordinary scores are stored on the current browser/device and Live standings are authoritative for their room round. Update the existing handoff and Live protocol documentation after implementation.

## Verification and acceptance

Use deterministic fake timestamps for scoring and lifecycle tests. Verify the shared module directly and through browser-session and Worker entry points so matching formula helpers alone cannot mask different timing or aggregation behavior.

| Case: correct, 3 stars, difficulty 1 | Expected points |
| --- | ---: |
| 10 seconds | 1,537 |
| 30 seconds | 1,248 |
| 60 seconds | 1,084 |
| 120 seconds | 946 |

Additional required coverage:

1. Correct zero-star input uses multiplier 0.5; wrong input awards zero without the formula. Reject nonfinite, negative, and malformed scoring inputs.
2. Fractional seconds survive the complete browser and Worker paths. A wrong input followed by success includes all thinking/retry time and reduces stars according to the approved rubric.
3. Timer start occurs after countdown/tutorial and level readiness. Manual restart and reload preserve elapsed level time and mistakes. Capture the final-input time before animation delay.
4. A stored level score changing from 1,000 to 1,200 adds 200; a later 900 or failed answer preserves 1,200. Repeated completion/receipt and retries do not increase totals or completed-level counts twice.
5. Browser checkpoint/reload restores total, ledger, board progress, mistakes, hearts, and deadline. Save failure and retry preserve the same operation/session ID and show usable recovery. Stale-tab writes cannot overwrite a newer revision.
6. BEST/LATEST select the intended session, including score, level, timestamp ties, latest zero score, and deterministic final fallback. Best/latest/Your Score and summary highlighting use their intended sessions.
7. Legacy records remain readable and removable but never enter new scoring comparisons. New result saving remains idempotent across all exit, timeout, completion, and Dead Mode finish paths.
8. Live replay validates actual direction sequences. Duplicate/out-of-order events, lost acknowledgements, reconnect, and page reload do not duplicate points or mistakes. Worker restart restores the acknowledged state.
9. The Worker rejects forged cumulative totals, client-supplied stars, invalid levels, queued-player results, previous rounds, and incompatible protocols. Public snapshots do not contain private scoring state or device secrets.
10. Events produced before the deadline can arrive within the existing grace. Events after the deadline or beyond the grace do not score. End Early and countdown cancellation remain correct.
11. Player HUD, popup delta, current-round results, and big-screen ordering all match accepted server results. Changing difficulty or strategy takes effect only for the next session/round.
12. Practice stays unscored. Dead Mode retains its heart behavior. Keyboard, touch controls, automatic advancement, and reduced-motion behavior remain usable.

Run the app and Worker unit suites, Worker type checking, and the static production build. Update and run the existing Live smoke test against the new protocol. Exercise a browser session and a Live room with screenshots and console inspection, including one wrong attempt, a reload, and a disconnect/reconnect.

## Delivery boundary

Implementation follows written-design review and a concrete implementation plan. The code change includes shared scoring, local session persistence, ranking selection, Live validation/protocol, necessary UI copy, regression tests, and documentation. It does not deploy the Worker or publish the site as part of this design review.
