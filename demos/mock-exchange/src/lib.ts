import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  MuxedAccount,
  Networks,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const NETWORK = Networks.TESTNET;
export const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
export const HORIZON_URL = process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";

export const rpcServer = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
export const horizon = new Horizon.Server(HORIZON_URL);

/** The native XLM Stellar Asset Contract. Deposits in this demo are XLM, so no trustlines are needed. */
export const XLM_SAC = Asset.native().contractId(NETWORK);

export interface CaseResult {
  id: number;
  label: string;
  hash: string;
  ledger: number;
  amountXlm: string;
  /** The user ID a correct exchange should credit, or null if the deposit can't be attributed. */
  expected: string | null;
}

export interface State {
  exchangeSecret: string;
  senderSecret: string;
  relayerSecret: string;
  ownerSecret: string;
  wallet: string;
  startLedger?: number;
  cases?: CaseResult[];
}

const STATE_FILE = new URL("../.state.json", import.meta.url);

export function loadState(): State {
  if (!existsSync(STATE_FILE)) throw new Error("No .state.json yet. Run `npm run setup` first.");
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
}

export function saveState(state: State): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

export async function fund(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot failed for ${publicKey}: ${res.status} ${await res.text()}`);
}

/** An exchange deposit address with the user ID packed in (an `M...` address). */
export function muxed(account: string, id: string): string {
  return new MuxedAccount(new Account(account, "0"), id).accountId();
}

export async function submitClassic(
  source: Keypair,
  ops: xdr.Operation[],
  memo?: Memo,
): Promise<{ hash: string; ledger: number }> {
  const account = await horizon.loadAccount(source.publicKey());
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(memo);
  const tx = builder.setTimeout(60).build();
  tx.sign(source);
  const res = await horizon.submitTransaction(tx);
  return { hash: res.hash, ledger: res.ledger };
}

type AuthSigner = (entry: xdr.SorobanAuthorizationEntry, expirationLedger: number) => Promise<xdr.SorobanAuthorizationEntry>;

/**
 * Submits a single InvokeHostFunction op from `source` (the relayer, who pays the fee).
 * When `signAuth` is given, address-credential auth entries from simulation are signed with it,
 * then the transaction is simulated again so the footprint covers `__check_auth`.
 * A send rejected before reaching the ledger (e.g. a stale sequence number right after the
 * previous transaction) is never applied, so it's rebuilt and retried.
 */
export async function invoke(
  source: Keypair,
  op: xdr.Operation,
  signAuth?: AuthSigner,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await invokeOnce(source, op, signAuth);
    } catch (err) {
      if (!(err instanceof RejectedError) || attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

class RejectedError extends Error {}

async function invokeOnce(
  source: Keypair,
  op: xdr.Operation,
  signAuth?: AuthSigner,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const build = async (operation: xdr.Operation) => {
    const account = await rpcServer.getAccount(source.publicKey());
    return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
      .addOperation(operation)
      .setTimeout(60)
      .build();
  };

  let tx = await build(op);
  let sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Simulation failed: ${sim.error}`);

  if (signAuth) {
    const { sequence } = await rpcServer.getLatestLedger();
    const auth = await Promise.all(
      (sim.result?.auth ?? []).map((entry) =>
        entry.credentials.type === "sorobanCredentialsSourceAccount" ? entry : signAuth(entry, sequence + 100),
      ),
    );
    if (op.body.type !== "invokeHostFunction") throw new Error("invoke() expects an InvokeHostFunction op");
    const func = op.body.invokeHostFunctionOp.hostFunction;
    tx = await build(Operation.invokeHostFunction({ func, auth }));
    sim = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`Simulation with auth failed: ${sim.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(source);
  const sent = await rpcServer.sendTransaction(prepared);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new RejectedError(`Send ${sent.status}: ${sent.errorResult?.toXdr("base64") ?? ""}`);
  }
  const final = await rpcServer.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sent.hash} ended as ${final.status}`);
  }
  return final;
}

/** Signs auth entries for the test smart wallet, whose `__check_auth` expects an ed25519 signature of the payload. */
export function walletSigner(owner: Keypair): AuthSigner {
  return (entry, expirationLedger) =>
    authorizeEntry(
      entry,
      async (_preimage, payload) => ({ signatureScVal: xdr.ScVal.scvBytes(owner.sign(Buffer.from(payload))) }),
      expirationLedger,
      NETWORK,
    );
}

/** XLM balance of any address (G or C), read through the token contract. `reader` is any funded account; nothing is submitted. */
export async function xlmBalance(address: string, reader: string): Promise<bigint> {
  const account = await rpcServer.getAccount(reader);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.invokeContractFunction({ contract: XLM_SAC, function: "balance", args: [new Address(address).toScVal()] }))
    .setTimeout(60)
    .build();
  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`balance(${address}) failed`);
  return scValToNative(sim.result.retval) as bigint;
}

export const stroopsToXlm =(stroops: bigint | string): string => (Number(stroops) / 1e7).toFixed(7);
