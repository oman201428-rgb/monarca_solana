/**
 * Compara los dos tokens usando Jupiter Token API v2 (requiere API key).
 * Base: https://api.jup.ag — Docs: https://dev.jup.ag/docs
 * Muestra la diferencia real: isVerified, tags, liquidity, etc.
 *
 * Uso (no guardes la key en el repo):
 *   Windows: set JUPITER_API_KEY=tu_key && npx ts-node scripts/comparar-tokens-jupiter-api.ts
 *   Linux/Mac: JUPITER_API_KEY=tu_key npx ts-node scripts/comparar-tokens-jupiter-api.ts
 */

const JUPITER_API_BASE = "https://api.jup.ag";
const MINT_REF = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const API_KEY = process.env.JUPITER_API_KEY || process.argv[3];

async function fetchToken(mint: string): Promise<Record<string, unknown> | null> {
  if (!API_KEY) {
    console.error("Falta API key: JUPITER_API_KEY env o 3er argumento. Ejemplo: npx ts-node scripts/comparar-tokens-jupiter-api.ts " + MINT_REF + " TU_KEY");
    process.exit(1);
  }
  const url = `${JUPITER_API_BASE}/tokens/v2/search?query=${mint}`;
  try {
    const res = await fetch(url, {
      headers: { "x-api-key": API_KEY },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Jupiter API error:", res.status, body);
      if (res.status === 401) console.error("Si la key es un JWT, úsala en x-api-key. Si sigue 401: key expirada, revocada o de otro producto (revisa portal.jup.ag).");
      return null;
    }
    const data = (await res.json()) as { data?: unknown[] };
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const token = list.find((t: Record<string, unknown>) => String(t?.id || t?.address).toLowerCase() === mint.toLowerCase()) || list[0];
    return token as Record<string, unknown> || null;
  } catch (e) {
    console.error("Fetch error:", e);
    return null;
  }
}

function get(obj: Record<string, unknown> | null, key: string): string {
  if (!obj) return "—";
  const v = obj[key];
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.join(", ") || "—";
  return String(v);
}

async function main() {
  console.log("=== Comparación con Jupiter Token API v2 ===\n");
  console.log("Referencia:", MINT_REF);
  console.log("MNCA:     ", MNCA);
  console.log("");

  const ref = await fetchToken(MINT_REF);
  const mnca = await fetchToken(MNCA);

  if (!ref && !mnca) {
    console.log("No se obtuvo dato de ninguno. Revisa API key y red.");
    process.exit(1);
  }

  const keys = ["name", "symbol", "id", "isVerified", "tags", "liquidity", "organicScore", "holderCount", "icon"];
  console.log("| Campo          | Referencia | MNCA (nosotros) |");
  console.log("|----------------|------------|-----------------|");
  for (const k of keys) {
    const vRef = get(ref, k);
    const vMnca = get(mnca, k);
    console.log("| " + k.padEnd(14) + " | " + String(vRef).slice(0, 11).padEnd(11) + " | " + String(vMnca).slice(0, 15) + " |");
  }
  console.log("");

  const refVerified = ref && (ref.isVerified === true || (ref as { verified?: boolean }).verified === true);
  const mncaVerified = mnca && (mnca.isVerified === true || (mnca as { verified?: boolean }).verified === true);

  console.log("=== RAZÓN VERDADERA (según Jupiter API) ===\n");
  if (refVerified && !mncaVerified) {
    console.log("El token de REFERENCIA está verificado en Jupiter (isVerified = true).");
    console.log("MNCA NO está verificado en Jupiter.");
    console.log("Por eso el otro se muestra con badge/prioridad y el nuestro no.");
    console.log("\nAcción: solicitar verificación en https://verify.jup.ag para el mint MNCA.");
  } else if (!refVerified && mncaVerified) {
    console.log("MNCA está verificado; el de referencia no. La diferencia puede ser otra (listas, caché).");
  } else if (refVerified && mncaVerified) {
    console.log("Ambos aparecen como verificados en Jupiter. Comparar tags/liquidity/organicScore arriba.");
  } else {
    console.log("Ninguno aparece como isVerified=true en la respuesta. Revisar 'tags' y otros campos arriba.");
    if (ref) console.log("Ref raw isVerified:", ref.isVerified, "tags:", ref.tags);
    if (mnca) console.log("MNCA raw isVerified:", mnca.isVerified, "tags:", mnca.tags);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
