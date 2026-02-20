/**
 * Updates the URI of the Metaplex Token Metadata account for the MNCA mint.
 * Useful when you upload a new JSON to Pinata (with logoURI/image) and want
 * the on-chain metadata to point to that URI so Jupiter/wallets display the icon.
 *
 * Usage:
 *   METADATA_URI=https://gateway.pinata.cloud/ipfs/NUEVO_HASH npx ts-node scripts/actualizar-uri-metadata-solana.ts
 *   Or put the URI in scripts/METADATA_URI.txt and run without env.
 *
 * Requirements: integracion/id.json (mint update authority), mint in integracion/MINT_ADDRESS.txt.
 */

import * as fs from "fs";
import * as path from "path";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METAPLEX_PROGRAM_ID
  );
  return pda;
}

async function main() {
  let uri = process.env.METADATA_URI?.trim() || "";
  if (!uri) {
    const uriPath = path.join(__dirname, "METADATA_URI.txt");
    if (fs.existsSync(uriPath)) uri = fs.readFileSync(uriPath, "utf-8").trim();
  }
  if (!uri) {
    console.error("Define METADATA_URI (env or scripts/METADATA_URI.txt) with the metadata JSON URL (e.g. Pinata).");
    process.exit(1);
  }

  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  if (!fs.existsSync(mintPath)) {
    console.error("Missing integracion/MINT_ADDRESS.txt with the mint.");
    process.exit(1);
  }
  const mint = new PublicKey(fs.readFileSync(mintPath, "utf-8").trim());

  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("Missing integracion/id.json (wallet with update authority).");
    process.exit(1);
  }
  const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));

  const rpc = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const metadataPDA = getMetadataPDA(mint);
  console.log("Mint:", mint.toBase58());
  console.log("Metadata PDA:", metadataPDA.toBase58());
  console.log("New URI:", uri);
  console.log("");

  try {
    const { createUpdateMetadataAccountV2Instruction } = require("@metaplex-foundation/mpl-token-metadata");
    const ix = createUpdateMetadataAccountV2Instruction(
      {
        metadata: metadataPDA,
        updateAuthority: wallet.publicKey,
      },
      {
        updateMetadataAccountArgsV2: {
          data: {
            name: "MONARCA",
            symbol: "MNCA",
            uri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          updateAuthority: wallet.publicKey,
          primarySaleHappened: null,
          isMutable: true,
        },
      }
    );
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], { commitment: "confirmed" });
    console.log("OK. Metadata URI updated. Tx:", sig);
    console.log("Make sure the JSON at that URI has 'image' and 'logoURI' for Jupiter to display the icon.");
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : String(e);
    if (/instruction.*not found|createUpdateMetadataAccountV2/.test(msg)) {
      console.error("This package may use a different instruction name. Try updating the URI from Solana Explorer or another Metaplex client.");
    }
    throw e;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
