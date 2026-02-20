/**
 * Checks for both tokens (reference and MNCA): on-chain metadata URI,
 * whether the URI is accessible, whether the JSON has name/symbol/image and whether the image loads.
 * No assumptions: only what is checked is reported.
 *
 * Usage: npx ts-node scripts/verificar-metadata-uri-onchain.ts [MINT_REF]
 */

import { Connection, PublicKey } from "@solana/web3.js";

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

/** Reads string with u32 LE prefix (Borsh) from data starting at offset. Returns [value, nextOffset]. */
function readBorshString(data: Buffer, offset: number): [string, number] {
  if (offset + 4 > data.length) return ["", offset];
  const len = data.readUInt32LE(offset);
  const end = offset + 4 + len;
  if (end > data.length) return ["", offset];
  const s = data.subarray(offset + 4, end).toString("utf-8");
  return [s, end];
}

/** Data extracted from the Metadata account (Metaplex): name, symbol, on-chain uri. */
function getMetadataFromAccount(data: Buffer): { name: string; symbol: string; uri: string } | null {
  if (data.length < 65) return null;
  let offset = 1 + 32 + 32; // key + update_authority + mint
  const [name, off1] = readBorshString(data, offset);
  const [symbol, off2] = readBorshString(data, off1);
  const [uri] = readBorshString(data, off2);
  const u = (uri && uri.replace(/\0+$/, "").trim()) || "";
  if (!u) return null;
  const trim = (s: string) => s.replace(/\0+$/, "").trim();
  return { name: trim(name || ""), symbol: trim(symbol || ""), uri: u };
}

async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(12000), redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkToken(
  connection: Connection,
  mintStr: string,
  label: string
): Promise<{
  tieneMetadata: boolean;
  onChainName: string | null;
  onChainSymbol: string | null;
  uri: string | null;
  uriAccesible: boolean | null;
  jsonTieneNameSymbolImage: boolean | null;
  imagenCarga: boolean | null;
  detalle: string;
}> {
  const mint = new PublicKey(mintStr);
  const pda = metadataPDA(mint);
  let account;
  try {
    account = await connection.getAccountInfo(pda);
  } catch {
    return {
      tieneMetadata: false,
      onChainName: null,
      onChainSymbol: null,
      uri: null,
      uriAccesible: null,
      jsonTieneNameSymbolImage: null,
      imagenCarga: null,
      detalle: "Error reading metadata account",
    };
  }
  if (!account?.data?.length) {
    return {
      tieneMetadata: false,
      onChainName: null,
      onChainSymbol: null,
      uri: null,
      uriAccesible: null,
      jsonTieneNameSymbolImage: null,
      imagenCarga: null,
      detalle: "No metadata account",
    };
  }
  const meta = getMetadataFromAccount(account.data);
  if (!meta) {
    return {
      tieneMetadata: true,
      onChainName: null,
      onChainSymbol: null,
      uri: null,
      uriAccesible: null,
      jsonTieneNameSymbolImage: null,
      imagenCarga: null,
      detalle: "Metadata exists but could not extract name/symbol/URI",
    };
  }
  const { name: onChainName, symbol: onChainSymbol, uri } = meta;
  const uriCheck = await checkUrl(uri);
  if (!uriCheck.ok) {
    return {
      tieneMetadata: true,
      onChainName,
      onChainSymbol,
      uri,
      uriAccesible: false,
      jsonTieneNameSymbolImage: null,
      imagenCarga: null,
      detalle: `URI not accessible: ${uriCheck.status ?? uriCheck.error}`,
    };
  }
  type JsonMeta = { name?: string; symbol?: string; image?: string; logoURI?: string };
  let json: JsonMeta | null = null;
  try {
    const jsonRes = await fetch(uri, { signal: AbortSignal.timeout(10000) });
    if (jsonRes.ok) json = (await jsonRes.json()) as JsonMeta;
  } catch {
    // ignore
  }
  const hasNameSymbolImage =
    !!json &&
    typeof json.name === "string" &&
    json.name.length > 0 &&
    typeof json.symbol === "string" &&
    json.symbol.length > 0 &&
    typeof (json.image ?? json.logoURI) === "string";
  const imageUrl = json?.image ?? json?.logoURI ?? "";
  let imagenCarga: boolean | null = null;
  if (imageUrl) {
    const imgCheck = await checkUrl(imageUrl);
    imagenCarga = imgCheck.ok;
  }
  return {
    tieneMetadata: true,
    onChainName,
    onChainSymbol,
    uri,
    uriAccesible: true,
    jsonTieneNameSymbolImage: hasNameSymbolImage,
    imagenCarga,
    detalle: imagenCarga === true ? "URI + JSON + image OK" : imagenCarga === false ? "Image does not load" : "JSON without image/logoURI",
  };
}

async function main() {
  const refMint = process.argv[2] || "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD";
  const connection = new Connection(RPC, "confirmed");

  console.log("On-chain metadata check (URI → JSON → image)\n");
  console.log("Reference:", refMint);
  console.log("MNCA:     ", MNCA_MINT);
  console.log("");

  const refResult = await checkToken(connection, refMint, "Ref");
  const mncaResult = await checkToken(connection, MNCA_MINT, "MNCA");

  console.log("=== RESULTS (checked only) ===\n");
  console.log("| Criterion               | Reference | MNCA (ours) |");
  console.log("|-------------------------|------------|-----------------|");
  console.log(
    "| Has metadata on-chain   |",
    refResult.tieneMetadata ? "Yes" : "No",
    "|",
    mncaResult.tieneMetadata ? "Yes" : "No",
    "|"
  );
  console.log(
    "| Name on-chain           |",
    (refResult.onChainName ?? "-").slice(0, 12).padEnd(12),
    "|",
    (mncaResult.onChainName ?? "-").slice(0, 12).padEnd(12),
    "|"
  );
  console.log(
    "| Symbol on-chain         |",
    (refResult.onChainSymbol ?? "-").slice(0, 12).padEnd(12),
    "|",
    (mncaResult.onChainSymbol ?? "-").slice(0, 12).padEnd(12),
    "|"
  );
  console.log(
    "| URI extracted           |",
    refResult.uri ? "Yes" : "No",
    "|",
    mncaResult.uri ? "Yes" : "No",
    "|"
  );
  console.log(
    "| URI accessible (HTTP)   |",
    refResult.uriAccesible === null ? "?" : refResult.uriAccesible ? "Yes" : "No",
    "|",
    mncaResult.uriAccesible === null ? "?" : mncaResult.uriAccesible ? "Yes" : "No",
    "|"
  );
  console.log(
    "| JSON name/symbol/image  |",
    refResult.jsonTieneNameSymbolImage === null ? "?" : refResult.jsonTieneNameSymbolImage ? "Yes" : "No",
    "|",
    mncaResult.jsonTieneNameSymbolImage === null ? "?" : mncaResult.jsonTieneNameSymbolImage ? "Yes" : "No",
    "|"
  );
  console.log(
    "| Image loads             |",
    refResult.imagenCarga === null ? "?" : refResult.imagenCarga ? "Yes" : "No",
    "|",
    mncaResult.imagenCarga === null ? "?" : mncaResult.imagenCarga ? "Yes" : "No",
    "|"
  );
  console.log("");
  if (refResult.onChainName != null) console.log("Ref name on-chain:", refResult.onChainName);
  if (refResult.onChainSymbol != null) console.log("Ref symbol on-chain:", refResult.onChainSymbol);
  if (refResult.uri) console.log("Ref URI:", refResult.uri);
  if (mncaResult.onChainName != null) console.log("MNCA name on-chain:", mncaResult.onChainName);
  if (mncaResult.onChainSymbol != null) console.log("MNCA symbol on-chain:", mncaResult.onChainSymbol);
  if (mncaResult.uri) console.log("MNCA URI:", mncaResult.uri);
  console.log("");
  console.log("Ref detail:", refResult.detalle);
  console.log("MNCA detail:", mncaResult.detalle);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
