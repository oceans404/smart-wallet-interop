// RECEIVE from an exchange: a withdrawal to the smart wallet, before and after.
// Before: the classic payment exchanges send today. After: the token contract's transfer.
import { Address, Asset, Keypair, Operation, nativeToScVal } from "@stellar/stellar-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { XLM_SAC, invoke, loadState, stroopsToXlm, submitClassic, xlmBalance } from "./lib.js";

const state = loadState();
const exchange = Keypair.fromSecret(state.exchangeSecret);
const reader = exchange.publicKey();

// BEFORE: a classic payment to a C address.
let before: string;
try {
  await submitClassic(exchange, [Operation.payment({ destination: state.wallet, asset: Asset.native(), amount: "1" })]);
  before = "sent (unexpected)";
} catch (err) {
  before = `fails: ${(err as Error).message}`;
}
console.log(`Before (classic payment to C): ${before}`);

// AFTER: the exchange calls transfer on the token contract; its own key authorizes and pays the fee.
const start = await xlmBalance(state.wallet, reader);
const res = await invoke(
  exchange,
  Operation.invokeContractFunction({
    contract: XLM_SAC,
    function: "transfer",
    args: [Address.fromString(exchange.publicKey()).toScVal(), Address.fromString(state.wallet).toScVal(), nativeToScVal(1_0000000n, { type: "i128" })],
  }),
);
const received = (await xlmBalance(state.wallet, reader)) - start;
console.log(`After (token transfer to C): received ${stroopsToXlm(received)} XLM\n  https://stellar.expert/explorer/testnet/tx/${res.txHash}`);

mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../fixtures/exchange-withdraw.json", import.meta.url),
  JSON.stringify({ wallet: state.wallet, before, afterTx: res.txHash, receivedXlm: stroopsToXlm(received) }, null, 2) + "\n",
);
if (received !== 1_0000000n) process.exitCode = 1;
