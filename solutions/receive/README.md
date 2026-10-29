# Receive: exchanges and ramps paying smart wallets

**Solves:** withdrawals into smart wallets.

**Without a protocol change:** each exchange or ramp accepts `C...` addresses and pays out through the token contract's `transfer` instead of a classic payment. Works today, one partner at a time.

**With a protocol change:** a bridge so partners can keep sending classic payments. Proposals only, see [discussion #1763](https://github.com/orgs/stellar/discussions/1763).

| Option | Exchange changes | Status | Main concern |
| --- | --- | --- | --- |
| G to C mapping: a `G...` style address that routes into a smart wallet | None | Idea, not designed | Incoming funds must not land in expired contract storage |
| Trimmed [CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md): deposit `G...` accounts whose only signer is the smart wallet | None | Proposed in #1763 | Trust in whoever sets them up; they can't be changed or closed later |
| Classic payments credit `C...` addresses directly | Accept the `C...` format | Not proposed | Classic operations would have to handle contract storage and archival |
| Full CAP-72: smart wallet as a signer on a `G...` account | None | Draft, shelved | Complexity for limited benefit next to smart wallets |

The question for the protocol team: what's the safest design for receiving, a mapping or deposit accounts?
