/**
 * Crea la cuenta de Metaplex Token Metadata para el mint MONARCA (MNCA).
 * Uso: npx ts-node scripts/create-metadata-solana.ts
 *
 * Requisitos:
 * - Variable de entorno METADATA_URI = URL del JSON de metadatos (p. ej. Pinata).
 * - Wallet en integracion/id.json con SOL y que sea la authority del mint.
 * - Programa ya desplegado y initialize_mint ya ejecutado.
 *
 * Opcional: PROGRAM_ID y CLUSTER (devnet por defecto).
 */

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID || "97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv");
// MINT_ADDRESS: si existe integracion/MINT_ADDRESS.txt (modo SPL), se usa; si no, se usa el PDA del programa
// METADATA_URI: variable de entorno o, si no está definida, se lee de scripts/METADATA_URI.txt
let METADATA_URI = process.env.METADATA_URI || "";
if (!METADATA_URI) {
  try {
    const uriPath = path.join(__dirname, "METADATA_URI.txt");
    if (fs.existsSync(uriPath)) METADATA_URI = fs.readFileSync(uriPath, "utf-8").trim();
  } catch {
    /* ignorar */
  }
}
const CLUSTER = process.env.CLUSTER || "devnet";

const METAPLEX_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METAPLEX_METADATA_PROGRAM_ID
  );
  return pda;
}

async function main() {
  if (!METADATA_URI) {
    console.error("Define METADATA_URI (URL del JSON de metadatos, p. ej. Pinata).");
    process.exit(1);
  }

  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("No se encontró integracion/id.json");
    process.exit(1);
  }

  const walletKeypair = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(walletKeypair));

  const endpoint =
    CLUSTER === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  const connection = new anchor.web3.Connection(endpoint, {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  let mintAddress: PublicKey;
  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  if (fs.existsSync(mintPath)) {
    mintAddress = new PublicKey(fs.readFileSync(mintPath, "utf-8").trim());
    console.log("Mint (SPL):", mintAddress.toBase58());
  } else {
    [mintAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      PROGRAM_ID
    );
    console.log("Mint (PDA):", mintAddress.toBase58());
  }

  const metadataPDA = getMetadataPDA(mintAddress);

  console.log("Metadata PDA:", metadataPDA.toBase58());
  console.log("URI:", METADATA_URI);
  console.log("");

  try {
    // API para mpl-token-metadata 2.x. La 3.x usa Umi y otra firma; usa versión 2.x o adapta.
    // npm i @metaplex-foundation/mpl-token-metadata@^2 @solana/spl-token
    const { createCreateMetadataAccountV3Instruction } = require("@metaplex-foundation/mpl-token-metadata");
    const accounts = {
      metadata: metadataPDA,
      mint: mintAddress,
      mintAuthority: wallet.publicKey,
      payer: wallet.publicKey,
      updateAuthority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    };
    const args = {
      data: {
        name: "MONARCA",
        symbol: "MNCA",
        uri: METADATA_URI,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    };
    const ix = createCreateMetadataAccountV3Instruction(accounts, args);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new anchor.web3.Transaction().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    tx.sign(wallet);

    const sig = await connection.sendTransaction(tx, [wallet], {
      skipPreflight: false,
      maxRetries: 3,
      preflightCommitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
    });
    console.log("Tx enviada:", sig);
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      CLUSTER === "mainnet" ? "confirmed" : "processed"
    );
    console.log("Metadata creada. Logo y nombre/símbolo visibles en billeteras que lean Metaplex.");
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message ?? e);
    if (/already in use|already exists|0x0|account already/.test(msg)) {
      console.log("Metadata ya existe para este mint.");
      return;
    }
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "MODULE_NOT_FOUND") {
      console.log("Para crear la metadata desde este script, instala:");
      console.log("  npm i @metaplex-foundation/mpl-token-metadata @solana/spl-token");
      console.log("Luego define METADATA_URI y vuelve a ejecutar.");
      console.log("");
      console.log("Alternativa: usa cualquier cliente que soporte Metaplex CreateMetadataAccountV3");
      console.log("con mint =", mintAddress.toBase58(), "name = MONARCA, symbol = MNCA, uri = <tu URL Pinata>.");
    } else {
      throw e;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
