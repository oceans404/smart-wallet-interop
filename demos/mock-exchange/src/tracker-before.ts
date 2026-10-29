// BEFORE: a typical exchange deposit tracker.
// Watches classic payment operations on Horizon and credits by the transaction memo.
// Smart wallet deposits are contract calls, so it never sees them.
import { horizon } from "./lib.js";

export interface Credit {
  hash: string;
  amountXlm: string;
  creditedTo: string | null;
}

const CLASSIC_PAYMENTS = new Set(["payment", "path_payment_strict_receive", "path_payment_strict_send"]);

export async function trackBefore(exchange: string, startLedger: number): Promise<Credit[]> {
  const credits: Credit[] = [];
  let page = await horizon.payments().forAccount(exchange).join("transactions").order("asc").limit(200).call();
  while (page.records.length > 0) {
    for (const op of page.records) {
      if (!CLASSIC_PAYMENTS.has(op.type)) continue;
      const tx = await op.transaction();
      if (tx.ledger_attr < startLedger || !("to" in op) || op.to !== exchange) continue;
      credits.push({
        hash: op.transaction_hash,
        amountXlm: op.amount,
        creditedTo: tx.memo_type === "id" ? (tx.memo ?? null) : null,
      });
    }
    page = await page.next();
  }
  return credits;
}
