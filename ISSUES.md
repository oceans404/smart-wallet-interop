# Issues found

Found while testing. None reported upstream yet.

## Bugs

| Where | Issue | Evidence |
| --- | --- | --- |
| Anchor Platform 5.0.0 (seen on `testanchor.stellar.org`) | SEP-45 JSON uses `authorizationEntries` / `networkPassphrase`, and a JSON POST with the spec's `authorization_entries` gets a 400. The classes declare the spec names with Jackson's `@JsonProperty`, but the SEP server serializes with Gson, which ignores it. The platform's own test client also uses Gson, so its tests never see the mismatch. Form-encoded POSTs work | `SepConfigManager.java`, `api-schema/.../sep45/ChallengeResponse.java`, `lib-util/.../Sep45Client.kt` |
| Nido | README says new accounts are funded by a Friendbot throwaway account; the code funds them from the relayer's treasury | `README.md` vs `packages/frontend/src/pages/new-account/index.astro` |

## Spec and feature gaps (working as designed)

| Where | Gap | Evidence |
| --- | --- | --- |
| [SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md) | The memo required check covers only `PAYMENT`, path payments and `MERGE_ACCOUNT` (last updated 2020). Token contract transfers aren't covered, so a smart wallet can pay a memo-required account with no ID (demo case 5). js-stellar-sdk follows the spec exactly | [`checkMemoRequired`](https://github.com/stellar/js-stellar-sdk/blob/1ef3f77b8f493a4905d1cfd97462f9cc55efcc70/src/horizon/server.ts#L852) |
| Nido | The send screen accepts only a name, `C...` or `G...`, with no memo field | `packages/passkey-sdk/src/resolveFriendInput.ts` |
| Smart Account Kit | `kit.transfer` accepts only `G...` or `C...` | `src/utils.ts` |
| Nido | The activity view ignores `to_muxed_id` on incoming transfers | `packages/frontend/src/lib/activity/classify.ts` |

## Unresolved

* **`testanchor.stellar.org` SEP-6 withdraw stays `incomplete`**, for `G...` and `C...` accounts, even after submitting every KYC field its reference server checks for (ID and bank fields that SEP-12 lists as optional). SEP-24 on the same anchor works. Cause unknown from outside; it may be the test anchor's configuration rather than a code bug.

## Gotchas (not bugs)

* **SEP-45 signature expiration:** the challenge leaves the client's entry expiration at 0, and the spec says the client picks one. Signing with 0 fails as expired.
* **Memo-only deposit trackers:** a payment to an `M...` address that also carries a memo is credited to the memo, the wrong user (demo case 4). The muxed ID should win.
* **Classic payments to `C...`:** the SDK rejects them before submission ("destination is invalid").
