// Sends each deposit shape from the send checklist to the exchange.
import { Address, Asset, Keypair, Memo, Operation, nativeToScVal } from "@stellar/stellar-sdk";
import { type CaseResult, XLM_SAC, invoke, loadState, muxed, rpcServer, saveState, submitClassic, walletSigner } from "./lib.js";

const state = loadState();
const exchange = Keypair.fromSecret(state.exchangeSecret).publicKey();
const sender = Keypair.fromSecret(state.senderSecret);
const relayer = Keypair.fromSecret(state.relayerSecret);
const owner = Keypair.fromSecret(state.ownerSecret);

const classicPayment = (destination: string, amount: string, memo?: Memo) =>
  submitClassic(sender, [Operation.payment({ destination, asset: Asset.native(), amount })], memo);

const walletTransfer = async (to: string, amount: bigint) => {
  const res = await invoke(
    relayer,
    Operation.invokeContractFunction({
      contract: XLM_SAC,
      function: "transfer",
      args: [
        Address.fromString(state.wallet).toScVal(),
        Address.fromString(to).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
      ],
    }),
    walletSigner(owner),
  );
  return { hash: res.txHash, ledger: res.ledger };
};

const startLedger = (await rpcServer.getLatestLedger()).sequence;
const cases: CaseResult[] = [];
const record = async (id: number, label: string, amountXlm: string, expected: string | null, run: () => Promise<{ hash: string; ledger: number }>) => {
  const { hash, ledger } = await run();
  cases.push({ id, label, hash, ledger, amountXlm, expected });
  console.log(`case ${id}: ${label}\n  ${hash}`);
};

await record(1, "Classic payment with ID memo 1001", "1", "1001", () => classicPayment(exchange, "1", Memo.id("1001")));
await record(2, "Classic payment to M address (ID 1002)", "2", "1002", () => classicPayment(muxed(exchange, "1002"), "2"));
await record(3, "Smart wallet transfer to M address (ID 1003)", "3", "1003", () => walletTransfer(muxed(exchange, "1003"), 3_0000000n));
await record(4, "Classic payment to M address (ID 1004) that also has memo 9999", "4", "1004", () =>
  classicPayment(muxed(exchange, "1004"), "4", Memo.id("9999")),
);
await record(5, "Smart wallet transfer to the plain G address", "5", null, () => walletTransfer(exchange, 5_0000000n));

saveState({ ...state, startLedger, cases });
