/**
 * Runs all checks, generates a report and demonstrates the result.
 * If something is not met, tries to identify the true reason.
 *
 * Usage: npx ts-node scripts/ejecutar-comprobaciones-y-informe.ts [MINT_REF]
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const MINT_REF = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const SCRIPTS_DIR = __dirname;
const OUT_FILE = path.join(SCRIPTS_DIR, "INFORME-COMPROBACIONES.txt");

function run(name: string, cmd: string): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 90000,
      cwd: path.dirname(SCRIPTS_DIR),
    });
    return { ok: true, out: (out || "").trim() };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; message?: string };
    const out = (err.stdout || err.message || String(e)).trim();
    return { ok: false, out };
  }
}

async function main() {
  const lines: string[] = [];
  const log = (s: string) => {
    console.log(s);
    lines.push(s);
  };

  log("=== CHECK EXECUTION ===\n");
  log("Reference token: " + MINT_REF);
  log("MNCA:             " + MNCA);
  log("");

  const results: { name: string; ok: boolean; out: string }[] = [];

  // 1. MNCA cumple requisitos Phantom (Metaplex)
  log("[1/5] Check Phantom argument (MNCA has name/symbol/uri/JSON/image)...");
  const r1 = run("comprobar-argumento-phantom", `npx ts-node "${path.join(SCRIPTS_DIR, "comprobar-argumento-phantom.ts")}"`);
  results.push({ name: "Phantom (MNCA Metaplex)", ok: r1.ok, out: r1.out });
  log(r1.ok ? "    OK" : "    FAIL");
  log("");

  // 2. Metadata on-chain ref vs MNCA
  log("[2/5] Metadata on-chain (ref and MNCA: URI, JSON, image)...");
  const r2 = run("verificar-metadata-onchain", `npx ts-node "${path.join(SCRIPTS_DIR, "verificar-metadata-uri-onchain.ts")}" ${MINT_REF}`);
  results.push({ name: "Metadata on-chain ref+MNCA", ok: r2.ok, out: r2.out });
  const refMetaOk = /Reference.*Yes.*Yes.*Yes.*Yes.*Yes/.test(r2.out) || /Ref detail: URI \+ JSON \+ image OK/.test(r2.out);
  const mncaMetaOk = /MNCA detail: URI \+ JSON \+ image OK/.test(r2.out);
  log(r2.ok && refMetaOk && mncaMetaOk ? "    OK (both with complete metadata)" : "    See output below");
  log("");

  // 3. Listados (Jupiter validated, Solana Labs, CoinGecko)
  log("[3/5] Listings (Jupiter validated, Solana Labs, CoinGecko)...");
  const r3 = run("verificar-listados", `npx ts-node "${path.join(SCRIPTS_DIR, "verificar-listados-token.ts")}" ${MINT_REF}`);
  results.push({ name: "Listings", ok: true, out: r3.out });
  const jupValidatedRef = /Jupiter \(validated-tokens\.csv.*\|\s*Yes\s*\|/.test(r3.out) || /Ref \(38gRb\.\.\.\) \| Yes/.test(r3.out);
  const jupValidatedMnca = /MNCA \(ours\) \| Yes/.test(r3.out);
  log("    (informational only; see table in output)");
  log("");

  // 4. Liquidez DexScreener
  log("[4/5] Liquidity (DexScreener) ref vs MNCA...");
  const r4 = run("comprobar-liquidez", `npx ts-node "${path.join(SCRIPTS_DIR, "comprobar-liquidez-ref-vs-mnca.ts")}"`);
  results.push({ name: "Liquidez DexScreener", ok: true, out: r4.out });
  const refPares = (r4.out.match(/Token REFERENCE[\s\S]*?Pairs found:\s*(\d+)/) || [])[1];
  const mncaPares = (r4.out.match(/MNCA \(ours\)[\s\S]*?Pairs found:\s*(\d+)/) || [])[1];
  const refLiq = parseInt(refPares || "0", 10);
  const mncaLiq = parseInt(mncaPares || "0", 10);
  log("    Ref pairs: " + refLiq + " | MNCA pairs: " + mncaLiq);
  log("");

  // 5. On-chain comparison
  log("[5/5] On-chain comparison (mint, authorities, metadata)...");
  const r5 = run("comparar-token", `npx ts-node "${path.join(SCRIPTS_DIR, "comparar-token-con-referencia.ts")}" ${MINT_REF}`);
  results.push({ name: "On-chain comparison", ok: r5.ok, out: r5.out });
  log(r5.ok ? "    OK" : "    FAIL");
  log("");

  // --- SUMMARY AND TRUE REASON ---
  log("=== SUMMARY ===\n");
  const phantomOk = results[0].ok;
  const metaOk = results[1].ok && refMetaOk && mncaMetaOk;
  const liquidezRef = refLiq > 0;
  const liquidezMnca = mncaLiq > 0;

  log("| Check                  | Result    |");
  log("|------------------------|-----------|");
  log("| MNCA meets Phantom     | " + (phantomOk ? "OK" : "FAIL") + " |");
  log("| Metadata ref+MNCA OK   | " + (metaOk ? "OK" : "See output") + " |");
  log("| Ref has DEX pairs      | " + (liquidezRef ? "Yes (" + refLiq + ")" : "No (0)") + " |");
  log("| MNCA has DEX pairs     | " + (liquidezMnca ? "Yes (" + mncaLiq + ")" : "No (0)") + " |");
  log("");

  log("=== TRUE REASON (according to checks) ===\n");

  if (!phantomOk) {
    log("NOT MET: MNCA does not have complete metadata for Phantom (uri, JSON, image).");
    log("Reason: one of the steps in comprobar-argumento-phantom fails. Check URI and metadata JSON.");
  } else if (!metaOk) {
    log("NOT MET: Some token (ref or MNCA) does not have accessible metadata (URI/JSON/image).");
    log("Check output of verificar-metadata-uri-onchain.");
  } else if (liquidezRef && !liquidezMnca) {
    log("DIFFERENCE: Reference token has " + refLiq + " pair(s) on DexScreener; MNCA has 0.");
    log("Possible reason: ref is on an indexed DEX with liquidity; MNCA is not. To match: create pool with liquidity.");
  } else if (!liquidezRef && !liquidezMnca) {
    log("BOTH without pairs on DexScreener (ref=0, MNCA=0).");
    log("The reason the other shows and ours does not is NOT DEX liquidity (neither has it here).");
    log("Manual check on Jupiter: both appear when searching by mint. Difference may be: cached logo, or default lists (Top/Cooking).");
    log("For MNCA to show the same: Metaplex already OK; optional verify.jup.ag for logo; ensure stable image URL.");
  } else {
    log("MNCA meets Metaplex (Phantom). Ref and MNCA with metadata OK. Liquidity: ref=" + refLiq + ", MNCA=" + mncaLiq + ".");
    log("To show everywhere: stable logo URL + optional verify.jup.ag.");
  }

  log("");
  log("=== FULL OUTPUT OF EACH CHECK ===\n");
  results.forEach((r, i) => {
    log("--- " + r.name + " ---");
    log(r.out.slice(0, 2000) + (r.out.length > 2000 ? "\n..." : ""));
    log("");
  });

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf-8");
  console.log("\nReport written to: " + OUT_FILE);
  process.exit(phantomOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
