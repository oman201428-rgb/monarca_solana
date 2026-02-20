/**
 * Compares the MNCA token with another token (reference) on Solana.
 * Shows differences in: authorities, decimals, supply, metadata (Metaplex).
 *
 * Usage: npx ts-node scripts/comparar-token-con-referencia.ts [MINT_REFERENCIA]
 * Example: npx ts-node scripts/comparar-token-con-referencia.ts 38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const MNCA_MINT = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function metadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );
  return pda;
}

async function hasMetadata(connection: Connection, mint: PublicKey): Promise<boolean> {
  try {
    const pda = metadataPDA(mint);
    const account = await connection.getAccountInfo(pda);
    return !!(account?.data && account.data.length > 0);
  } catch {
    return false;
  }
}

async function main() {
  const refMint = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
  const connection = new Connection(RPC, "confirmed");

  console.log("Comparing tokens on Solana mainnet\n");
  console.log("MNCA:     ", MNCA_MINT);
  console.log("Reference:", refMint);
  console.log("");

  const mncaPubkey = new PublicKey(MNCA_MINT);
  const refPubkey = new PublicKey(refMint);

  let mintMnca, mintRef;
  try {
    mintMnca = await getMint(connection, mncaPubkey);
  } catch (e) {
    console.error("Error reading MNCA mint:", e);
    process.exit(1);
  }
  try {
    mintRef = await getMint(connection, refPubkey);
  } catch (e) {
    console.error("Error reading reference mint:", e);
    process.exit(1);
  }

  const hasMetaMnca = await hasMetadata(connection, mncaPubkey);
  const hasMetaRef = await hasMetadata(connection, refPubkey);

  console.log("=== ON-CHAIN DATA (getMint) ===\n");
  console.log("| Attribute         | MNCA (ours)         | Reference            |");
  console.log("|-------------------|----------------------|----------------------|");
  console.log(
    "| Decimals          |",
    String(mintMnca.decimals).padEnd(20),
    "|",
    String(mintRef.decimals).padEnd(20),
    "|"
  );
  console.log(
    "| Supply            |",
    mintMnca.supply.toString().padEnd(20),
    "|",
    mintRef.supply.toString().padEnd(20),
    "|"
  );
  console.log(
    "| Mint authority    |",
    (mintMnca.mintAuthority ? mintMnca.mintAuthority.toBase58() : "null (renounced)").padEnd(20),
    "|",
    (mintRef.mintAuthority ? mintRef.mintAuthority.toBase58() : "null (renounced)").padEnd(20),
    "|"
  );
  console.log(
    "| Freeze authority  |",
    (mintMnca.freezeAuthority ? mintMnca.freezeAuthority.toBase58() : "null (renounced)").padEnd(20),
    "|",
    (mintRef.freezeAuthority ? mintRef.freezeAuthority.toBase58() : "null (renounced)").padEnd(20),
    "|"
  );

  console.log("\n=== METADATA (Metaplex on-chain) ===\n");
  console.log("| Token      | Has metadata? |");
  console.log("|------------|---------------|");
  console.log("| MNCA       |", hasMetaMnca ? "Yes" : "No");
  console.log("| Reference  |", hasMetaRef ? "Yes" : "No");

  console.log("\n=== DIFFERENCES (what we lack vs reference) ===\n");
  const diffs: string[] = [];
  if (mintMnca.mintAuthority && !mintRef.mintAuthority) {
    diffs.push("Mint authority: reference has mint authority RENOUNCED (null). We still have active mint authority → JupShield marks it as warning.");
  }
  if (mintMnca.freezeAuthority && !mintRef.freezeAuthority) {
    diffs.push("Freeze authority: reference has freeze authority RENOUNCED (null). We still have active freeze authority → JupShield marks it as warning.");
  }
  if (!mintMnca.mintAuthority && mintRef.mintAuthority) {
    diffs.push("Mint authority: we already have it renounced; reference does not.");
  }
  if (!mintMnca.freezeAuthority && mintRef.freezeAuthority) {
    diffs.push("Freeze authority: we already have it renounced; reference does not.");
  }
  if (!hasMetaMnca && hasMetaRef) {
    diffs.push("Metadata: reference has Metaplex on-chain metadata. We do not (or not found).");
  }
  if (hasMetaMnca && !hasMetaRef) {
    diffs.push("Metadata: we have metadata; reference does not (or not found).");
  }
  if (diffs.length === 0) {
    console.log("In on-chain data (authorities and metadata) there are no clear differences that explain verification.");
    console.log("Verification on Jupiter/Solscan depends on: request at verify.jup.ag / solscan.io/token-update, age, liquidity, holders.");
  } else {
    diffs.forEach((d, i) => console.log(`${i + 1}. ${d}`));
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
