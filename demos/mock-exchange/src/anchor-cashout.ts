// Smart wallet cash-out against SDF's test anchor (Anchor Platform):
// SEP-45 sign-in as the C account, a SEP-24 withdraw (its web form filled headless),
// then a token transfer to the anchor's account with the memo packed into an M address.
import { Address, Keypair, Operation, authorizeEntry, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { UNBOUNDED_MAX_LENGTH, array } from "@stellar/js-xdr";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { NETWORK, XLM_SAC, invoke, loadState, muxed, walletSigner } from "./lib.js";

const ANCHOR = "https://testanchor.stellar.org";
const AMOUNT_XLM = 2;

const state = loadState();
const relayer = Keypair.fromSecret(state.relayerSecret);
const owner = Keypair.fromSecret(state.ownerSecret);
const entriesType = array(xdr.SorobanAuthorizationEntry.schema, UNBOUNDED_MAX_LENGTH);

async function json(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${res.url}: ${JSON.stringify(body)}`), { body });
  return body;
}

// 1. SEP-45: sign the challenge's auth entry for our C account.
const challenge = await json(await fetch(`${ANCHOR}/sep45/auth?account=${state.wallet}&home_domain=testanchor.stellar.org`));
// SEP-45 names the field `authorization_entries`; the test anchor answers with `authorizationEntries`.
const challengeEntries: string = challenge.authorization_entries ?? challenge.authorizationEntries;
if (!challenge.authorization_entries) console.log("Note: challenge used `authorizationEntries`, not the spec's `authorization_entries`");
const entries = entriesType.decode(Buffer.from(challengeEntries, "base64")).map((w) => xdr.SorobanAuthorizationEntry.fromXdrObject(w));
// Our entry arrives with expiration 0, so we pick one: the same ledger the anchor's own entry uses.
const expirations = entries.map((e) => (e.credentials.type === "sorobanCredentialsAddress" ? e.credentials.address.signatureExpirationLedger : 0));
const expiration = Math.max(...expirations);
const signed = await Promise.all(
  entries.map(async (entry) => {
    const creds = entry.credentials;
    if (creds.type !== "sorobanCredentialsAddress") return entry;
    if (Address.fromScAddress(creds.address.address).toString() !== state.wallet) return entry;
    const sign = async (_preimage: xdr.HashIdPreimage, payload: Uint8Array) => ({ signatureScVal: xdr.ScVal.scvBytes(owner.sign(Buffer.from(payload))) });
    return authorizeEntry(entry, sign, creds.address.signatureExpirationLedger || expiration, NETWORK);
  }),
);
const signedXdr = Buffer.from(entriesType.encode(signed.map((e) => e.toXdrObject()))).toString("base64");
const postToken = (body: Record<string, string>) =>
  fetch(`${ANCHOR}/sep45/auth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
let tokenRes = await postToken({ authorization_entries: signedXdr });
if (!tokenRes.ok) {
  console.log(`Note: spec field name rejected (${tokenRes.status}), retrying with \`authorizationEntries\``);
  tokenRes = await postToken({ authorizationEntries: signedXdr });
}
const { token } = await json(tokenRes);
console.log("SEP-45 sign-in: ok");
const auth = { authorization: `Bearer ${token}` };

// 2. SEP-24 withdraw: the anchor's web form collects the bank details, then the
// transaction record gives the account and per-transaction memo to pay.
const started = await json(
  await fetch(`${ANCHOR}/sep24/transactions/withdraw/interactive`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ asset_code: "native", account: state.wallet, amount: String(AMOUNT_XLM) }),
  }),
);
console.log(`SEP-24 withdraw: id ${started.id}`);
await fillForm(started.url);

const getTx = async () => (await json(await fetch(`${ANCHOR}/sep24/transaction?id=${started.id}`, { headers: auth }))).transaction;
let tx = await getTx();
for (let i = 0; i < 24 && !tx.withdraw_anchor_account; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  tx = await getTx();
}
console.log(`  anchor status: ${tx.status}, pay ${tx.withdraw_anchor_account}, memo ${tx.withdraw_memo_type}:${tx.withdraw_memo}`);
if (!tx.withdraw_anchor_account) throw new Error("The anchor never provided a payment account.");
if (tx.withdraw_memo_type !== "id") {
  console.log("The anchor returned a non-ID memo, which a smart wallet can't send. Stopping here.");
  process.exit(1);
}

// 3. Pay from the smart wallet to the anchor's account with the memo inside an M address.
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

// 4. Watch the anchor's view of the transaction.
const credited = ["pending_anchor", "pending_external", "completed"];
let status = tx.status;
for (let i = 0; i < 36 && !credited.includes(status); i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const next = await getTx();
  if (next.status !== status) console.log(`  anchor status: ${next.status}`);
  status = next.status;
}

mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../fixtures/anchor-cashout.json", import.meta.url),
  JSON.stringify({ wallet: state.wallet, transactionId: started.id, anchorAccount: tx.withdraw_anchor_account, memo: tx.withdraw_memo, destination, txHash: paid.txHash, finalStatus: status }, null, 2) + "\n",
);
if (!credited.includes(status)) process.exitCode = 1;

// Fills the test anchor's SEP-24 reference form in headless Chromium.
async function fillForm(url: string): Promise<void> {
  const chromium = await loadChromium();
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const fields: Record<string, string> = { amount: String(AMOUNT_XLM), name: "Test", surname: "Wallet", email: "smart-wallet@example.com", bank: "Test Bank", account: "1234567890" };
    for (const [name, value] of Object.entries(fields)) {
      const input = page.locator(`input[name="${name}"]`);
      if (await input.count()) await input.fill(value);
    }
    if (process.env.DEBUG_FORM) {
      page.on("response", async (r: any) => { if (["xhr", "fetch"].includes(r.request().resourceType())) console.log("NET", r.request().method(), r.url().slice(0, 100), r.status(), (await r.text().catch(() => "")).slice(0, 300)); });
    }
    await page.getByRole("button", { name: "Submit" }).click();
    await page.getByText("Transaction information").waitFor({ timeout: 30000 }).catch(() => undefined);
    if (process.env.DEBUG_FORM) console.log("PAGE", (await page.locator("body").innerText()).slice(0, 800));
  } finally {
    await browser.close();
  }
}

// Playwright comes preinstalled globally in cloud sessions; use a local copy if there is one.
async function loadChromium(): Promise<any> {
  const name = "playwright";
  try {
    return (await import(name)).chromium;
  } catch {
    const root = execSync("npm root -g").toString().trim();
    const pw = await import(pathToFileURL(`${root}/playwright/index.js`).href);
    return pw.chromium ?? pw.default.chromium;
  }
}
