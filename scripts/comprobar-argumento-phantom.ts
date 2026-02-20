/**
 * Verifies that the argument is real and works:
 * "Phantom displays tokens using Metaplex on-chain (name, symbol, uri → JSON with image)."
 *
 * Simulates the same steps Phantom would take for MNCA and fails if any is not met.
 * Output: exit 0 = verified; exit 1 = some step failed.
 *
 * Usage: npx ts-node scripts/comprobar-argumento-phantom.ts
 */

import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const MNCA_MINT = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m";
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const PHANTOM_DOCS_URL = "https://docs.phantom.com/best-practices/tokens/home-tab-fungibles";

function metadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );
  return pda;
}

function readBorshString(data: Buffer, offset: number): [string, number] {
  if (offset + 4 > data.length) return ["", offset];
  const len = data.readUInt32LE(offset);
  const end = offset + 4 + len;
  if (end > data.length) return ["", offset];
  const s = data.subarray(offset + 4, end).toString("utf-8");
  const trim = (x: string) => x.replace(/\0+$/, "").trim();
  return [trim(s), end];
}

function getMetadataFromAccount(data: Buffer): { name: string; symbol: string; uri: string } | null {
  if (data.length < 65) return null;
  let offset = 1 + 32 + 32;
  const [name, off1] = readBorshString(data, offset);
  const [symbol, off2] = readBorshString(data, off1);
  const [uri] = readBorshString(data, off2);
  const u = (uri && uri.trim()) || "";
  if (!u) return null;
  return { name: name || "", symbol: symbol || "", uri: u };
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const mint = new PublicKey(MNCA_MINT);
  const pda = metadataPDA(mint);

  console.log("=== Check: real and working argument ===\n");
  console.log("Argument: Phantom displays name/symbol/logo using Metaplex on-chain");
  console.log("(name, symbol, uri → JSON with image). See: " + PHANTOM_DOCS_URL + "\n");
  console.log("Mint MNCA:", MNCA_MINT);
  console.log("Metadata PDA:", pda.toBase58());
  console.log("");

  // Step 0 (optional): Phantom documentation says what we argue
  console.log("[0/5] Phantom documentation: prioritizes on-chain metadata...");
  try {
    const docRes = await fetch(PHANTOM_DOCS_URL, { signal: AbortSignal.timeout(10000) });
    const html = docRes.ok ? await docRes.text() : "";
    const hasOnChain = /on-chain metadata|Token Metadata Standard|prioritizes on-chain/i.test(html);
    if (hasOnChain) {
      console.log("      OK  (docs.phantom.com confirms use of on-chain metadata)\n");
    } else {
      console.log("      (could not verify text in docs; continuing with on-chain steps)\n");
    }
  } catch {
    console.log("      (fetch docs failed; continuing with on-chain steps)\n");
  }

  // Step 1: Metadata account exists
  console.log("[1/5] Metadata account on-chain exists...");
  let account = await connection.getAccountInfo(pda);
  if (!account?.data?.length) {
    console.log("      FAIL: No Metadata account for this mint.");
    process.exit(1);
  }
  console.log("      OK\n");

  // Step 2: name, symbol, uri extracted
  console.log("[2/5] name, symbol, uri in Metadata account...");
  const meta = getMetadataFromAccount(account.data);
  if (!meta || !meta.name || !meta.symbol || !meta.uri) {
    console.log("      FAIL: Could not extract name/symbol/uri on-chain.");
    if (meta) console.log("      name:", meta.name || "(empty)", "symbol:", meta.symbol || "(empty)", "uri:", meta.uri ? "present" : "empty");
    process.exit(1);
  }
  console.log("      OK  name=\"" + meta.name + "\" symbol=\"" + meta.symbol + "\" uri=" + meta.uri.slice(0, 50) + "...\n");

  // Step 3: URI accessible
  console.log("[3/5] URI accessible (GET)...");
  let res: Response;
  try {
    res = await fetch(meta.uri, { method: "GET", signal: AbortSignal.timeout(12000), redirect: "follow" });
  } catch (e) {
    console.log("      FAIL: " + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
  if (!res.ok) {
    console.log("      FAIL: HTTP " + res.status);
    process.exit(1);
  }
  console.log("      OK\n");

  // Step 4: JSON with name, symbol, image (or logoURI)
  console.log("[4/5] JSON at URI has name, symbol, image/logoURI...");
  type J = { name?: string; symbol?: string; image?: string; logoURI?: string };
  let json: J;
  try {
    json = (await res.json()) as J;
  } catch {
    console.log("      FAIL: Not valid JSON.");
    process.exit(1);
  }
  const imageUrl = json.image ?? json.logoURI ?? "";
  if (!json.name || !json.symbol || !imageUrl) {
    console.log("      FAIL: Missing name/symbol/image in JSON. name=" + !!json.name + " symbol=" + !!json.symbol + " image=" + !!imageUrl);
    process.exit(1);
  }
  console.log("      OK  image=" + imageUrl.slice(0, 50) + "...\n");

  // Step 5: Image loads
  console.log("[5/5] Image URL accessible...");
  let imgRes: Response;
  try {
    imgRes = await fetch(imageUrl, { method: "GET", signal: AbortSignal.timeout(12000), redirect: "follow" });
  } catch (e) {
    console.log("      FAIL: " + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
  if (!imgRes.ok) {
    console.log("      FAIL: HTTP " + imgRes.status);
    process.exit(1);
  }
  console.log("      OK\n");

  console.log("=== Result ===\n");
  console.log("Verified: MNCA meets all the steps Phantom uses to display");
  console.log("name, symbol and image. The argument is real and works for this token.");
  console.log("");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
