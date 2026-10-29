| # | Deposit | Expected | Before | After |
| --- | --- | --- | --- | --- |
| 1 | Classic payment with ID memo 1001 | 1001 | credited 1001 | credited 1001 |
| 2 | Classic payment to M address (ID 1002) | 1002 | unattributed | credited 1002 |
| 3 | Smart wallet transfer to M address (ID 1003) | 1003 | not seen | credited 1003 |
| 4 | Classic payment to M address (ID 1004) that also has memo 9999 | 1004 | credited 9999 | credited 1004 |
| 5 | Smart wallet transfer to the plain G address | unattributed | not seen | unattributed |

Exchange: `GDMAYOLJXBUWR57S6VATXO55364SJP6KLPRCR7JQVWCRKACMXJJGBPHV`

* Case 1: https://stellar.expert/explorer/testnet/tx/e00c5e158b098788796fed3fc379201b53f033ed97978c92c526679618cf2789
* Case 2: https://stellar.expert/explorer/testnet/tx/5586dbc1e8963797652af8b373ae5829f3e06d00050a96bce81a3f221802cef9
* Case 3: https://stellar.expert/explorer/testnet/tx/af91fe0ce84d1380205ec6eaafc5932fed2d270ae17c689dde0bf5b0de4fd98e
* Case 4: https://stellar.expert/explorer/testnet/tx/3a3462ab9393cfad19cfae7371c703df6a7153f7984bbcbf021d54421dd179bb
* Case 5: https://stellar.expert/explorer/testnet/tx/3b339ffed4af8da383da1e5d32bf54269405ad0c8b6377f37517d323826e1b7d
