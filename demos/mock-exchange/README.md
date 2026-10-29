# Mock exchange and anchor (testnet)

Tests both directions end to end with a real smart wallet on testnet, against a mock exchange and SDF's test anchor (Anchor Platform).

## Results (Oct 29, 2026)

**Exchange.** Same five deposits, two trackers ([full results](fixtures/results.md)):

| # | Deposit | Expected | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Classic payment with ID memo 1001 | 1001 | credited 1001 | credited 1001 |
| 2 | Classic payment to `M...` (ID 1002) | 1002 | unattributed | credited 1002 |
| 3 | Smart wallet transfer to `M...` (ID 1003) | 1003 | not seen | credited 1003 |
| 4 | Classic payment to `M...` (ID 1004) with memo 9999 | 1004 | **credited 9999 (wrong user)** | credited 1004 |
| 5 | Smart wallet transfer to plain `G...` | unattributed | not seen | unattributed |

**All four flows:**

| Direction | Partner | How | Result |
| --- | --- | --- | --- |
| Send | Exchange | Smart wallet `transfer` to `M...` | Credited by the after tracker (case 3) |
| Send | Anchor | SEP-45 sign-in, SEP-24 withdraw, `transfer` to the anchor's `M...` | Credited by the anchor, status `pending_anchor` ([tx](https://stellar.expert/explorer/testnet/tx/1d59e84cee086ee44b320cb4d5a8c6db71620c99a143d78b1e725fb1dddb2a42)) |
| Receive | Exchange | Classic payment to `C...` | Rejected by the SDK: "destination is invalid" |
| Receive | Exchange | Token contract `transfer` to `C...` | 1 XLM received ([tx](https://stellar.expert/explorer/testnet/tx/ea52985ae4539bc9c63f338a246d2fdf92cf9f98da89b87c82ac0389a896f4e3)) |
| Receive | Anchor | SEP-24 deposit to `C...` | **Completed**, 1.8 XLM received after the anchor's fee. The anchor paid with a token `transfer` ([tx](https://stellar.expert/explorer/testnet/tx/e3d57929be5a1d1b529ea8d52a9bd499f34fadf1a101f24bc185ad25a2f5406e)) |

## Findings

* The after tracker handles every case with one code path, and the muxed ID wins over the memo (case 4).
* A memo-only tracker doesn't just miss smart wallet deposits: it can credit the wrong user (case 4).
* Anchor Platform already supports smart wallets both ways: it credits payments to a muxed address and pays out to `C...` addresses.
* Bugs found along the way are in [ISSUES.md](../../ISSUES.md).

## Run it

Needs Node 22, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli) (to build the test wallet) and, for the anchor step, Playwright with Chromium.

```bash
npm install
npm run build:contract   # test wallet: one ed25519 owner key, testnet only
npm run setup            # funds an exchange, a sender, a relayer; deploys and funds the wallet
npm run send             # sends the five deposits
npm run report           # runs both trackers, writes fixtures/
npm run withdraw         # exchange pays the smart wallet, classic vs token transfer
npm run cashout          # smart wallet cash-out to testanchor.stellar.org
npm run cashin           # testanchor.stellar.org deposit into the smart wallet
npm run all              # everything above after the contract build
```

Behind a proxy, set `NODE_USE_ENV_PROXY=1`.

## Files

* [`src/tracker-before.ts`](src/tracker-before.ts): typical tracker, classic payments on Horizon, credits by memo
* [`src/tracker-after.ts`](src/tracker-after.ts): the fix, transfer events on RPC, credits by `to_muxed_id`
* [`src/send-cases.ts`](src/send-cases.ts), [`src/exchange-withdraw.ts`](src/exchange-withdraw.ts): exchange deposits and withdrawals
* [`src/anchor-cashout.ts`](src/anchor-cashout.ts), [`src/anchor-cashin.ts`](src/anchor-cashin.ts), [`src/anchor.ts`](src/anchor.ts): anchor flows (SEP-45, SEP-24)
* [`contract/`](contract): the test smart wallet
* [`fixtures/`](fixtures): real event data from the run, for unit tests
