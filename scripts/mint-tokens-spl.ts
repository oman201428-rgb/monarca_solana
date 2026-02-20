/**
 * Emite tokens MONARCA (MNCA) - equivalente a mint_tokens del contrato.
 * Uso: CLUSTER=mainnet npx ts-node scripts/mint-tokens-spl.ts <cantidad> [destino]
 *
 * Cantidad en unidades con decimales (ej: 1000000 = 1 MNCA con 6 decimals).
 * Destino: dirección del token account o wallet (se crea ATA si no existe).
 */

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import {
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const CLUSTER = process.env.CLUSTER || "devnet";

async function main() {
  const amount = process.argv[2];
  const destArg = process.argv[3];

  if (!amount || isNaN(Number(amount))) {
    console.error("Uso: npx ts-node scripts/mint-tokens-spl.ts <cantidad> [destino]");
    console.error("Ej: npx ts-node scripts/mint-tokens-spl.ts 1000000");
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

  const endpoint =
    CLUSTER === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  const destination = destArg
    ? new PublicKey(destArg)
    : wallet.publicKey;

  const ata = getAssociatedTokenAddressSync(mint, destination);

  let accountInfo = await connection.getAccountInfo(ata);
  const tx = new Transaction();

  if (!accountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ata,
        destination,
        mint
      )
    );
  }

  tx.add(
    createMintToInstruction(
      mint,
      ata,
      wallet.publicKey,
      BigInt(amount)
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  console.log("Tx:", sig);
  console.log("[OK] Minteados", amount, "unidades a", ata.toBase58());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
