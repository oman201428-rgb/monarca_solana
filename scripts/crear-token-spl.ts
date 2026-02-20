/**
 * Crea el token MONARCA (MNCA) usando SPL Token estándar.
 * Coste: ~0.01 SOL (rent del mint) vs ~1.4 SOL si desplegamos programa custom.
 *
 * Uso: CLUSTER=mainnet npx ts-node scripts/crear-token-spl.ts
 *
 * Guarda el mint en integracion/MINT_ADDRESS.txt para los demás scripts.
 * 6 decimales, alineado con el contrato Ethereum.
 */

import { Connection, Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const MONARCA_DECIMALS = 6;
const CLUSTER = process.env.CLUSTER || "devnet";

async function main() {
  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  if (fs.existsSync(mintPath)) {
    console.error("Token ya existe. Mint en", mintPath);
    console.error("Para crear uno nuevo, elimina integracion/MINT_ADDRESS.txt e integracion/mint-keypair.json");
    process.exit(1);
  }

  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("No se encontró integracion/id.json");
    process.exit(1);
  }

  const walletKeypair = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletKeypair));

  const endpoint =
    CLUSTER === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  const mintKeypair = Keypair.generate();

  console.log("Cluster:", CLUSTER);
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Decimals:", MONARCA_DECIMALS);
  console.log("");

  const mint = await createMint(
    connection,
    wallet,
    wallet.publicKey,
    wallet.publicKey,
    MONARCA_DECIMALS,
    mintKeypair
  );

  console.log("Mint:", mint.toBase58());
  console.log("[OK] Token MONARCA (MNCA) creado");

  fs.writeFileSync(mintPath, mint.toBase58(), "utf-8");
  console.log("Mint guardado en integracion/MINT_ADDRESS.txt");

  const keypairPath = path.join(__dirname, "..", "integracion", "mint-keypair.json");
  fs.writeFileSync(keypairPath, JSON.stringify(Array.from(mintKeypair.secretKey)), "utf-8");
  console.log("Keypair del mint en integracion/mint-keypair.json (para mintear después)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
