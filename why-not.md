# Why not just...

Obvious fixes, and why they don't work (yet).

| Idea | Why not |
| --- | --- |
| Let smart wallets attach a memo | Tried as [CAP-64](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0064.md), rejected in favor of muxed addresses ([CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md)). Exchanges would still need to detect contract call deposits, so a memo alone fixes nothing |
| Let smart wallets send classic payments | Validating the transaction would mean running the wallet's contract code before any fee is paid: free compute for attackers ([#1763](https://github.com/orgs/stellar/discussions/1763)) |
| Let smart wallets pay their own fees | Same validation problem. A relayer can always pay instead |
| Let classic payments deliver to `C...` | Smart wallet balances live in contract storage, which can expire. Classic operations would have to handle that safely. Not proposed yet, listed in [`solutions/protocol`](solutions/protocol) |
| Give each user their own deposit `G...` account at the exchange | Every `G...` account locks an XLM reserve and needs trustlines and sweeping. That's why exchanges pool accounts and use memos |
| Add passkey keys (P-256) to `G...` accounts ([CAP-43](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0043.md)) | Passkeys sign a WebAuthn-wrapped message, not the raw transaction, so a plain P-256 signer likely wouldn't verify them. No recovery or policies either |
| Use a forwarding service | Works today with any exchange, but it's custodial: funds sit with the operator for each hop |
