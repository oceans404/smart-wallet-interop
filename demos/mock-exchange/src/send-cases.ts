// Sends each deposit shape from the send checklist to the mock exchange.
import { Keypair, Memo } from "@stellar/stellar-sdk";
import { type CaseResult, classicPayment, loadState, muxed, rpcServer, saveState, sendersFrom, walletTransfer } from "./lib.js";

const state = loadState();
const exchange = Keypair.fromSecret(state.exchangeSecret).publicKey();
const s = sendersFrom(state);

const startLedger = (await rpcServer.getLatestLedger()).sequence;
const cases: CaseResult[] = [];
const record = async (id: number, label: string, amountXlm: string, expected: string | null, run: () => Promise<{ hash: string; ledger: number }>) => {
  const { hash, ledger } = await run();
  cases.push({ id, label, hash, ledger, amountXlm, expected });
  console.log(`case ${id}: ${label}\n  ${hash}`);
};

await record(1, "Classic payment with ID memo 1001", "1", "1001", () => classicPayment(s, exchange, 1_0000000n, Memo.id("1001")));
await record(2, "Classic payment to M address (ID 1002)", "2", "1002", () => classicPayment(s, muxed(exchange, "1002"), 2_0000000n));
await record(3, "Smart wallet transfer to M address (ID 1003)", "3", "1003", () => walletTransfer(s, muxed(exchange, "1003"), 3_0000000n));
await record(4, "Classic payment to M address (ID 1004) that also has memo 9999", "4", "1004", () =>
  classicPayment(s, muxed(exchange, "1004"), 4_0000000n, Memo.id("9999")),
);
await record(5, "Smart wallet transfer to the plain G address", "5", null, () => walletTransfer(s, exchange, 5_0000000n));

saveState({ ...state, startLedger, cases });
