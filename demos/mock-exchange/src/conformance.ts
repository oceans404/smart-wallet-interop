// Conformance check for a real exchange or anchor deposit address on testnet.
// Sends every deposit shape to it, confirms on chain what each one carries, and writes a
// checklist of what a correct deposit system should credit. Uses the sender, relayer and
// smart wallet from `npm run setup`.
//
//   npm run conformance -- --deposit G... --memo-id 1234 [--decoy-memo-id 5678] [--amount 1]
import { Memo } from "@stellar/stellar-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { classicPayment, horizon, loadState, muxed, rpcServer, sendersFrom, stroopsToXlm, walletTransfer } from "./lib.js";
import { trackAfter } from "./tracker-after.js";

const { values } = parseArgs({
  options: {
    deposit: { type: "string" },
    "memo-id": { type: "string" },
    "decoy-memo-id": { type: "string" },
    amount: { type: "string", default: "1" },
  },
});
const deposit = values.deposit;
const memoId = values["memo-id"];
if (!deposit?.startsWith("G") || !memoId || !/^\d+$/.test(memoId)) {
  console.error("Usage: npm run conformance -- --deposit G... --memo-id <uint64> [--decoy-memo-id <uint64>] [--amount <xlm>]");
  process.exit(2);
}
const decoy = values["decoy-memo-id"] ?? String(BigInt(memoId) + 1n);
// Each case sends the base amount plus its case number in stroops, so deposits can be told apart.
const base = BigInt(Math.round(Number(values.amount) * 1e7));
const amountFor = (n: number) => base + BigInt(n);

const target = await horizon.loadAccount(deposit);
const memoRequired = target.data_attr["config.memo_required"] !== undefined;

const s = sendersFrom(loadState());
const m = muxed(deposit, memoId);

interface Case {
  n: number;
  shape: string;
  expected: string;
  send: () => Promise<{ hash: string; ledger: number }>;
}
const cases: Case[] = [
  { n: 1, shape: `Classic payment to G with memo ID ${memoId}`, expected: `credit ${memoId}`, send: () => classicPayment(s, deposit, amountFor(1), Memo.id(memoId)) },
  { n: 2, shape: `Classic payment to M (ID ${memoId}), no memo`, expected: `credit ${memoId}`, send: () => classicPayment(s, m, amountFor(2)) },
  { n: 3, shape: `Smart wallet transfer to M (ID ${memoId})`, expected: `credit ${memoId}`, send: () => walletTransfer(s, m, amountFor(3)) },
  {
    n: 4,
    shape: `Classic payment to M (ID ${memoId}) with memo ID ${decoy}`,
    expected: `credit ${memoId}, not ${decoy}`,
    send: () => classicPayment(s, m, amountFor(4), Memo.id(decoy)),
  },
  { n: 5, shape: "Smart wallet transfer to plain G, no ID", expected: "hold as unattributed (don't credit anyone)", send: () => walletTransfer(s, deposit, amountFor(5)) },
];

const startLedger = (await rpcServer.getLatestLedger()).sequence;
const sent: (Case & { hash: string; ledger: number })[] = [];
for (const c of cases) {
  const res = await c.send();
  sent.push({ ...c, ...res });
  console.log(`case ${c.n}: ${c.shape}\n  https://stellar.expert/explorer/testnet/tx/${res.hash}`);
}

// What the chain says each deposit carries: the transfer event's `to_muxed_id`.
// A correct tracker reads this field, so it's what each case should be credited to.
const { credits } = await trackAfter(deposit, startLedger);
let failures = 0;
const rows = sent.map((c) => {
  const ev = credits.find((x) => x.hash === c.hash);
  const onChain = ev ? (ev.creditedTo ?? "none") : "no event";
  const want = c.n === 5 ? "none" : memoId;
  if (onChain !== want) failures++;
  return `| ${c.n} | ${c.shape} | ${stroopsToXlm(amountFor(c.n))} | ${onChain} | ${c.expected} |`;
});

const report = `# Deposit conformance: ${deposit}

Sent ${new Date().toISOString()} on testnet, from ledger ${startLedger}.

* SEP-29 \`config.memo_required\`: ${memoRequired ? "set" : "**not set**, so wallets won't warn users who forget the memo"}
* Senders: classic \`${s.sender.publicKey()}\`, smart wallet \`${s.wallet}\`

Check each deposit in your system. Every row should be credited as the last column says.

| # | Deposit | XLM | \`to_muxed_id\` on chain | Your system should |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Transactions

${sent.map((c) => `${c.n}. https://stellar.expert/explorer/testnet/tx/${c.hash}`).join("\n")}

## What a failure means

* **1 fails:** your tracker misses classic memo deposits (the baseline).
* **2 fails:** your tracker ignores muxed \`M...\` addresses.
* **3 fails:** your tracker only reads classic payments, so smart wallet deposits are invisible.
* **4 credits ${decoy}:** your tracker reads the memo over the muxed ID and can credit the wrong user.
* **5 credited to someone:** your tracker guesses. It should hold the deposit for manual review.
`;

mkdirSync("reports", { recursive: true });
const file = `reports/conformance-${deposit.slice(0, 8)}-${startLedger}.md`;
writeFileSync(file, report);
console.log(`\nSEP-29 memo_required: ${memoRequired ? "set" : "not set"}`);
console.log(`Report: ${file}`);
if (failures) {
  console.error(`${failures} deposit(s) don't carry the expected ID on chain. This is a bug in this tool, not your exchange.`);
  process.exit(1);
}
