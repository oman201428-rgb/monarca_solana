/**
 * Quema tokens MONARCA (MNCA) - equivalente a burn_tokens del contrato.
 * Uso: CLUSTER=mainnet npx ts-node scripts/burn-tokens-spl.ts <cantidad> [origen]
 *
 * El signer (wallet) debe ser el dueño del token account.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createBurnInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const CLUSTER = process.env.CLUSTER || "devnet";

async function main() {
  const amount = process.argv[2];
  const sourceArg = process.argv[3];

  if (!amount || isNaN(Number(amount))) {
    console.error("Uso: npx ts-node scripts/burn-tokens-spl.ts <cantidad> [origen]");
    process.exit(1);
  }

  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  const walletPath = path.join(__dirname, "..", "integracion", "id.json");

  if (!fs.existsSync(mintPath) || !fs.existsSync(walletPath)) {
    console.error("Ejecuta primero: npx ts-node scripts/crear-token-spl.ts");
    process.exit(1);
  }

  const mint = new PublicKey(fs.readFileSync(mintPath, "utf-8").trim());
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const source = sourceArg ? new PublicKey(sourceArg) : wallet.publicKey;
  if (sourceArg && !source.equals(wallet.publicKey)) {
    console.error("Solo se puede quemar desde la wallet actual (id.json).");
    console.error("La wallet dueña del token account debe firmar la transacción.");
    process.exit(1);
  }

  const endpoint =
    CLUSTER === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  const sourceAta = getAssociatedTokenAddressSync(mint, source);

  const tx = new Transaction().add(
    createBurnInstruction(
      sourceAta,
      mint,
      wallet.publicKey,
      BigInt(amount)
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  console.log("Tx:", sig);
  console.log("[OK] Quemados", amount, "unidades desde", sourceAta.toBase58());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
