// RECEIVE from an anchor: SEP-24 deposit (cash-in) into the smart wallet.
// Checks whether the anchor can pay a C address, and that the funds actually land.
import { Keypair } from "@stellar/stellar-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { sep24Start, sep45SignIn, waitForTx } from "./anchor.js";
import { loadState, stroopsToXlm, xlmBalance } from "./lib.js";

const AMOUNT_XLM = 2;
const state = loadState();
const owner = Keypair.fromSecret(state.ownerSecret);
const reader = Keypair.fromSecret(state.relayerSecret).publicKey();

const before = await xlmBalance(state.wallet, reader);
const auth = await sep45SignIn(state.wallet, owner);
console.log("SEP-45 sign-in: ok");
const id = await sep24Start("deposit", auth, state.wallet, String(AMOUNT_XLM));
console.log(`SEP-24 deposit: id ${id}`);

const terminal = ["completed", "error", "expired", "refunded", "no_market", "too_small", "too_large"];
const final = await waitForTx(auth, id, (t) => terminal.includes(t.status));
const after = await xlmBalance(state.wallet, reader);
const received = after - before;
console.log(`Wallet balance: ${stroopsToXlm(before)} -> ${stroopsToXlm(after)} XLM (received ${stroopsToXlm(received)})`);
if (final.stellar_transaction_id) console.log(`  https://stellar.expert/explorer/testnet/tx/${final.stellar_transaction_id}`);
if (final.message) console.log(`  anchor message: ${final.message}`);

mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../fixtures/anchor-cashin.json", import.meta.url),
  JSON.stringify({ wallet: state.wallet, transactionId: id, finalStatus: final.status, message: final.message, stellarTx: final.stellar_transaction_id, receivedXlm: stroopsToXlm(received) }, null, 2) + "\n",
);
if (final.status !== "completed" || received <= 0n) process.exitCode = 1;
