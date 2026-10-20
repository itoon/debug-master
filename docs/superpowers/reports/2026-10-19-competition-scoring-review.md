# Final whole-change review — Competition scoring

Reviewed range: `a2f8f5f82c4986cf0c609524770e7c922446eb35..3d596c6760740823645f4ea9303dee915f605867`.

Review date: 2026-10-19. Read-only review of the prepared `review-a2f8f5f..3d596c6.diff`, inspected in domain/storage, browser lifecycle/presentation, Live transport, Worker authority/persistence, and verification/documentation passes. Read the approved design, implementation plan, and execution ledger. Current source was consulted to trace surrounding control flow and verify line references. No product, index, branch, or HEAD changes were made; this report is the only reviewer-written file. The controller's separate uncommitted delivery report was excluded from the code review scope.

## Strengths

- The browser and Worker use the same framework-free formula and session reducer. Fractional elapsed seconds, the approved 3/2/1-star rubric, maximum-per-level deltas, distinct completion counts, and idempotent replay have consistent representations across the boundaries.
- Ordinary gameplay captures the final accepted input before the animation and queues completion before finish. The persistence queue preserves immutable failed operations, stale revisions discard old board evidence, and explicit departure invalidates asynchronous continuations. Resume rebuilds the cursor and preserves the original time, mistakes, deadline, seed, and hearts.
- Finalized browser score rows are projections of the session repository. BEST/LATEST selection precedes zero exclusion and limiting; difficulty is board identity while strategy is selection policy. Summary rank/highlight uses the selected session ID, and profile best/latest have separate selectors.
- Live accepts directional evidence rather than client totals. The Worker resolves actual project programs, validates sequence/level/time/round/session, and persists an isolated candidate before acknowledgement and publication. Public snapshots explicitly whitelist public fields.
- The established Live stream persists and pipelines inputs without waiting for every acknowledgement. Recovery gates new inputs until the canonical prefix and pending suffix reconcile; partial acknowledgements do not rewind the local board. Newer private round snapshots are buffered until public round state catches up, and stale private rounds are ignored.
- The bounded 64-event replay window retains the sequence high-water mark and complete scoring ledger. Old accepted events cannot score again, recent conflicting duplicates are rejected, and Worker-only operation-history compaction addresses the measured room-size issue without changing browser operation semantics.

## Issues

### Critical — must fix

None found.

### Important — should fix

None found in the reviewed configuration and required flows.

### Minor — non-blocking

1. **Use the shared project defaults when creating non-challenge sessions.**
   - File: `app/pages/index.vue:754`; related board construction at `app/pages/index.vue:609` and `app/pages/index.vue:610`.
   - Session creation falls back to literal `1` and `'BEST'`, while non-challenge boards read `DEFAULT_COMPETITION_CONFIG`. The plan explicitly exports that configuration for modes without a `ChallengeMode`.
   - Concrete trigger: enable the existing developer setup (`homeConfig.enabled = false`) and change the exported default difficulty to 2 or strategy to LATEST. Campaign/Timer/Ranking/Dead sessions still freeze 1/BEST, while the pre-run board uses the changed values. A changed difficulty can therefore hide those new sessions from that configured board; the session also uses the wrong configured scoring multiplier/policy.
   - Current defaults are 1/BEST, and the shipped Home challenge paths supply their mode configuration, so this does not affect the current shipped behavior. It is a small configuration-consistency issue rather than a release blocker.
   - Suggested fix: use `DEFAULT_COMPETITION_CONFIG.difficulty` and `.scoringStrategy` for the two fallback expressions, matching board construction.

The existing hint-ring CSS/PostCSS warning is a previously recorded baseline issue, not a new scoring finding.

## Plan alignment and adjudicated decisions

All six planned responsibilities are present. The earlier review fixes are reflected in the final system: strategy no longer partitions historical board candidates, Live storage is bounded, normal play is pipelined, private-before-public rollover is handled, and Live reset is disabled during the final-input animation as well as guarded in its handler. The latter uses `canControl` consistently at `app/pages/index.vue:1173` and in the reset button.

The Thai-only product dictionary follows the explicit ledger ruling. The shared reducer's validated-candidate interface remains internal; the Live protocol does not expose it. Live session state remains active during result delivery grace as documented, while current room `endAt` enforces shortened End Early deadlines. Ordinary storage and Live authority stay separate; no external scoring API, dependency, deployment, old-score conversion, or previous-formula history path was introduced in this range.

## Verification evidence and limits

Reviewed the tests for controller sequencing, persistence failure/retry, stale revisions, ranking, Live outbox/recovery, actual Worker move evaluation, storage-before-ack ordering, restart, grace, and bounded-history capacity. In particular, the persistence tests delay storage while concurrent messages arrive and validate timestamps against captured socket arrival, not delayed handler execution. The capacity/restart tests retain timing and mistakes through compaction and enforce a conservative persisted-size guard.

The controller reports fresh app tests **170 passed**, Worker tests **82 passed**, and Worker typecheck passed. The exact two-line final reset guard has focused tests and browser RED/GREEN evidence in `task-6-report.md`; the controller additionally confirmed static generation on exact HEAD with **14 routes**, exit 0, and only the recorded existing CSS warning. Earlier generated-browser evidence covers ordinary resume/mistakes/quota recovery, Practice/seeded Dead, and Live delayed acknowledgement/offline/reload/round rollover. These completed suites were not redundantly rerun by this reviewer.

A full Vue typecheck is not available with the baseline installed dependencies. Real-phone/LAN and deployed client/Worker rollout behavior have not been verified. Those are explicit evidence limits, not claims of test coverage.

## Recommendations

Apply or explicitly defer the small non-challenge default consistency fix. Preserve the coordinated client/Worker protocol rollout and real-device rehearsal notes already in the handoff; this review does not authorize or perform deployment.

## Declined to judge

- Previous-formula data conversion, filtering, or room-score migration: the user explicitly excluded these because there are no old scores.
- A new English locale system: the explicit Thai-only dictionary ruling supersedes the generic bilingual wording for this implementation.
- Cross-round Live historical player rankings: the approved race display is scoped to the current round, with a fresh session each round.
- Tamper-proof browser scores or a trusted physical device clock: the design deliberately keeps ordinary results browser-local and acknowledges client-reported Live event timing; server direction validation does not establish hardware clock trust.
- Production network/origin behavior, real-device throughput, and rollout execution: no deployment or real-phone rehearsal was authorized/performed in this change, so local/static evidence cannot certify those environments.

## Assessment

**Ready to merge? Yes, with one non-blocking minor noted above.**

The shared scoring contract, ordinary persistence lifecycle, and Live authority/recovery paths fit together coherently, and the recorded automated/browser evidence exercises their principal failure boundaries. No Critical or Important defect was found in the reviewed range; the remaining default inconsistency affects a deliberate future configuration change in the developer-mode path and is straightforward to correct.

## Final finding resolution

The minor default inconsistency is fixed in `00db31e2fb3d849638139dde62184bcceb6a18a8`. A fresh scoped reviewer confirms `index.vue:754–755` now uses the same shared defaults as board construction, challenge overrides retain nullish precedence, and session configuration freezing remains unchanged. No new breakage was found; the fix is approved. Static generation passes with 14 routes, and controller app verification passes 170 tests on the final product commit. No review findings remain open.
