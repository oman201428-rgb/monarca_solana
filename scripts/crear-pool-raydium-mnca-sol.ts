/**
 * Crea pool MNCA/SOL en Raydium CPMM.
 * Para que 1 MNCA ≈ 1 USD: usa ratio ~1000 MNCA : 5 SOL (asumiendo SOL ≈ 200 USD).
 *
 * Requisitos:
 * - Token MNCA creado y minteado a tu wallet
 * - SOL en tu wallet: liquidez + ~0.19 SOL para crear pool CPMM (rent + protocol fee Raydium)
 *
 * Uso: CLUSTER=mainnet npx ts-node scripts/crear-pool-raydium-mnca-sol.ts [cantidad_mnca] [cantidad_sol]
 *   Para 1 MNCA = 1 USD: 100 0.5 (asumiendo SOL ~200 USD)
 *   Por defecto: 100 MNCA y 0.5 SOL (~1 USD/MNCA). Necesitas ~0.7 SOL total (0.5 liquidez + ~0.19 creación).
 */

import {
  Raydium,
  TxVersion,
  CREATE_CPMM_POOL_PROGRAM,
  CREATE_CPMM_POOL_FEE_ACC,
  toApiV3Token,
} from "@raydium-io/raydium-sdk-v2";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";

const WSOL_MAINNET = "So11111111111111111111111111111111111111112";
const DECIMALS = 6;
const CLUSTER = (process.env.CLUSTER || "mainnet") as "mainnet" | "devnet";

async function main() {
  // Por defecto: 100 MNCA + 0.5 SOL ≈ 1 MNCA = 1 USD (SOL ~200)
  const amountMnca = process.argv[2] ? parseInt(process.argv[2], 10) : 100;
  const amountSol = process.argv[3] ? parseFloat(process.argv[3]) : 0.5;

  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  const walletPath = path.join(__dirname, "..", "integracion", "id.json");

  if (!fs.existsSync(mintPath) || !fs.existsSync(walletPath)) {
    console.error("Ejecuta primero desplegar-mnca-una-sola-vez.ts y asegúrate de tener integracion/id.json");
    process.exit(1);
  }

  const mncaMint = fs.readFileSync(mintPath, "utf-8").trim();
  const wallet = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const endpoint =
    CLUSTER === "mainnet"
      ? process.env.RPC_URL || "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

  const connection = new Connection(endpoint, { commitment: "confirmed" });

  console.log("Cluster:", CLUSTER);
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("MNCA mint:", mncaMint);
  console.log("WSOL mint:", WSOL_MAINNET);
  console.log("Ratio inicial:", amountMnca, "MNCA :", amountSol, "SOL");
  console.log("");

  const raydium = await Raydium.load({
    owner: wallet,
    connection,
    cluster: CLUSTER,
    disableFeatureCheck: true,
    disableLoadToken: false,
  });

  const mncaPubkey = new PublicKey(mncaMint);
  const wsolPubkey = new PublicKey(WSOL_MAINNET);
  const ataMnca = getAssociatedTokenAddressSync(mncaPubkey, wallet.publicKey);
  const ataWsol = getAssociatedTokenAddressSync(wsolPubkey, wallet.publicKey);

  const ataMncaInfo = await connection.getAccountInfo(ataMnca);
  const ataWsolInfo = await connection.getAccountInfo(ataWsol);

  if (!ataMncaInfo) {
    console.log("Creando cuenta ATA para MNCA...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        ataMnca,
        wallet.publicKey,
        mncaPubkey
      )
    );
    await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!ataWsolInfo) {
    console.log("Creando cuenta ATA para WSOL...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        ataWsol,
        wallet.publicKey,
        wsolPubkey
      )
    );
    await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
    await new Promise((r) => setTimeout(r, 2000));
  }

  const { value: mncaAccounts } = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: mncaPubkey,
  });
  const { value: wsolAccounts } = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: wsolPubkey,
  });
  const mncaBal = mncaAccounts[0]?.account.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  const wsolBal = wsolAccounts[0]?.account.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  const solBal = (await connection.getBalance(wallet.publicKey)) / 1e9;

  const SOL_CREATE_POOL_CPMM = 0.19; // rent + protocol fee (docs.raydium.io/raydium/for-liquidity-providers/pool-fees)
  const solNeeded = amountSol + SOL_CREATE_POOL_CPMM;
  if (mncaBal < amountMnca) {
    console.error(`Necesitas al menos ${amountMnca} MNCA. Tienes: ${mncaBal}`);
    process.exit(1);
  }
  if (solBal < solNeeded) {
    console.error(
      `Necesitas al menos ${solNeeded.toFixed(2)} SOL (${amountSol} liquidez + ${SOL_CREATE_POOL_CPMM} creación CPMM). Tienes: ${solBal.toFixed(2)} SOL`
    );
    process.exit(1);
  }
  console.log(`Balances OK: ${mncaBal} MNCA, ${solBal} SOL, ${wsolBal} WSOL`);
  console.log("");

  let mintA = await raydium.token.getTokenInfo(mncaMint);
  if (!mintA) {
    mintA = toApiV3Token({
      address: mncaMint,
      programId: TOKEN_PROGRAM_ID.toBase58(),
      decimals: DECIMALS,
      symbol: "MNCA",
      name: "MONARCA",
    });
  }

  let mintB = await raydium.token.getTokenInfo(WSOL_MAINNET);
  if (!mintB) {
    mintB = toApiV3Token({
      address: WSOL_MAINNET,
      programId: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 9,
      symbol: "SOL",
      name: "Wrapped SOL",
    });
  }

  const mintAAmount = new BN(amountMnca * 10 ** DECIMALS);
  const mintBAmount = new BN(Math.floor(amountSol * 1e9));

  const feeConfigs = await raydium.api.getCpmmConfigs();
  const feeConfig = feeConfigs[0];

  if (!feeConfig) {
    console.error("No se pudo obtener config de fees de Raydium");
    process.exit(1);
  }

  const { execute, extInfo, transaction } = await raydium.cpmm.createPool({
    programId: CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
    mintA,
    mintB,
    mintAAmount,
    mintBAmount,
    startTime: new BN(Math.floor(Date.now() / 1000)),
    feeConfig,
    associatedOnly: false,
    ownerInfo: { useSOLBalance: true },
    txVersion: TxVersion.V0,
  });

  console.log("Enviando transacción...");
  const { txId } = await execute({ sendAndConfirm: true });

  console.log("");
  console.log("[OK] Pool MNCA/SOL creado");
  console.log("Tx:", txId);
  const poolId = (extInfo?.address as { poolId?: { toString: () => string } })?.poolId?.toString();
  console.log("Pool ID:", poolId || "ver en Raydium");
  console.log("");
  console.log("Las wallets mostrarán el valor en unos minutos cuando los agregadores indexen.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
