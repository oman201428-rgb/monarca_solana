/**
 * Verifies on mainnet: token (mint), program and that project config matches.
 * Usage: npx ts-node scripts/verificar-mainnet.ts
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const MAINNET = "https://api.mainnet-beta.solana.com";
const MINT_ADDRESS = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const PROGRAM_ID = "97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv";
const MONARCA_DECIMALS = 6;

async function main() {
  const conn = new Connection(MAINNET, "confirmed");
  console.log("=== MAINNET Solana Verification (MONARCA) ===\n");
  console.log("RPC:", MAINNET);

  // 1. Token mint
  console.log("\n--- 1. Token (mint) ---");
  const mintPubkey = new PublicKey(MINT_ADDRESS);
  try {
    const mintInfo = await getMint(conn, mintPubkey);
    console.log("  Mint:", MINT_ADDRESS);
    console.log("  Decimals:", mintInfo.decimals, mintInfo.decimals === MONARCA_DECIMALS ? "(OK, MONARCA=6)" : "(expected 6?)");
    console.log("  Supply:", mintInfo.supply.toString());
    console.log("  Mint authority:", mintInfo.mintAuthority?.toBase58() ?? "null");
    console.log("  Freeze authority:", mintInfo.freezeAuthority?.toBase58() ?? "null");
  } catch (e: unknown) {
    console.log("  ERROR reading mint:", e instanceof Error ? e.message : String(e));
  }

  // 2. Program
  console.log("\n--- 2. Program (Anchor) ---");
  const programPubkey = new PublicKey(PROGRAM_ID);
  try {
    const acc = await conn.getAccountInfo(programPubkey);
    if (acc) {
      console.log("  Program ID:", PROGRAM_ID);
      console.log("  Exists on mainnet: YES");
      console.log("  Executable:", acc.executable);
      console.log("  Owner:", acc.owner.toBase58());
    } else {
      console.log("  Program ID:", PROGRAM_ID);
      console.log("  Exists on mainnet: NO (account not found)");
    }
  } catch (e: unknown) {
    console.log("  ERROR reading program:", e instanceof Error ? e.message : String(e));
  }

  // 3. Program PDA mint (for comparison)
  const [pdaMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    programPubkey
  );
  console.log("\n--- 3. Mint vs program PDA match ---");
  console.log("  Mint in project (MINT_ADDRESS.txt):", MINT_ADDRESS);
  console.log("  PDA(programId, 'mint'):             ", pdaMint.toBase58());
  console.log("  Are they the same?:", MINT_ADDRESS === pdaMint.toBase58() ? "YES" : "NO (token may be SPL or other program)");

  console.log("\n=== End verification ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
