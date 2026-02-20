/**
 * Inicializa el mint del token MONARCA (MNCA) en Solana.
 * Uso: npx ts-node scripts/initialize-mint-solana.ts
 *
 * Requisitos:
 * - Programa ya desplegado.
 * - Wallet en integracion/id.json con SOL suficiente.
 * - Ejecutar desde solana/ después de anchor build.
 *
 * Opcional: CLUSTER (mainnet | devnet, default: devnet)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new anchor.web3.PublicKey(
  process.env.PROGRAM_ID || "97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv"
);
const CLUSTER = process.env.CLUSTER || "devnet";

async function main() {
  const walletPath = path.join(__dirname, "..", "integracion", "id.json");
  if (!fs.existsSync(walletPath)) {
    console.error("[ERROR] No se encontró integracion/id.json");
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

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
    commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
  });

  const idlPath = path.join(__dirname, "..", "target", "idl", "monarca_solana.json");
  if (!fs.existsSync(idlPath)) {
    console.error("[ERROR] IDL no encontrado. Ejecuta 'anchor build' primero.");
    process.exit(1);
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const programId = new anchor.web3.PublicKey(idl.address || PROGRAM_ID);
  const program = new anchor.Program(idl, programId, provider);

  const [mintPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );

  console.log("Cluster:", CLUSTER);
  console.log("Program ID:", program.programId.toBase58());
  console.log("Mint PDA:", mintPda.toBase58());
  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("");

  // Verificar si el mint ya existe
  const mintInfo = await connection.getAccountInfo(mintPda);
  if (mintInfo) {
    console.log("[INFO] El mint ya está inicializado. No es necesario volver a ejecutar.");
    process.exit(0);
  }

  try {
    await program.methods
      .initializeMint()
      .accounts({
        mint: mintPda,
        authority: wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        token_program: TOKEN_PROGRAM_ID,
        system_program: anchor.web3.SystemProgram.programId,
      })
      .rpc({
        commitment: CLUSTER === "mainnet" ? "confirmed" : "processed",
        skipPreflight: false,
      });

    console.log("[OK] Mint inicializado correctamente.");
  } catch (e: unknown) {
    const err = e as { message?: string; logs?: string[] };
    if (err?.message?.includes("already in use") || err?.logs?.some((l) => l.includes("already"))) {
      console.log("[INFO] El mint ya existía. Continuar con metadata si aplica.");
      process.exit(0);
    }
    console.error("[ERROR] Fallo al inicializar mint:", err?.message || e);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
