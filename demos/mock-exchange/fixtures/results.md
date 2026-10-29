| # | Deposit | Expected | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Classic payment with ID memo 1001 | 1001 | credited 1001 | credited 1001 |
| 2 | Classic payment to M address (ID 1002) | 1002 | unattributed | credited 1002 |
| 3 | Smart wallet transfer to M address (ID 1003) | 1003 | not seen | credited 1003 |
| 4 | Classic payment to M address (ID 1004) that also has memo 9999 | 1004 | credited 9999 | credited 1004 |
| 5 | Smart wallet transfer to the plain G address | unattributed | not seen | unattributed |

Exchange: `GDMAYOLJXBUWR57S6VATXO55364SJP6KLPRCR7JQVWCRKACMXJJGBPHV`

* Case 1: https://stellar.expert/explorer/testnet/tx/71db71b7aeaaab854ecd585e7ed39cbd7ac739a82da40cea0bf9678247fbfe6b
* Case 2: https://stellar.expert/explorer/testnet/tx/699c5a41d98da1a2aa4d5ad5570446dd385e00c1fc2e492bf343175af327fb18
* Case 3: https://stellar.expert/explorer/testnet/tx/05dc1dcbe83e35ce893899a2cfc91daf2d186ff79347b72786ec84e98af290c0
* Case 4: https://stellar.expert/explorer/testnet/tx/7cd51ac39c44044997d98fc3655e6dd77dc467b6dc91f436dd460552b8c32ab3
* Case 5: https://stellar.expert/explorer/testnet/tx/7274d878cafdfe9371bb328f235066a933cf8d2dca2a1b21325391a6038ef302
