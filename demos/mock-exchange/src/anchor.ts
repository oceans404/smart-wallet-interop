// Shared plumbing for talking to SDF's test anchor (Anchor Platform) as a smart wallet.
import { Address, Keypair, authorizeEntry, xdr } from "@stellar/stellar-sdk";
import { UNBOUNDED_MAX_LENGTH, array } from "@stellar/js-xdr";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { NETWORK } from "./lib.js";

export const ANCHOR = "https://testanchor.stellar.org";
const entriesType = array(xdr.SorobanAuthorizationEntry.schema, UNBOUNDED_MAX_LENGTH);

export async function json(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`${res.status} ${res.url}: ${JSON.stringify(body)}`), { body });
  return body;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** SEP-45 sign-in for a C account. Returns the bearer auth header. */
export async function sep45SignIn(wallet: string, owner: Keypair): Promise<{ authorization: string }> {
  const challenge = await json(await fetch(`${ANCHOR}/sep45/auth?account=${wallet}&home_domain=testanchor.stellar.org`));
  // SEP-45 names the field `authorization_entries`; the test anchor answers with `authorizationEntries` (ISSUES.md #1).
  const challengeEntries: string = challenge.authorization_entries ?? challenge.authorizationEntries;
  const entries = entriesType.decode(Buffer.from(challengeEntries, "base64")).map((w) => xdr.SorobanAuthorizationEntry.fromXdrObject(w));
  // Our entry arrives with expiration 0 and SEP-45 leaves it to the client: use the anchor's own entry's ledger.
  const expiration = Math.max(...entries.map((e) => (e.credentials.type === "sorobanCredentialsAddress" ? e.credentials.address.signatureExpirationLedger : 0)));
  const signed = await Promise.all(
    entries.map(async (entry) => {
      const creds = entry.credentials;
      if (creds.type !== "sorobanCredentialsAddress" || Address.fromScAddress(creds.address.address).toString() !== wallet) return entry;
      const sign = async (_preimage: xdr.HashIdPreimage, payload: Uint8Array) => ({ signatureScVal: xdr.ScVal.scvBytes(owner.sign(Buffer.from(payload))) });
      return authorizeEntry(entry, sign, creds.address.signatureExpirationLedger || expiration, NETWORK);
    }),
  );
  const signedXdr = Buffer.from(entriesType.encode(signed.map((e) => e.toXdrObject()))).toString("base64");
  const post = (body: Record<string, string>) =>
    fetch(`${ANCHOR}/sep45/auth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let res = await post({ authorization_entries: signedXdr });
  if (!res.ok) res = await post({ authorizationEntries: signedXdr });
  const { token } = await json(res);
  return { authorization: `Bearer ${token}` };
}

/** Starts a SEP-24 interactive deposit or withdraw and fills the anchor's reference form headless. */
export async function sep24Start(
  kind: "deposit" | "withdraw",
  auth: { authorization: string },
  account: string,
  amount: string,
): Promise<string> {
  const started = await json(
    await fetch(`${ANCHOR}/sep24/transactions/${kind}/interactive`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "native", account, amount }),
    }),
  );
  await fillForm(started.url, { amount, name: "Test", surname: "Wallet", email: "smart-wallet@example.com", bank: "Test Bank", account: "1234567890" });
  return started.id;
}

export async function sep24Tx(auth: { authorization: string }, id: string): Promise<any> {
  return (await json(await fetch(`${ANCHOR}/sep24/transaction?id=${id}`, { headers: auth }))).transaction;
}

/** Polls the transaction until `done` holds or ~3 minutes pass, logging status changes. */
export async function waitForTx(auth: { authorization: string }, id: string, done: (tx: any) => boolean): Promise<any> {
  let tx = await sep24Tx(auth, id);
  console.log(`  anchor status: ${tx.status}`);
  for (let i = 0; i < 36 && !done(tx); i++) {
    await sleep(5000);
    const next = await sep24Tx(auth, id);
    if (next.status !== tx.status) console.log(`  anchor status: ${next.status}`);
    tx = next;
  }
  return tx;
}

async function fillForm(url: string, fields: Record<string, string>): Promise<void> {
  const chromium = await loadChromium();
  const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    for (const [name, value] of Object.entries(fields)) {
      const input = page.locator(`input[name="${name}"]`);
      if (await input.count()) await input.fill(value);
    }
    await page.getByRole("button", { name: "Submit" }).click();
    // The form posts asynchronously; wait for the confirmation view before moving on.
    await page.getByText("Transaction information").waitFor({ timeout: 30000 }).catch(() => undefined);
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
