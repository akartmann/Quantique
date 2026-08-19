/**
 * Whether this load is the source-and-rights ledger review route, from `?ledger=1` (Story 3.3, AC6).
 *
 * A reviewer entry point, following the `?mode=validation` and `?case=` precedents: not a game feature,
 * not a menu, and not something a player reaches by playing. It composes with `?case=`, so
 * `?ledger=1&case=morley-miller` audits the prototype.
 *
 * **Exactly `1`, and nothing else.** A truthy-string test would make `?ledger=0` and `?ledger=false`
 * open the ledger, which is the opposite of what a reviewer typing either of them means.
 *
 * Its own module rather than a closure in `main.ts` for the reason `resolveCaseId` is: `main.ts`
 * attaches a `DOMContentLoaded` listener at module scope, so importing it from a Node test is a crash
 * rather than a check.
 */
export const resolveLedgerMode = (search: URLSearchParams): boolean => search.get('ledger') === '1';
