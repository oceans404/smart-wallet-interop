# Wallet send: muxed deposits from smart wallets

**Solves:** send, together with the [exchange kit](../exchange-kit).
**Protocol change:** none.

A smart wallet can't attach a memo, but it can pay a muxed (`M...`) address: the exchange's `G...` address with the memo ID packed inside. Since [CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md), the token contract's `transfer` accepts one as `to`.

## What the wallet changes

1. Accept an address plus memo, or an `M...` address, on the send screen.
2. Build the `M...` address and call `transfer(from: C..., to: M..., amount)` on the token contract.
3. Check the destination's [SEP-29](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0029.md) memo required flag and block sends without an ID.

```js
const muxed = new MuxedAccount(new Account("G...", "0"), "1234").accountId(); // "M..."
```

The funds land in the exchange's `G...` account. The ID travels in the transfer event as `to_muxed_id`.
