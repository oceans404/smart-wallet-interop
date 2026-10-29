# Exchange kit: smart wallet deposits

**Solves:** send. Deposits from smart wallets get credited to the right user.
**Protocol change:** none. Works on mainnet since Protocol 23.

## What the exchange changes

1. **Credit deposits from token transfer events, keyed by `to_muxed_id`.** Use RPC `getEvents`, Horizon's `asset_balance_changes`, or the Go [Token Transfer Processor](https://developers.stellar.org/docs/data/indexers/build-your-own/processors/token-transfer-processor). For a classic payment with a memo, the network copies the memo into `to_muxed_id` ([CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)), so one code path handles every deposit.
2. **Use ID (number) memos.** Text and hash memos can't be carried in a muxed address.
3. **Keep the [SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md) memo required flag set** on deposit accounts.

Users see no change. They still copy the exchange's address and memo.

## Test cases

| # | Deposit | Expected |
| --- | --- | --- |
| 1 | Classic payment with an ID memo | Credited to that ID |
| 2 | Classic payment to the `M...` address | Credited to that ID |
| 3 | Smart wallet `transfer` to the `M...` address | Credited to that ID |
| 4 | Payment to the `M...` address that also has a memo | Credited to the `M...` ID (to verify on testnet) |
| 5 | Smart wallet `transfer` to the plain `G...` address | Held as unattributed, with a claim or refund path |

## Still open

* Withdrawals to smart wallets (see [`../protocol`](../protocol))
* Exchanges that don't adopt this
* Services that rely on text or hash memos
