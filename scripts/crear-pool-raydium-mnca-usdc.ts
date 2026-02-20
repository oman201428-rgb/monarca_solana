/**
 * Crea pool MNCA/USDC en Raydium CPMM para que las wallets muestren valor (~1 USD por MNCA).
 * El ratio inicial define el precio: igual cantidad = 1 MNCA = 1 USD.
 *
 * Requisitos:
 * - Token MNCA creado (crear-token-spl.ts) y minteado a tu wallet
 * - USDC en tu wallet (comprar en Jupiter/Pump o transferir)
 * - SOL para crear pool: ~0.19 SOL (rent + protocol fee Raydium CPMM)
 *
 * Uso: CLUSTER=mainnet npx ts-node scripts/crear-pool-raydium-mnca-usdc.ts [cantidad_mnca] [cantidad_usdc]
 *   Por defecto: 1000 MNCA y 1000 USDC (ratio 1:1)
 *
 * Ejemplo: npx ts-node scripts/crear-pool-raydium-mnca-usdc.ts 500 500
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

const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DECIMALS = 6;
const CLUSTER = (process.env.CLUSTER || "mainnet") as "mainnet" | "devnet";

async function main() {
  const amountMnca = process.argv[2] ? parseInt(process.argv[2], 10) : 1000;
  const amountUsdc = process.argv[3] ? parseInt(process.argv[3], 10) : 1000;

  const mintPath = path.join(__dirname, "..", "integracion", "MINT_ADDRESS.txt");
  const walletPath = path.join(__dirname, "..", "integracion", "id.json");

  if (!fs.existsSync(mintPath) || !fs.existsSync(walletPath)) {
    console.error("Ejecuta primero crear-token-spl.ts y asegúrate de tener integracion/id.json");
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
  console.log("USDC mint:", USDC_MAINNET);
  console.log("Ratio inicial:", amountMnca, "MNCA :", amountUsdc, "USDC (1 MNCA = 1 USD)");
  console.log("");

  const raydium = await Raydium.load({
    owner: wallet,
    connection,
    cluster: CLUSTER,
    disableFeatureCheck: true,
    disableLoadToken: false,
  });

  // Asegurar que existan las cuentas ATA para MNCA y USDC
  const mncaPubkey = new PublicKey(mncaMint);
  const usdcPubkey = new PublicKey(USDC_MAINNET);
  const ataMnca = getAssociatedTokenAddressSync(mncaPubkey, wallet.publicKey);
  const ataUsdc = getAssociatedTokenAddressSync(usdcPubkey, wallet.publicKey);

  const ataMncaInfo = await connection.getAccountInfo(ataMnca);
  const ataUsdcInfo = await connection.getAccountInfo(ataUsdc);

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
  if (!ataUsdcInfo) {
    console.log("Creando cuenta ATA para USDC...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        ataUsdc,
        wallet.publicKey,
        usdcPubkey
      )
    );
    await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Verificar balances
  const { value: mncaAccounts } = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: mncaPubkey,
  });
  const { value: usdcAccounts } = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
    mint: usdcPubkey,
  });
  const mncaBal = mncaAccounts[0]?.account.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  const usdcBal = usdcAccounts[0]?.account.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;

  if (mncaBal < amountMnca) {
    console.error(`Necesitas al menos ${amountMnca} MNCA. Tienes: ${mncaBal}`);
    process.exit(1);
  }
  if (usdcBal < amountUsdc) {
    console.error(
      `Necesitas al menos ${amountUsdc} USDC. Tienes: ${usdcBal}. Compra USDC en Jupiter o transfiere.`
    );
    process.exit(1);
  }
  console.log(`Balances OK: ${mncaBal} MNCA, ${usdcBal} USDC`);
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

  let mintB = await raydium.token.getTokenInfo(USDC_MAINNET);
  if (!mintB) {
    mintB = toApiV3Token({
      address: USDC_MAINNET,
      programId: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
    });
  }

  const mintAAmount = new BN(amountMnca * 10 ** DECIMALS);
  const mintBAmount = new BN(amountUsdc * 10 ** DECIMALS);

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
  console.log("[OK] Pool creado");
  console.log("Tx:", txId);
  const poolId = (extInfo?.address as { poolId?: { toString: () => string } })?.poolId?.toString();
  console.log("Pool ID:", poolId || "ver en Raydium");
  console.log("");
  console.log("Las wallets (Phantom, etc.) mostrarán el valor en unos minutos cuando");
  console.log("los agregadores (Jupiter, Birdeye) indexen el pool.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
