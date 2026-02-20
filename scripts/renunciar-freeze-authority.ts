/**
 * Renounces the FREEZE AUTHORITY of the MNCA token (irreversible: accounts can no longer be frozen).
 * Removes the "Yes Freeze Auth" warning in Jupiter Terminal.
 * Uses the wallet in integracion/id.json as the current authority.
 *
 * Usage: CLUSTER=mainnet npx ts-node scripts/renunciar-freeze-authority.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { setAuthority, AuthorityType } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const MNCA_MINT = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const CLUSTER = process.env.CLUSTER || "mainnet";

async function main() {
  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");

  if (!fs.existsSync(walletPath)) {
    console.error("integracion/id.json not found (wallet with freeze authority)");
    process.exit(1);
  }

  const mintAddress = fs.existsSync(mintPath)
    ? fs.readFileSync(mintPath, "utf-8").trim()
    : MNCA_MINT;

  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const endpoint =
    CLUSTER === "mainnet"
      ? process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, "confirmed");

  console.log("Renounce FREEZE AUTHORITY - MNCA");
  console.log("Mint:", mintAddress);
  console.log("Wallet (current freeze authority):", wallet.publicKey.toBase58());
  console.log("Cluster:", CLUSTER);
  console.log("");
  console.log("⚠️  IRREVERSIBLE: you will no longer be able to freeze token accounts.");
  console.log("    This removes the 'Yes Freeze Auth' warning in Jupiter.");
  console.log("");

  const sig = await setAuthority(
    connection,
    wallet,
    new PublicKey(mintAddress),
    wallet.publicKey,
    AuthorityType.FreezeAccount,
    null
  );

  console.log("[OK] Freeze authority renounced.");
  console.log("Tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
