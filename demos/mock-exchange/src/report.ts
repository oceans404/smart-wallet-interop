// Runs both trackers over the sent cases and prints what each one credited.
import { Keypair } from "@stellar/stellar-sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadState } from "./lib.js";
import { trackAfter } from "./tracker-after.js";
import { type Credit, trackBefore } from "./tracker-before.js";

const state = loadState();
if (!state.cases || state.startLedger === undefined) throw new Error("No cases yet. Run `npm run send` first.");
const exchange = Keypair.fromSecret(state.exchangeSecret).publicKey();

const before = await trackBefore(exchange, state.startLedger);
const after = await trackAfter(exchange, state.startLedger);

const outcome = (credits: Credit[], hash: string): string => {
  const credit = credits.find((c) => c.hash === hash);
  if (!credit) return "not seen";
  return credit.creditedTo === null ? "unattributed" : `credited ${credit.creditedTo}`;
};

const rows = state.cases.map((c) => {
  const b = outcome(before, c.hash);
  const a = outcome(after.credits, c.hash);
  const ok = c.expected === null ? a === "unattributed" : a === `credited ${c.expected}`;
  return { ...c, before: b, after: a, ok };
});

const table = [
  "| # | Deposit | Expected | Before | After |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.id} | ${r.label} | ${r.expected ?? "unattributed"} | ${r.before} | ${r.after}${r.ok ? "" : " (mismatch)"} |`),
].join("\n");
console.log(table);

const fixtures = new URL("../fixtures/", import.meta.url);
mkdirSync(fixtures, { recursive: true });
writeFileSync(new URL("results.md", fixtures), `${table}\n\nExchange: \`${exchange}\`\n\n${rows.map((r) => `* Case ${r.id}: https://stellar.expert/explorer/testnet/tx/${r.hash}`).join("\n")}\n`);
writeFileSync(new URL("transfer-events.json", fixtures), JSON.stringify({ exchange, cases: state.cases, events: after.raw }, null, 2) + "\n");

if (rows.some((r) => !r.ok)) process.exitCode = 1;
