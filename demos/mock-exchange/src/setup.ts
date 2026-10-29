// Creates the testnet actors: an exchange deposit account, a classic sender,
// a relayer (pays fees), and a test smart wallet funded with XLM.
import { Address, Keypair, Operation, hash, nativeToScVal } from "@stellar/stellar-sdk";
import { readFileSync } from "node:fs";
import { XLM_SAC, fund, invoke, saveState, submitClassic } from "./lib.js";

const WASM = new URL("../contract/target/wasm32v1-none/release/test_wallet.wasm", import.meta.url);

const exchange = Keypair.random();
const sender = Keypair.random();
const relayer = Keypair.random();
const owner = Keypair.random();

await Promise.all([exchange, sender, relayer].map((kp) => fund(kp.publicKey())));
console.log(`exchange ${exchange.publicKey()}\nsender   ${sender.publicKey()}\nrelayer  ${relayer.publicKey()}`);

// SEP-29: tell wallets this deposit account needs a memo (or a muxed ID).
await submitClassic(exchange, [Operation.manageData({ name: "config.memo_required", value: "1" })]);

const wasm = readFileSync(WASM);
await invoke(relayer, Operation.uploadContractWasm({ wasm }));
const created = await invoke(
  relayer,
  Operation.createCustomContract({
    address: Address.fromString(relayer.publicKey()),
    wasmHash: hash(wasm),
    salt: Keypair.random().rawPublicKey(),
    constructorArgs: [nativeToScVal(owner.rawPublicKey(), { type: "bytes" })],
  }),
);
const wallet = Address.fromScVal(created.returnValue!).toString();
console.log(`wallet   ${wallet}`);

// Give the smart wallet 100 XLM through the token contract.
await invoke(
  relayer,
  Operation.invokeContractFunction({
    contract: XLM_SAC,
    function: "transfer",
    args: [
      Address.fromString(relayer.publicKey()).toScVal(),
      Address.fromString(wallet).toScVal(),
      nativeToScVal(100_0000000n, { type: "i128" }),
    ],
  }),
);

saveState({
  exchangeSecret: exchange.secret(),
  senderSecret: sender.secret(),
  relayerSecret: relayer.secret(),
  ownerSecret: owner.secret(),
  wallet,
});
console.log("setup done");

