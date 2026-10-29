// AFTER: the send kit's deposit tracker.
// Reads token transfer events from RPC and credits by `to_muxed_id`. Since CAP-67 the network
// copies a classic payment's memo into `to_muxed_id`, so this one path handles every deposit.
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { Credit } from "./tracker-before.js";
import { XLM_SAC, rpcServer, stroopsToXlm } from "./lib.js";

export async function trackAfter(exchange: string, startLedger: number): Promise<{ credits: Credit[]; raw: unknown[] }> {
  const topics = [[xdr.ScVal.scvSymbol("transfer").toXDR("base64"), "*", Address.fromString(exchange).toScVal().toXDR("base64"), "*"]];
  const credits: Credit[] = [];
  const raw: unknown[] = [];
  let cursor: string | undefined;
  for (;;) {
    const filters = [{ type: "contract" as const, contractIds: [XLM_SAC], topics }];
    const page = cursor
      ? await rpcServer.getEvents({ cursor, filters, limit: 100 })
      : await rpcServer.getEvents({ startLedger, filters, limit: 100 });
    for (const ev of page.events) {
      const value = scValToNative(ev.value) as bigint | { amount: bigint; to_muxed_id?: bigint | string | Uint8Array };
      const amount = typeof value === "bigint" ? value : value.amount;
      const id = typeof value === "bigint" ? undefined : value.to_muxed_id;
      credits.push({
        hash: ev.txHash,
        amountXlm: stroopsToXlm(amount),
        creditedTo: id === undefined ? null : typeof id === "object" ? Buffer.from(id).toString("hex") : String(id),
      });
      raw.push({ txHash: ev.txHash, ledger: ev.ledger, topics: ev.topic.map((t) => t.toXDR("base64")), value: ev.value.toXDR("base64") });
    }
    if (page.events.length < 100) break;
    cursor = page.cursor;
  }
  return { credits, raw };
}
