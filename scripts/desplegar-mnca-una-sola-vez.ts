/**
 * DESPLIEGUE MONARCA EN UNA SOLA EJECUCIÓN
 * Crea token + metadata (logo, nombre) + mint inicial.
 *
 * Para que muestre PRECIO en wallets: después ejecuta crear-pool con USDC.
 *
 * Uso:
 *   mainnet (por defecto):  npx ts-node scripts/desplegar-mnca-una-sola-vez.ts
 *   devnet:                 CLUSTER=devnet npx ts-node scripts/desplegar-mnca-una-sola-vez.ts
 *   con RPC:  RPC_URL=https://... npx ts-node scripts/desplegar-mnca-una-sola-vez.ts
 *
 * Requisitos:
 * - integracion/id.json (wallet con SOL)
 * - scripts/METADATA_URI.txt (URL del JSON en Pinata)
 */

import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const DECIMALS = 6;
const CLUSTER = (process.env.CLUSTER ?? "mainnet") as string;
const IS_MAINNET = CLUSTER === "mainnet";

function getRpc(): string {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  return IS_MAINNET
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

async function main() {
  const base = path.join(__dirname, "..");
  const walletPath = path.join(base, "integracion", "id.json");
  const mintPath = path.join(base, "integracion", "MINT_ADDRESS.txt");

  const tokenAlreadyExists = fs.existsSync(mintPath);

  if (!fs.existsSync(walletPath)) {
    console.log("Creando wallet nueva...");
    const newWallet = Keypair.generate();
    const integracionDir = path.join(base, "integracion");
    if (!fs.existsSync(integracionDir)) fs.mkdirSync(integracionDir, { recursive: true });
    fs.writeFileSync(walletPath, JSON.stringify(Array.from(newWallet.secretKey)));
    fs.writeFileSync(
      path.join(integracionDir, "DIRECCION_PARA_RECIBIR_SOL.txt"),
      newWallet.publicKey.toBase58()
    );
    console.log("Wallet creada:", newWallet.publicKey.toBase58(), "- Envia SOL a esa direccion");
  }

  const metaJsonPath = path.join(__dirname, "metadata-monarca.json");
  const metaUriPathFile = path.join(__dirname, "METADATA_URI.txt");
  let metaUri = process.env.METADATA_URI?.trim();
  if (!metaUri && fs.existsSync(metaUriPathFile)) {
    metaUri = fs.readFileSync(metaUriPathFile, "utf-8").trim();
  }
  if (!metaUri) {
    console.error("Falta METADATA_URI. Pon la URL del JSON de Pinata en scripts/METADATA_URI.txt");
    process.exit(1);
  }

  let name = "MONARCA", symbol = "MNCA", decimals = DECIMALS, initialMint = 500_000_000_000;
  if (fs.existsSync(metaJsonPath)) {
    const meta = JSON.parse(fs.readFileSync(metaJsonPath, "utf-8"));
    name = meta.name || name;
    symbol = meta.symbol || symbol;
    if (typeof meta.decimals === "number") decimals = meta.decimals;
    if (typeof meta.initialMint === "number" && meta.initialMint > 0) initialMint = meta.initialMint;
  }

  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const connection = new Connection(getRpc(), {
    commitment: IS_MAINNET ? "confirmed" : "processed",
  });

  if (!IS_MAINNET) {
    const bal = await connection.getBalance(wallet.publicKey);
    if (bal < 0.1e9) {
      console.log("Airdrop devnet...");
      await connection.requestAirdrop(wallet.publicKey, 2e9);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log("");
  console.log(`=== ${name} (${symbol}) - Despliegue ===`);
  console.log("Cluster:", CLUSTER, "| Wallet:", wallet.publicKey.toBase58());
  console.log("");

  let mint: PublicKey;
  if (tokenAlreadyExists) {
    mint = new PublicKey(fs.readFileSync(mintPath, "utf-8").trim());
    console.log("[1/3] Token existente:", mint.toBase58());
  } else {
    const mintKeypair = Keypair.generate();
    mint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      decimals,
      mintKeypair
    );
    console.log("[1/3] Token creado:", mint.toBase58());
    fs.writeFileSync(mintPath, mint.toBase58());
    fs.writeFileSync(
      path.join(base, "integracion", "mint-keypair.json"),
      JSON.stringify(Array.from(mintKeypair.secretKey))
    );
  }

  // 2. Metadata Metaplex
  const { createCreateMetadataAccountV3Instruction } = require("@metaplex-foundation/mpl-token-metadata");
  const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM
  );

  const metaIx = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint,
      mintAuthority: wallet.publicKey,
      payer: wallet.publicKey,
      updateAuthority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name,
          symbol,
          uri: metaUri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const metaTx = new Transaction().add(metaIx);
  await sendAndConfirmTransaction(connection, metaTx, [wallet], {
    commitment: IS_MAINNET ? "confirmed" : "processed",
  });
  console.log("[2/3] Metadata creada (logo + nombre visibles en wallets)");

  // 3. Mint inicial 500B MNCA
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  const mintAmount = BigInt(initialMint * 10 ** decimals);

  const mintTx = new Transaction();
  try {
    const ataInfo = await connection.getAccountInfo(ata);
    if (!ataInfo) {
      mintTx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ata,
          wallet.publicKey,
          mint
        )
      );
    }
  } catch {
    mintTx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        ata,
        wallet.publicKey,
        mint
      )
    );
  }
  mintTx.add(createMintToInstruction(mint, ata, wallet.publicKey, mintAmount));

  await sendAndConfirmTransaction(connection, mintTx, [wallet], {
    commitment: IS_MAINNET ? "confirmed" : "processed",
  });
  console.log(`[3/3] Minteados ${initialMint.toLocaleString()} ${symbol}`);

  console.log("");
  console.log("=== LISTO ===");
  console.log("Mint:", mint.toBase58());
  console.log("Logo, nombre y símbolo visibles en Phantom/Solflare.");
  console.log("");
  console.log("Para mostrar PRECIO en wallets, crea pool MNCA/USDC:");
  console.log("  npx ts-node scripts/crear-pool-raydium-mnca-usdc.ts 500 500");
  console.log("(Necesitas USDC en tu wallet)");
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
