/**
 * Step 2 of automation: prepare everything so MNCA shows
 * in all wallets with logo and name (like the reference token).
 *
 * - Checks metadata (accessible URI, image that loads)
 * - Validates token-list JSON
 * - Generates line for Jupiter validated-tokens.csv and PR instructions
 * - Prints steps: verify.jup.ag, Solscan, Trust Wallet, CoinGecko, pool
 *
 * Usage: npx ts-node scripts/hacer-token-visible.ts
 */

import * as fs from "fs";
import * as path from "path";

const MNCA_MINT = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const SCRIPTS_DIR = __dirname;

async function checkUrl(url: string, method: "GET" | "HEAD" = "HEAD"): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, { method, signal: AbortSignal.timeout(12000), redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log("=== Make MNCA token visible in wallets ===\n");

  const tokenListPath = path.join(SCRIPTS_DIR, "token-list-monarca.json");
  const metadataPath = path.join(SCRIPTS_DIR, "metadata-monarca.json");

  // 1. Token list
  let tokenList: { name?: string; logoURI?: string; tokens?: Array<{ address?: string; symbol?: string; name?: string; decimals?: number; logoURI?: string }> };
  try {
    tokenList = JSON.parse(fs.readFileSync(tokenListPath, "utf-8"));
  } catch (e) {
    console.error("[ERROR] Could not read token-list-monarca.json:", e);
    process.exitCode = 1;
    return;
  }
  const token = tokenList.tokens?.find((t) => t.address === MNCA_MINT) || tokenList.tokens?.[0];
  const name = token?.name || tokenList.name || "MONARCA";
  const symbol = token?.symbol || "MNCA";
  const decimals = token?.decimals ?? 6;
  const logoURI = token?.logoURI || tokenList.logoURI || "";

  if (!logoURI) {
    console.log("[WARNING] No logoURI in token list.");
  } else {
    const logoCheck = await checkUrl(logoURI, "GET");
    if (logoCheck.ok) {
      console.log("[OK] Logo accessible:", logoURI);
    } else {
      console.log("[WARNING] Logo not accessible:", logoURI, logoCheck.status || logoCheck.error);
    }
  }

  // 2. Metadata JSON (on-chain URI is different; here we only check the local JSON)
  if (fs.existsSync(metadataPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
      const img = meta.image || meta.logoURI;
      if (img && img !== logoURI) {
        const metaImgCheck = await checkUrl(img, "GET");
        console.log(metaImgCheck.ok ? "[OK] Image in metadata accessible" : "[WARNING] Image in metadata not accessible:", img);
      }
    } catch {
      // ignore
    }
  }

  // 3. Line for Jupiter validated-tokens.csv (format: Name,Symbol,Mint,Decimals,LogoURI,Community Validated)
  const csvLine = [name, symbol, MNCA_MINT, String(decimals), logoURI, "false"].map((c) =>
    c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c
  ).join(",");
  const csvPath = path.join(SCRIPTS_DIR, "jupiter-validated-mnca-line.csv");
  fs.writeFileSync(csvPath, "Name,Symbol,Mint,Decimals,LogoURI,Community Validated\n" + csvLine + "\n", "utf-8");
  console.log("\n[OK] Line for Jupiter saved to:", csvPath);
  console.log("Content:");
  console.log(csvLine);

  // 4. Instructions
  console.log("\n--- Steps for MNCA to show in all wallets ---\n");
  console.log("1. JUPITER (validated list)");
  console.log("   - Repo: https://github.com/jup-ag/token-list");
  console.log("   - Add entry in validated-tokens.csv with the line generated above.");
  console.log("   - Option: fork → edit validated-tokens.csv → PR.");
  console.log("   - Logo: must be public URL (IPFS/Pinata is fine if it responds).");
  console.log("");
  console.log("2. VERIFY.JUP.AG");
  console.log("   - Go to https://verify.jup.ag and request verification of mint:", MNCA_MINT);
  console.log("");
  console.log("3. SOLSCAN");
  console.log("   - https://solscan.io/token/" + MNCA_MINT);
  console.log("   - Use 'Token update' / request info update if applicable.");
  console.log("");
  console.log("4. TRUST WALLET");
  console.log("   - https://developer.trustwallet.com/listing/new (Solana).");
  console.log("   - Submit request with mint, name, symbol, decimals, logo URL.");
  console.log("");
  console.log("5. COINGECKO");
  console.log("   - https://www.coingecko.com/en/coins/new (new token listing).");
  console.log("");
  console.log("6. LIQUIDITY POOL (Raydium)");
  console.log("   - Without pool, Jupiter and many wallets will not show price.");
  console.log("   - Run: npx ts-node scripts/crear-pool-raydium-mnca-sol.ts (when ready with SOL).");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
