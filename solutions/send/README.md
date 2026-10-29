# Send: smart wallets paying exchanges and anchors

**Solves:** exchange deposits and anchor cash-outs from smart wallets get matched to the right user or transaction.
**Protocol change:** none. Works on mainnet since Protocol 23 ([CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)).

A smart wallet can't attach a memo, but it can pay a muxed (`M...`) address: the exchange's `G...` address with the memo ID packed inside. Both sides have to change.

## Wallet

1. Accept an address plus memo, or an `M...` address, on the send screen.
2. Build the `M...` address and call `transfer(from: C..., to: M..., amount)` on the token contract.
3. Check the destination's [SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md) memo required flag and block sends without an ID.

```ts
const muxed = new MuxedAccount(new Account("G...", "0"), "1234").accountId(); // "M..."
```

## Exchange

1. Credit deposits from token transfer events, keyed by `to_muxed_id`. Use RPC `getEvents`, Horizon's `asset_balance_changes`, or the Go [Token Transfer Processor](https://developers.stellar.org/docs/data/indexers/build-your-own/processors/token-transfer-processor). Classic payments with a memo get the memo copied into `to_muxed_id`, so one code path handles every deposit.
2. Use ID (number) memos. Text and hash memos can't be carried in a muxed address.
3. Keep the SEP-29 memo required flag set on deposit accounts.

Users see no change. They still copy the exchange's address and memo.

## Anchor (SEP-6/24 withdraw, SEP-31 send)

The memo here is per transaction: it tells the anchor which payout to make.

1. Return an ID memo (or an `M...` address) for each withdrawal. Text and hash memos can't reach the anchor from a smart wallet.
2. Match smart-wallet-to-muxed payments by the muxed ID. [Anchor Platform](https://github.com/stellar/java-stellar-anchor-sdk/blob/2a4b58c3c90d3ca79a7216bd09b92143b2248616/platform/src/main/java/org/stellar/anchor/platform/observer/stellar/DefaultPaymentListener.java) already does this (`isContractToMuxed`).
3. Support [SEP-45](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) sign-in for `C...` accounts (still Draft; Anchor Platform has it).

Verified on testnet: a smart wallet cashed out through SDF's test anchor (Anchor Platform) and the anchor completed it. See the [demo](../../demos/mock-exchange).

## Test cases

All five verified on testnet with the [mock exchange](../../demos/mock-exchange). To test your own testnet deposit address, run [`npm run conformance`](../../demos/mock-exchange#test-your-own-deposit-address).

| # | Deposit | Expected |
| --- | --- | --- |
| 1 | Classic payment with an ID memo | Credited to that ID |
| 2 | Classic payment to the `M...` address | Credited to that ID |
| 3 | Smart wallet `transfer` to the `M...` address | Credited to that ID |
| 4 | Payment to the `M...` address that also has a memo | Credited to the `M...` ID. A memo-only tracker credits the memo, the wrong user |
| 5 | Smart wallet `transfer` to the plain `G...` address | Held as unattributed, with a claim or refund path |

## Still open

* Exchanges or wallets that don't adopt this
* Services that rely on text or hash memos
