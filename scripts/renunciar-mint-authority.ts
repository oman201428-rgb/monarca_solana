/**
 * Renounces the MINT AUTHORITY of the MNCA token (irreversible: no more tokens can be minted).
 * Uses the wallet in integracion/id.json as the current authority.
 *
 * Usage: CLUSTER=mainnet npx ts-node scripts/renunciar-mint-authority.ts
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
    console.error("integracion/id.json not found (wallet with authority)");
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
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, "confirmed");

  console.log("Renounce MINT AUTHORITY - MNCA");
  console.log("Mint:", mintAddress);
  console.log("Wallet (current authority):", wallet.publicKey.toBase58());
  console.log("Cluster:", CLUSTER);
  console.log("");
  console.log("⚠️  IRREVERSIBLE: you will no longer be able to mint more tokens.");
  console.log("");

  const sig = await setAuthority(
    connection,
    wallet,
    new PublicKey(mintAddress),
    wallet.publicKey,
    AuthorityType.MintTokens,
    null
  );

  console.log("[OK] Mint authority renounced.");
  console.log("Tx:", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
