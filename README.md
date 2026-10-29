# smart-wallet-interop

Making Stellar smart wallets (C accounts) work with exchanges, ramps and the rest of the ecosystem.

## The problem

Stellar has two kinds of accounts. Classic accounts (`G...`) work everywhere but only support basic keys. Smart wallets (`C...`) support passkeys, recovery and spending policies, but most exchanges and ramps can't move money to or from them.

It comes down to two separate problems:

| | Problem | Why |
| --- | --- | --- |
| **Send** | A smart wallet's deposit to an exchange can't be matched to the user | Exchanges match deposits by memo, and a smart wallet's payment (a token contract call) can't carry one |
| **Receive** | Exchanges and ramps can't pay a smart wallet | They send classic payment operations, which can only reach `G...` addresses |

Fees are a third gap (a smart wallet can't pay its own), but a relayer can always cover that, so it's out of scope here.

## Solutions

| Folder | Solves | Needs a protocol change? | Status |
| --- | --- | --- | --- |
| [`solutions/send`](solutions/send) | Send | No | Spec drafted |
| [`solutions/receive`](solutions/receive) | Receive | Per-partner fix: no. Bridge: yes | Bridge proposals under discussion |
| [`demos/testnet-muxed-deposit`](demos/testnet-muxed-deposit) | Proves send end to end | No | Planned |

The short version: **send** is already solved at the protocol level (muxed addresses, [CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)) and needs exchanges and wallets to adopt it. **Receive** needs either each partner to upgrade or a protocol bridge.

Obvious ideas that don't work: [why-not.md](why-not.md).

## Background

* [CAP-72 discussion #1763](https://github.com/orgs/stellar/discussions/1763): the main protocol debate
* [SDF guide: payments to and from contract accounts](https://developers.stellar.org/docs/build/guides/transactions/send-and-receive-c-accounts)
