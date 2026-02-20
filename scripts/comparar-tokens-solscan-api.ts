/**
 * Compara los dos tokens usando Solscan Pro API (API de Solana).
 * Requiere API key de Solscan (solscan.io → API Management).
 * Header: token: YOUR_API_KEY
 *
 * Uso:
 *   npx ts-node scripts/comparar-tokens-solscan-api.ts [MINT_REF] [API_KEY]
 *   o: SOLSCAN_API_KEY=tu_key npx ts-node scripts/comparar-tokens-solscan-api.ts
 */

const MINT_REF = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
const MNCA = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const API_KEY = process.env.SOLSCAN_API_KEY || process.argv[3];

const SOLSCAN_BASE = "https://pro-api.solscan.io/v2.0";

async function fetchTokenMeta(mint: string): Promise<Record<string, unknown> | null> {
  if (!API_KEY) {
    console.error("Falta API key: SOLSCAN_API_KEY (env) o 3er argumento.");
    console.error("Obtener key: solscan.io → Cuenta → API Management → Generate Key");
    process.exit(1);
  }
  const url = `${SOLSCAN_BASE}/token/meta?address=${mint}`;
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        token: API_KEY,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Solscan API error:", res.status, body);
      if (res.status === 401) {
        if (body.includes("upgrade")) console.error("Tu plan de Solscan Pro no incluye este endpoint. Sube de plan en solscan.io → Resources → API Plans.");
        else console.error("Revisa que la key sea de Solscan Pro (solscan.io → API Management).");
      }
      return null;
    }
    const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> };
    if (json.success === true && json.data) return json.data as Record<string, unknown>;
    return null;
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
  if (typeof v === "object" && v !== null) return JSON.stringify(v).slice(0, 30) + (JSON.stringify(v).length > 30 ? "…" : "");
  return String(v).slice(0, 40);
}

async function main() {
  console.log("=== Comparación con Solscan Pro API (Solana) ===\n");
  console.log("Referencia:", MINT_REF);
  console.log("MNCA:     ", MNCA);
  console.log("");

  const ref = await fetchTokenMeta(MINT_REF);
  const mnca = await fetchTokenMeta(MNCA);

  if (!ref && !mnca) {
    console.log("No se obtuvo dato de ninguno. Revisa API key (Solscan Pro) y red.");
    process.exit(1);
  }

  const keys = [
    "name",
    "symbol",
    "address",
    "icon",
    "decimals",
    "holder",
    "supply",
    "metadata_uri",
    "creator",
    "created_time",
    "price",
    "market_cap",
    "volume_24h",
  ];
  console.log("| Campo         | Referencia      | MNCA (nosotros) |");
  console.log("|---------------|-----------------|-----------------|");
  for (const k of keys) {
    const vRef = get(ref, k);
    const vMnca = get(mnca, k);
    const diff = vRef !== vMnca ? " ←" : "";
    console.log("| " + k.padEnd(13) + " | " + String(vRef).padEnd(15).slice(0, 15) + " | " + String(vMnca).padEnd(15).slice(0, 15) + diff + " |");
  }
  console.log("");

  const refHolder = ref && typeof ref.holder === "number" ? ref.holder : 0;
  const mncaHolder = mnca && typeof mnca.holder === "number" ? mnca.holder : 0;
  const refIcon = ref && ref.icon;
  const mncaIcon = mnca && mnca.icon;

  console.log("=== Diferencias que pueden afectar visibilidad en billeteras ===\n");
  if (refIcon && !mncaIcon) {
    console.log("- Referencia tiene icon en Solscan; MNCA no. Las billeteras pueden usar este icon.");
  }
  if (mncaIcon && !refIcon) {
    console.log("- MNCA tiene icon; referencia no.");
  }
  if (refHolder !== mncaHolder) {
    console.log("- Holders: Ref =", refHolder, ", MNCA =", mncaHolder);
  }
  console.log("(Phantom y otras billeteras leen metadata on-chain Metaplex; Solscan es una fuente de datos adicional.)");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
