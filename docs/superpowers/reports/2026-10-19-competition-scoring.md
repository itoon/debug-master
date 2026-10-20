# Competition scoring implementation report

Date: 2026-10-19 (Asia/Bangkok).

Status: Implementation and reviews complete at `00db31e`. The final whole-change review found no Critical or Important issues. Its one minor configuration-consistency finding is fixed and approved in a scoped re-review. No push, merge, site publication, or Worker deployment has occurred.

## Delivered behavior

Ordinary play calculates the Competition formula and persists canonical sessions in the current browser. Live uses this project's Worker to validate directional evidence and calculate authoritative results. Neither flow calls `codeventure-mvp-api`.

Every scored level uses fractional elapsed seconds, the frozen numeric difficulty, and the approved mistake rubric: zero mistakes earns three stars, one mistake earns two, and two or more earns one. Retry, reset, reload, and reconnect preserve the level's first-ready time and mistakes. The session stores each level's maximum score, adds only improvements, and does not award duplicates.

Browser leaderboards select one session per player using BEST or LATEST, including timestamp ties and a latest zero-score session. Best, latest, and the current result remain distinct. Practice stays unscored; Dead Mode retains generated levels and five hearts.

Live persists immutable input before animation and pipelines established gameplay without waiting for each acknowledgement. Offline play can queue evidence, while reconnect reconciles the accepted prefix before enabling fresh input. Only accepted Worker values update points, completed counts, popup deltas, and standings. Round rollover starts fresh sessions and scores.

## Verification

| Check | Result |
| --- | --- |
| App unit and integration suite, `rtk pnpm test` | 170 tests passed across 13 files. |
| Worker suite, `rtk pnpm --dir live-server test` | 82 tests passed across 6 files. |
| Worker TypeScript, `rtk pnpm --dir live-server typecheck` | Passed. |
| Strict framework-free shared and Live utility TypeScript checks | Passed in the task reports. |
| Static production generation, `rtk pnpm generate` | Passed; 14 routes. Controller repeated this on `3d596c6`; the final configuration fix at `00db31e` also passes generation. |
| Updated Live protocol smoke against a local Worker | Passed. |
| Generated-client browser checks | Passed ordinary resume, cumulative mistakes, storage recovery, authoritative Live scores, delayed acknowledgements, offline replay, reload, round rollover, and the final-input/reset race. |

The formula tests verify the supplied three-star, difficulty-one examples: 1,537 at 10 seconds; 1,248 at 30; 1,084 at 60; and 946 at 120. Coverage also includes a correct zero-star primitive, wrong answers, fractional time, maximum-per-level replacement, duplicate operations, stale browser revisions, BEST/LATEST selection, Worker persistence failures, privacy, deadlines, and delivery grace.

Browser verification uses isolated test profiles and the actual generated page and Worker. It includes a one- and two-mistake completion, accepted-only popup increments, a narrow-screen storage error, ordinary and Live reloads, natural timeout, Practice, and a seeded resumable Dead session. The final Live regressions hold acknowledgements while entering the next level, queue a complete level offline, replay original timestamps after reconnect, deliver a new private round before its public state, and click Reset in the same JavaScript task as the final direction.

Full Vue type checking remains unavailable because the project has no installed Vue checker. No dependency was added. Static generation still reports the existing unrelated hint-ring CSS warning. Chromium checks do not replace a real phone, LAN, or deployed Cloudflare rehearsal. Dead's setup entry remains behind the existing disabled home configuration; its resume and five-heart behavior were exercised.

## Final review and retained evidence

The [whole-change review](2026-10-19-competition-scoring-review.md) covers the integrated system. The final scoped review approves the shared-default fallback fix; no findings remain open. Controller app tests pass again at `00db31e`.

Retained browser screenshots show the [star popup](competition-scoring/browser-stars-popup.png), [mobile save recovery](competition-scoring/browser-mobile-save-error.png), [fresh Live round after reconnect](competition-scoring/live-round-rollover.png), and [safe next-level reset](competition-scoring/live-reset-safe-next-level.png).

## Operational boundary

The matching client and Worker require a coordinated protocol rollout. Build the client with the intended `NUXT_PUBLIC_LIVE_URL`; local verification URLs are not a production deployment. See [the Worker runbook](../../../live-server/README.md) and [the project handoff](../../HANDOFF.md).

Task-owned test servers were stopped. An unrelated existing server on port 3000 was preserved. No old-score conversion, separate legacy history, or migration was added because the user explicitly confirmed there are no previous-formula scores.

## Review decisions

The following decisions preserve the implementation ledger before its temporary workspace is removed. Each decision records its practical cost if the assumption is wrong.

1. Work uses the existing non-main feature checkout. The native worktree tool did not target the nested repository. The cost is that these commits share the existing feature branch.
2. The score repository's existing save method remains an adapter during implementation, while the page moves to canonical sessions. It cannot create an independently writable score total. The cost is retaining a small adapter for existing callers.
3. Completion captures the final input time before the animation callback. Timeout queues after that accepted completion. The cost is that the scoring submission precedes its visual completion by the animation interval.
4. Live retries retain immutable server-clock timestamps and reject future or backward evidence. The cost is that an invalid device clock requires recovery instead of silently retiming an event.
5. The pure reducer accepts an internal validated candidate for aggregation tests. Production browser logic derives points from mistakes and elapsed time, and the Worker never accepts client points. The cost is maintaining that validation boundary when adding callers.
6. Repository rank lookup identifies the exact selected session. The cost is that another session from the same player does not inherit that selected session's position.
7. Strategy is a selection policy, not board identity; difficulty remains board identity. The cost is that changing BEST to LATEST selects from existing matching-board sessions instead of hiding them.
8. Browser transitions use a serial persistence queue. Failed operations retain stable IDs; explicit leave invalidates pending callbacks, and stale-tab recovery rejects old evidence rather than rebasing mistakes. The cost is requiring recovery before further scored input after a failed or stale write.
9. New product copy follows the existing Thai dictionary. The cost is that an English locale remains outside this feature.
10. Intermediate Live code awarded no local points while Worker integration was pending. No temporary score bridge was added. The cost was an intermediate commit requiring the later Live tasks before delivery; the delivered flow uses Worker receipts.
11. Live retains 64 recent fingerprints and receipts, while preserving canonical sequence, timing, mistakes, and level ledgers. Older duplicate sequences return a harmless canonical acknowledgement without a receipt. The cost is that an old conflicting duplicate cannot be distinguished from an old harmless duplicate; neither can change scores. This keeps realistic 12-player room persistence within the tested storage budget.
12. Established Live input pipelines after durable enqueue, and acknowledgements update canonical scores without rewinding optimistic play. Reconnect gates new input until reconciliation. The cost is that visible local progression can precede accepted scoring and may require canonical reconstruction after recovery.

