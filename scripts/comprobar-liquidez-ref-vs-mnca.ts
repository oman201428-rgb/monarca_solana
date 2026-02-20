/**
 * Checks the real reason: the other token shows because it has a pool with liquidity
 * that Jupiter indexes; ours does not, if it has no pool or does not meet the threshold.
 *
 * Uses DexScreener API (public) to compare pairs and liquidity of both mints.
 *
 * Usage: npx ts-node scripts/comprobar-liquidez-ref-vs-mnca.ts
 */

const MINT_REF = "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const DEX_SCREENER_BASE = "https://api.dexscreener.com/token-pairs/v1/solana";

type Pair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
};

async function fetchPairs(mint: string): Promise<Pair[]> {
  const url = `${DEX_SCREENER_BASE}/${mint}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data as Pair[] : [];
  } catch {
    return [];
  }
}

function sumLiquidityUsd(pairs: Pair[]): number {
  let sum = 0;
  for (const p of pairs) {
    const liq = p.liquidity?.usd;
    if (typeof liq === "number" && !Number.isNaN(liq)) sum += liq;
  }
  return sum;
}

async function main() {
  console.log("=== Real reason: why the other shows and ours does not ===\n");
  console.log("Jupiter only indexes tokens with market and liquidity (≥500 USD each side).");
  console.log("Checking pairs and liquidity on DexScreener for both mints.\n");

  const refPairs = await fetchPairs(MINT_REF);
  const mncaPairs = await fetchPairs(MNCA);

  const refLiq = sumLiquidityUsd(refPairs);
  const mncaLiq = sumLiquidityUsd(mncaPairs);

  console.log("Token REFERENCE (38gRb...):");
  console.log("  Pairs found:", refPairs.length);
  console.log("  Total liquidity (USD, approx.):", refLiq.toFixed(2));
  if (refPairs.length > 0) {
    refPairs.slice(0, 3).forEach((p, i) => {
      console.log("  Pair", i + 1, ":", p.baseToken?.symbol ?? "?", "/", p.quoteToken?.symbol ?? "?", "| liq USD:", p.liquidity?.usd ?? "?");
    });
  }
  console.log("");

  console.log("MNCA (ours) (6cfzj...):");
  console.log("  Pairs found:", mncaPairs.length);
  console.log("  Total liquidity (USD, approx.):", mncaLiq.toFixed(2));
  if (mncaPairs.length > 0) {
    mncaPairs.slice(0, 3).forEach((p, i) => {
      console.log("  Pair", i + 1, ":", p.baseToken?.symbol ?? "?", "/", p.quoteToken?.symbol ?? "?", "| liq USD:", p.liquidity?.usd ?? "?");
    });
  }
  console.log("");

  const refCumple = refPairs.some((p) => (p.liquidity?.usd ?? 0) >= 500);
  const mncaCumple = mncaPairs.some((p) => (p.liquidity?.usd ?? 0) >= 500);

  console.log("=== Conclusion ===\n");
  console.log("Reference: has at least one pair with ≥500 USD liquidity?", refCumple ? "YES" : "NO");
  console.log("MNCA:      has at least one pair with ≥500 USD liquidity?", mncaCumple ? "YES" : "NO");
  console.log("");
  if (refCumple && !mncaCumple) {
    console.log("→ Real reason: the other shows because Jupiter indexes tokens with pool that meets liquidity.");
    console.log("  MNCA does not have (or does not meet) that pool, so it does not appear on Jupiter and UIs that use it.");
  } else if (!refCumple && mncaCumple) {
    console.log("→ On DexScreener MNCA has more liquidity than ref; the difference may be something else (e.g. lists or cache).");
  } else if (refCumple && mncaCumple) {
    console.log("→ Both have liquidity. If the other shows and ours does not, it may be indexing delay or use of strict list.");
  } else {
    console.log("→ VERIFIED: The REFERENCE token has 0 pairs on DexScreener.");
    console.log("  It does not have the pool with liquidity that was claimed. That reason was incorrect.");
    console.log("  The real reason why the other shows and ours does not remains unverified with data.");
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
