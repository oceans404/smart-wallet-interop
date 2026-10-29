# Send: smart wallet deposits to exchanges

**Solves:** deposits from smart wallets get credited to the right user.
**Protocol change:** none. Works on mainnet since Protocol 23 ([CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)).

A smart wallet can't attach a memo, but it can pay a muxed (`M...`) address: the exchange's `G...` address with the memo ID packed inside. Both sides have to change.

## Wallet

1. Accept an address plus memo, or an `M...` address, on the send screen.
2. Build the `M...` address and call `transfer(from: C..., to: M..., amount)` on the token contract.
3. Check the destination's [SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md) memo required flag and block sends without an ID.

```js
const muxed = new MuxedAccount(new Account("G...", "0"), "1234").accountId(); // "M..."
```

## Exchange

1. Credit deposits from token transfer events, keyed by `to_muxed_id`. Use RPC `getEvents`, Horizon's `asset_balance_changes`, or the Go [Token Transfer Processor](https://developers.stellar.org/docs/data/indexers/build-your-own/processors/token-transfer-processor). Classic payments with a memo get the memo copied into `to_muxed_id`, so one code path handles every deposit.
2. Use ID (number) memos. Text and hash memos can't be carried in a muxed address.
3. Keep the SEP-29 memo required flag set on deposit accounts.

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

* Exchanges or wallets that don't adopt this
* Services that rely on text or hash memos
