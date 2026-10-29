# Mock exchange and anchor (testnet)

Proves the [send](../../solutions/send) fix end to end with a real smart wallet on testnet: an exchange deposit tracker before and after the change, and a cash-out to SDF's test anchor.

## Results (Oct 29, 2026)

**Exchange.** Same five deposits, two trackers ([full results](fixtures/results.md)):

| # | Deposit | Expected | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Classic payment with ID memo 1001 | 1001 | credited 1001 | credited 1001 |
| 2 | Classic payment to `M...` (ID 1002) | 1002 | unattributed | credited 1002 |
| 3 | Smart wallet transfer to `M...` (ID 1003) | 1003 | not seen | credited 1003 |
| 4 | Classic payment to `M...` (ID 1004) with memo 9999 | 1004 | **credited 9999 (wrong user)** | credited 1004 |
| 5 | Smart wallet transfer to plain `G...` | unattributed | not seen | unattributed |

**Anchor.** A smart wallet cashed out 2 XLM through `testanchor.stellar.org` (Anchor Platform): SEP-45 sign-in, SEP-24 withdraw, transfer to `M...` (anchor account + ID memo). Final status: **completed** ([tx](https://stellar.expert/explorer/testnet/tx/d59c5970636ef5d583a5c918688cf7ca1623329c919a9239c570e6b52d0e4a53)).

## Findings

* The after tracker handles every case with one code path, and the muxed ID wins over the memo (case 4).
* A memo-only tracker doesn't just miss smart wallet deposits: it can credit the wrong user (case 4).
* Anchor Platform already credits smart wallet payments to a muxed address.
* The test anchor's SEP-45 uses `authorizationEntries` (camelCase) in both the challenge and the token request, and rejects the spec's `authorization_entries` with a 400.
* The SEP-45 challenge leaves the client's entry expiration at 0, so the client has to choose one. Signing with 0 fails as expired.
* The test anchor's SEP-6 withdraw stays `incomplete` for both `G...` and `C...` accounts, so this demo uses SEP-24.

## Run it

Needs Node 22, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli) (to build the test wallet) and, for the anchor step, Playwright with Chromium.

```bash
npm install
npm run build:contract   # test wallet: one ed25519 owner key, testnet only
npm run setup            # funds an exchange, a sender, a relayer; deploys and funds the wallet
npm run send             # sends the five deposits
npm run report           # runs both trackers, writes fixtures/
npm run anchor           # smart wallet cash-out to testanchor.stellar.org
```

Behind a proxy, set `NODE_USE_ENV_PROXY=1`.

## Files

* [`src/tracker-before.ts`](src/tracker-before.ts): typical tracker, classic payments on Horizon, credits by memo
* [`src/tracker-after.ts`](src/tracker-after.ts): the fix, transfer events on RPC, credits by `to_muxed_id`
* [`src/send-cases.ts`](src/send-cases.ts), [`src/anchor-cashout.ts`](src/anchor-cashout.ts): the senders
* [`contract/`](contract): the test smart wallet
* [`fixtures/`](fixtures): real event data from the run, for unit tests
