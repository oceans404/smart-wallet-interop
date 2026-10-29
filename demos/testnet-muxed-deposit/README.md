# Testnet muxed deposit (planned)

An end to end proof of the send fix on testnet:

1. Deploy a test smart wallet and fund it.
2. Build an `M...` address from a test exchange account and an ID.
3. Call the token contract's `transfer` from the smart wallet to the `M...` address.
4. Capture the transfer event (`to_muxed_id`) and the Horizon payment record.

It also settles [send](../../solutions/send) test case 4 (muxed ID vs memo precedence).
