| # | Deposit | Expected | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Classic payment with ID memo 1001 | 1001 | credited 1001 | credited 1001 |
| 2 | Classic payment to M address (ID 1002) | 1002 | unattributed | credited 1002 |
| 3 | Smart wallet transfer to M address (ID 1003) | 1003 | not seen | credited 1003 |
| 4 | Classic payment to M address (ID 1004) that also has memo 9999 | 1004 | credited 9999 | credited 1004 |
| 5 | Smart wallet transfer to the plain G address | unattributed | not seen | unattributed |

Exchange: `GDLR3V5ZKVXX7QRTIFKMUK6DDHZPDAU3RR4XCMEBGCUEB3XOCJYJ6M6W`

* Case 1: https://stellar.expert/explorer/testnet/tx/40bb579f7b2de3bf316174f44c829ade2c76d7e5ef9067ad5fe4c5ef074e6c4a
* Case 2: https://stellar.expert/explorer/testnet/tx/8e28a5f1a3feb57475d31e68a9692bca49c1239dade181793b1fd1ca24746a68
* Case 3: https://stellar.expert/explorer/testnet/tx/6cc9b47f11a18ca14c814abf1826a4f3a0a5b3914256536ffb43971e6decc9eb
* Case 4: https://stellar.expert/explorer/testnet/tx/80a7b2495a6433b82d7066ddf61932c6effd725567ece9796faf6a5524b6ff9c
* Case 5: https://stellar.expert/explorer/testnet/tx/416de50e1bf15bb868129722b19b02969bc25c15880c2b6638aefb47e2a3b470
