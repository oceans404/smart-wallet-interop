// SEND to an anchor: smart wallet cash-out against SDF's test anchor (Anchor Platform).
// SEP-45 sign-in as the C account, a SEP-24 withdraw, then a token transfer to the
// anchor's account with the per-transaction memo packed into an M address.
import { Address, Keypair, Operation, nativeToScVal } from "@stellar/stellar-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { sep24Start, sep45SignIn, waitForTx } from "./anchor.js";
import { XLM_SAC, invoke, loadState, muxed, walletSigner } from "./lib.js";

const AMOUNT_XLM = 2;
const state = loadState();
const relayer = Keypair.fromSecret(state.relayerSecret);
const owner = Keypair.fromSecret(state.ownerSecret);

const auth = await sep45SignIn(state.wallet, owner);
console.log("SEP-45 sign-in: ok");
const id = await sep24Start("withdraw", auth, state.wallet, String(AMOUNT_XLM));
console.log(`SEP-24 withdraw: id ${id}`);

const tx = await waitForTx(auth, id, (t) => Boolean(t.withdraw_anchor_account));
console.log(`  pay ${tx.withdraw_anchor_account}, memo ${tx.withdraw_memo_type}:${tx.withdraw_memo}`);
if (!tx.withdraw_anchor_account) throw new Error("The anchor never provided a payment account.");
if (tx.withdraw_memo_type !== "id") throw new Error("The anchor returned a non-ID memo, which a smart wallet can't send.");

const destination = muxed(tx.withdraw_anchor_account, tx.withdraw_memo);
const paid = await invoke(
  relayer,
  Operation.invokeContractFunction({
    contract: XLM_SAC,
    function: "transfer",
    args: [Address.fromString(state.wallet).toScVal(), Address.fromString(destination).toScVal(), nativeToScVal(BigInt(AMOUNT_XLM * 1e7), { type: "i128" })],
  }),
  walletSigner(owner),
);
console.log(`Paid ${AMOUNT_XLM} XLM to ${destination}\n  https://stellar.expert/explorer/testnet/tx/${paid.txHash}`);

const credited = ["pending_anchor", "pending_external", "completed"];
const final = await waitForTx(auth, id, (t) => credited.includes(t.status));

mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../fixtures/anchor-cashout.json", import.meta.url),
  JSON.stringify({ wallet: state.wallet, transactionId: id, anchorAccount: tx.withdraw_anchor_account, memo: tx.withdraw_memo, destination, txHash: paid.txHash, finalStatus: final.status }, null, 2) + "\n",
);
if (!credited.includes(final.status)) process.exitCode = 1;
