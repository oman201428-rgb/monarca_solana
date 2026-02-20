/**
 * Checks which lists/sources a token is in (Jupiter, CoinGecko, etc.).
 * No assumptions: queries APIs and chain.
 * If fetch fails (e.g. DNS), tries curl as fallback for Jupiter.
 *
 * Usage: npx ts-node scripts/verificar-listados-token.ts [MINT]
 * Example: npx ts-node scripts/verificar-listados-token.ts 38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD
 */

import { execSync } from "child_process";

const MINT_REF = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";

async function fetchJson(url: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return null;
  return res.json();
}

function fetchWithCurl(url: string): unknown {
  try {
    const out = execSync(`curl -sS -m 20 "${url}"`, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
    return JSON.parse(out || "null");
  } catch {
    return null;
  }
}

async function main() {
  console.log("Checking listings (no assumptions)\n");
  console.log("Reference token:", MINT_REF);
  console.log("MNCA (ours): ", MNCA);
  console.log("");

  const results: { fuente: string; ref: boolean; mnca: boolean; detalle?: string }[] = [];

  // 1. Jupiter: strict list (fetch; if it fails, curl)
  const jupStrictUrl = "https://token.jup.ag/strict";
  let strict: Array<{ address?: string }> | null = null;
  try {
    strict = (await fetchJson(jupStrictUrl)) as Array<{ address?: string }> | null;
  } catch {
    strict = fetchWithCurl(jupStrictUrl) as Array<{ address?: string }> | null;
  }
  if (Array.isArray(strict)) {
    const addrs = strict.map((t) => t.address?.toLowerCase()).filter(Boolean);
    results.push({
      fuente: "Jupiter (token.jup.ag/strict)",
      ref: addrs.includes(MINT_REF.toLowerCase()),
      mnca: addrs.includes(MNCA.toLowerCase()),
      detalle: `strict: ${strict.length} tokens`,
    });
  } else {
    results.push({
      fuente: "Jupiter (token.jup.ag/strict)",
      ref: false,
      mnca: false,
      detalle: "not available (fetch and curl failed)",
    });
  }

  // 2. Jupiter: validated list from GitHub (does not depend on token.jup.ag)
  try {
    const csvUrl = "https://raw.githubusercontent.com/jup-ag/token-list/main/validated-tokens.csv";
    const csvRes = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
    const csvText = csvRes.ok ? await csvRes.text() : "";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0] || "";
    const mintCol = header.split(",").map((h) => h.trim()).indexOf("Mint");
    const mintsInList: string[] = [];
    if (mintCol >= 0 && lines.length > 1) {
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts[mintCol]) mintsInList.push(parts[mintCol].trim().toLowerCase());
      }
    }
    results.push({
      fuente: "Jupiter (validated-tokens.csv GitHub)",
      ref: mintsInList.includes(MINT_REF.toLowerCase()),
      mnca: mintsInList.includes(MNCA.toLowerCase()),
      detalle: `validated: ${mintsInList.length} tokens`,
    });
  } catch (e) {
    results.push({
      fuente: "Jupiter (validated-tokens.csv GitHub)",
      ref: false,
      mnca: false,
      detalle: String(e instanceof Error ? e.message : e),
    });
  }

  // 3. Jupiter token.jup.ag/all (optional, may fail DNS)
  const jupAllUrl = "https://token.jup.ag/all";
  let all: Array<{ address?: string }> | null = null;
  try {
    all = (await fetchJson(jupAllUrl)) as Array<{ address?: string }> | null;
  } catch {
    all = fetchWithCurl(jupAllUrl) as Array<{ address?: string }> | null;
  }
  if (Array.isArray(all)) {
    const addrs = all.map((t) => t.address?.toLowerCase()).filter(Boolean);
    results.push({
      fuente: "Jupiter (token.jup.ag/all)",
      ref: addrs.includes(MINT_REF.toLowerCase()),
      mnca: addrs.includes(MNCA.toLowerCase()),
      detalle: `all: ${all.length} tokens`,
    });
  } else {
    results.push({
      fuente: "Jupiter (token.jup.ag/all)",
      ref: false,
      mnca: false,
      detalle: "not available (fetch and curl failed)",
    });
  }

  // 4. Solana Labs token list (official, archived 2022) — many wallets used it historically
  try {
    const solanaListUrl = "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json";
    const listRes = await fetch(solanaListUrl, { signal: AbortSignal.timeout(20000) });
    const listJson = listRes.ok ? (await listRes.json()) as { tokens?: Array<{ address?: string }> } : null;
    const tokens = listJson?.tokens ?? [];
    const addrs = tokens.map((t) => t.address?.toLowerCase()).filter(Boolean);
    results.push({
      fuente: "Solana Labs token-list (GitHub)",
      ref: addrs.includes(MINT_REF.toLowerCase()),
      mnca: addrs.includes(MNCA.toLowerCase()),
      detalle: `tokens: ${addrs.length}`,
    });
  } catch (e) {
    results.push({
      fuente: "Solana Labs token-list (GitHub)",
      ref: false,
      mnca: false,
      detalle: String(e instanceof Error ? e.message : e),
    });
  }

  // 5. CoinGecko: coins/list with solana platforms
  try {
    const list = await fetchJson("https://api.coingecko.com/api/v3/coins/list?include_platform=true") as Array<{ id: string; platforms?: Record<string, string> }> | null;
    if (Array.isArray(list)) {
      const solana = list.filter((c) => c.platforms?.solana);
      const refCoin = solana.find((c) => c.platforms?.solana?.toLowerCase() === MINT_REF.toLowerCase());
      const mncaCoin = solana.find((c) => c.platforms?.solana?.toLowerCase() === MNCA.toLowerCase());
      results.push({
        fuente: "CoinGecko (coins/list)",
        ref: !!refCoin,
        mnca: !!mncaCoin,
        detalle: refCoin ? `id: ${refCoin.id}` : mncaCoin ? `id: ${mncaCoin.id}` : `solana coins: ${solana.length}`,
      });
    } else {
      results.push({ fuente: "CoinGecko (coins/list)", ref: false, mnca: false, detalle: "response is not array" });
    }
  } catch (e) {
    results.push({
      fuente: "CoinGecko (coins/list)",
      ref: false,
      mnca: false,
      detalle: String(e instanceof Error ? e.message : e),
    });
  }

  // 6. CoinGecko: direct coin by contract (Solana)
  try {
    const refCoin = await fetchJson(`https://api.coingecko.com/api/v3/coins/solana/contract/${MINT_REF}`) as { id?: string } | null;
    const mncaCoin = await fetchJson(`https://api.coingecko.com/api/v3/coins/solana/contract/${MNCA}`) as { id?: string } | null;
    results.push({
      fuente: "CoinGecko (coins/solana/contract/<mint>)",
      ref: !!(refCoin && typeof refCoin === "object" && refCoin.id),
      mnca: !!(mncaCoin && typeof mncaCoin === "object" && mncaCoin.id),
      detalle: refCoin?.id ? `id: ${(refCoin as { id: string }).id}` : mncaCoin?.id ? `id: ${(mncaCoin as { id: string }).id}` : undefined,
    });
  } catch (e) {
    results.push({
      fuente: "CoinGecko (contract)",
      ref: false,
      mnca: false,
      detalle: String(e instanceof Error ? e.message : e),
    });
  }

  console.log("=== RESULTS (checked now) ===\n");
  console.log("| Source                          | Ref (38gRb...) | MNCA (ours)     | Detail |");
  console.log("|---------------------------------|----------------|-----------------|---------|");
  for (const r of results) {
    const refStr = r.ref ? "Yes" : "No";
    const mncaStr = r.mnca ? "Yes" : "No";
    const det = (r.detalle || "").slice(0, 40);
    console.log(`| ${r.fuente.padEnd(32)} | ${refStr.padEnd(14)} | ${mncaStr.padEnd(15)} | ${det} |`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
