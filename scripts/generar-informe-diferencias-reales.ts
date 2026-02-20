/**
 * Genera el informe de diferencias entre el token de referencia y MNCA.
 * Solo incluye lo COMPROBADO; lo no comprobado se lista explícitamente.
 * No emite conclusión real sin respaldo: indica qué faltaría para ello.
 *
 * Escribe en: solana/scripts/DIFERENCIAS-REALES.md
 *
 * Uso: npx ts-node scripts/generar-informe-diferencias-reales.ts [MINT_REF]
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const MINT_REF = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const OUT_FILE = path.join(__dirname, "DIFERENCIAS-REALES.md");

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 90000 });
  } catch (e) {
    return (e as { stdout?: string; message?: string }).stdout || (e as Error).message || String(e);
  }
}

async function main() {
  const scriptsDir = __dirname;

  console.log("Generando informe (solo comprobado, sin conclusiones no respaldadas)...\n");
  console.log("1. Comparación on-chain (mint, autoridades, metadata)...");
  const compararOut = run(`npx ts-node "${path.join(scriptsDir, "comparar-token-con-referencia.ts")}" ${MINT_REF}`);
  console.log("2. Listados (Jupiter validated, Jupiter strict/all, Solana Labs, CoinGecko)...");
  const listadosOut = run(`npx ts-node "${path.join(scriptsDir, "verificar-listados-token.ts")}" ${MINT_REF}`);
  console.log("3. Metadata on-chain (URI → JSON → imagen)...");
  const metadataOut = run(`npx ts-node "${path.join(scriptsDir, "verificar-metadata-uri-onchain.ts")}" ${MINT_REF}`);

  const lines: string[] = [];
  lines.push("# Diferencias entre token de referencia y MNCA — informe basado solo en comprobaciones realizadas");
  lines.push("");
  lines.push("Token referencia: `" + MINT_REF + "`. MNCA: `" + MNCA + "`.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 1. Qué SÍ se comprobó (resultado real)");
  lines.push("");
  lines.push("Las siguientes fuentes o criterios fueron comprobados en esta ejecución. El resultado es el que se muestra en las salidas de los scripts (secciones 3, 4 y 5).");
  lines.push("");
  lines.push("| Tipo | Qué se comprobó | Dónde ver resultado |");
  lines.push("|------|-----------------|---------------------|");
  lines.push("| On-chain | Mint (decimals, supply, mint/freeze authority), existencia de cuenta Metaplex metadata | Salida comparación on-chain (abajo) |");
  lines.push("| Listados | Jupiter validated-tokens.csv (GitHub), Jupiter token.jup.ag/strict, Jupiter token.jup.ag/all, Solana Labs token-list (GitHub), CoinGecko coins/list, CoinGecko contract | Salida listados (abajo) |");
  lines.push("| Metadata | Para ambos mints: URI en cuenta on-chain, URI accesible, JSON con name/symbol/image, imagen que carga | Salida metadata URI on-chain (abajo) |");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 2. Qué NO se comprobó (limitación o no disponible)");
  lines.push("");
  lines.push("Lo siguiente **no** se pudo comprobar en esta ejecución. Por tanto, no se puede usar para afirmar ni negar por qué el otro token se muestra en todas las billeteras.");
  lines.push("");
  lines.push("- **Jupiter token.jup.ag/strict y token.jup.ag/all**: si en tu red falla el acceso (p. ej. DNS), aquí aparecerán como \"no disponible\". No se puede concluir si el token de referencia está o no en esas listas sin poder consultarlas.");
  lines.push("- **Lista exacta que usa cada wallet (Phantom, Solflare, Trust, etc.)**: no se ha comprobado en este informe qué lista o API usa cada una. Phantom documenta uso de Metaplex on-chain; otras wallets pueden usar además listas propias o de terceros.");
  lines.push("- **Jupiter Catdet List (catdetlist.jup.ag)** y otras listas V2/V3 de Jupiter: no se han consultado en este script.");
  lines.push("- **Pool de liquidez / volumen / precio**: no se ha comprobado si el token de referencia tiene pool o volumen que explique visibilidad en UIs.");
  lines.push("");
  lines.push("**Para poder emitir una conclusión real** sobre por qué el otro token se muestra en todas las billeteras y MNCA no, haría falta al menos:");
  lines.push("1. Poder consultar Jupiter token.jup.ag/strict y token.jup.ag/all (o listas equivalentes) y ver si el mint de referencia aparece y el de MNCA no.");
  lines.push("2. Conocer o comprobar qué fuente usa cada wallet que \"muestra\" el otro token (listas, Metaplex solo, etc.).");
  lines.push("3. No afirmar conclusiones que dependan de fuentes no comprobadas.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 3. Salida: comparación on-chain");
  lines.push("");
  lines.push("```");
  lines.push(compararOut.trim());
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 4. Salida: listados");
  lines.push("");
  lines.push("```");
  lines.push(listadosOut.trim());
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## 5. Salida: metadata on-chain (URI → JSON → imagen)");
  lines.push("");
  lines.push("```");
  lines.push(metadataOut.trim());
  lines.push("```");
  lines.push("");

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf-8");
  console.log("\n[OK] Informe escrito en:", OUT_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
