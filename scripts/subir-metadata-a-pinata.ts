/**
 * Uploads scripts/metadata-para-pinata.json to Pinata via API and writes the URI to METADATA_URI.txt.
 *
 * Requirement: PINATA_JWT in environment variable or in .env (copy .env.example to .env).
 * Get JWT: https://app.pinata.cloud/developers/api-keys → Create Key → copy JWT.
 *
 * Usage:
 *   From solana/: npm run subir-pinata
 *   Or: PINATA_JWT=your_jwt npx ts-node scripts/subir-metadata-a-pinata.ts
 */

import * as fs from "fs";
import * as path from "path";

async function loadEnv(): Promise<void> {
  const root = path.join(__dirname, "..");
  const files = ["datos-api.env", ".env"];
  for (const name of files) {
    const envPath = path.join(root, name);
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

async function main(): Promise<void> {
  await loadEnv();
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    console.error("Missing PINATA_JWT.");
    console.error("1. Copy plantilla-env.txt to datos-api.env (in the solana/ folder).");
    console.error("2. Open datos-api.env and paste your JWT after PINATA_JWT=");
    console.error("   JWT: https://app.pinata.cloud/developers/api-keys → Create Key → copy JWT.");
    process.exit(1);
  }

  const metadataPath = path.join(__dirname, "metadata-para-pinata.json");
  if (!fs.existsSync(metadataPath)) {
    console.error("metadata-para-pinata.json not found in scripts/");
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(metadataPath);
  const blob = new Blob([fileBuffer], { type: "application/json" });
  const file = new File([blob], "metadata-para-pinata.json", { type: "application/json" });

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Pinata API error:", res.status, text);
    if (res.status === 401) console.error("Verify that the JWT is correct (app.pinata.cloud → API Keys).");
    process.exit(1);
  }

  const data = (await res.json()) as { IpfsHash?: string; PinSize?: number; isDuplicate?: boolean };
  const cid = data.IpfsHash;
  if (!cid) {
    console.error("Pinata did not return IpfsHash:", data);
    process.exit(1);
  }

  const uri = `https://gateway.pinata.cloud/ipfs/${cid}`;
  console.log("Uploaded successfully.");
  console.log("CID:", cid);
  console.log("URI:", uri);
  if (data.isDuplicate) console.log("(Pinata indicated the content already existed; same CID was reused.)");

  const uriTxtPath = path.join(__dirname, "METADATA_URI.txt");
  fs.writeFileSync(uriTxtPath, uri + "\n", "utf-8");
  console.log("");
  console.log("Written to scripts/METADATA_URI.txt. To update on-chain metadata:");
  console.log("  npm run actualizar-uri-metadata");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
