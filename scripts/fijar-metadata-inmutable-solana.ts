/**
 * Fija los metadatos del token MNCA como INMUTABLES (isMutable: false).
 *
 * Así se quita la alerta de "metadatos mutables" en Jupiter, Raydium y otros
 * cuando muestran el pool o el token. Es un cambio irreversible: nadie podrá
 * volver a cambiar nombre, símbolo, URI ni logo en chain.
 *
 * Ejecutar SOLO cuando el URI y el contenido del JSON (logo, etc.) sean definitivos.
 *
 * Uso:
 *   METADATA_URI=https://gateway.pinata.cloud/ipfs/TU_HASH npx ts-node scripts/fijar-metadata-inmutable-solana.ts
 *   O poner la URI en scripts/METADATA_URI.txt y ejecutar sin env.
 *
 * Requisitos: integracion/id.json (update authority del mint), integracion/MINT_ADDRESS.txt.
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
    console.error("Define METADATA_URI (env o scripts/METADATA_URI.txt) con la URL del JSON de metadatos.");
    process.exit(1);
  }

  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  if (!fs.existsSync(mintPath)) {
    console.error("Falta integracion/MINT_ADDRESS.txt con el mint.");
    process.exit(1);
  }
  const mint = new PublicKey(fs.readFileSync(mintPath, "utf-8").trim());

  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("Falta integracion/id.json (wallet con update authority).");
    process.exit(1);
  }
  const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));

  const rpc = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpc, "confirmed");

  const metadataPDA = getMetadataPDA(mint);
  console.log("Mint:", mint.toBase58());
  console.log("Metadata PDA:", metadataPDA.toBase58());
  console.log("URI (debe ser la definitiva):", uri);
  console.log("");
  console.log("Se fijará isMutable = false. Después no se podrá cambiar nombre, símbolo ni URI.");
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
          isMutable: false, // <-- Fija inmutable; quita la alerta en Jupiter/Raydium
        },
      }
    );
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], { commitment: "confirmed" });
    console.log("OK. Metadatos fijados como INMUTABLES. Tx:", sig);
    console.log("La alerta de 'metadatos mutables' debería desaparecer en Jupiter/Raydium al refrescar.");
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : String(e);
    if (/instruction.*not found|createUpdateMetadataAccountV2/.test(msg)) {
      console.error("El paquete puede usar otro nombre de instrucción. Prueba desde Solana Explorer u otro cliente Metaplex.");
    }
    throw e;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
