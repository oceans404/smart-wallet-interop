# Issues found

Bugs and gaps in other projects, found while testing. None reported upstream yet.

| # | Where | Issue | Impact | Evidence |
| --- | --- | --- | --- | --- |
| 1 | `testanchor.stellar.org` | SEP-45 uses `authorizationEntries` in the challenge and token request, and rejects the spec's `authorization_entries` with a 400. Anchor Platform's current code uses the spec name, so the test anchor looks out of date | Spec-following wallets can't sign in to the test anchor | [demo](demos/mock-exchange) |
| 2 | `testanchor.stellar.org` | SEP-6 withdraw stays `incomplete` after KYC, for `G...` and `C...` accounts alike | SEP-6 can't be tested end to end there; SEP-24 works | [demo](demos/mock-exchange) |
| 3 | `testanchor.stellar.org` | A completed SEP-24 deposit still says "funds received, transaction is being processed" | Cosmetic | [fixture](demos/mock-exchange/fixtures/anchor-cashin.json) |
| 4 | `js-stellar-sdk` | The SEP-29 memo required check (`checkMemoRequired`, Horizon submit) only looks at classic payments and merges; RPC submit has no check | A smart wallet can pay a memo-required account with no ID, as demo case 5 did | `lib/esm/horizon/server.js` |
| 5 | Nido | The send screen accepts only a name, `C...` or `G...` (`resolveFriendInput`), with no memo field | Can't deposit to exchanges that need a memo from Nido's own UI | `packages/passkey-sdk/src/resolveFriendInput.ts` |
| 6 | Smart Account Kit | `kit.transfer` accepts only `G...` or `C...` (`validateAddress`) | Same, for apps on the kit's helper | `src/utils.ts` |
| 7 | Nido | The activity view reads muxed transfer amounts but ignores `to_muxed_id` | Users can't see which ID a deposit carried | `packages/frontend/src/lib/activity/classify.ts` |
| 8 | Nido | README says new accounts are funded by a Friendbot throwaway account; the code funds them from the relayer's treasury | Docs drift | `README.md` vs `packages/frontend/src/pages/new-account/index.astro` |

## Gotchas (not bugs)

* **SEP-45 signature expiration:** the challenge leaves the client's entry expiration at 0, and the spec says the client picks one. Signing with 0 fails as expired.
* **Memo-only deposit trackers:** a payment to an `M...` address that also carries a memo is credited to the memo, the wrong user (demo case 4). The muxed ID should win.
* **Classic payments to `C...`:** the SDK rejects them before submission ("destination is invalid"), so exchanges get a clear error rather than lost funds.
