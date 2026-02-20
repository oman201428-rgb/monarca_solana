/**
 * Gasto REAL en SOL de una wallet: consulta RPC, suma los fees de cada transacción.
 * Sin suposiciones; datos desde la red.
 *
 * Uso: npx ts-node scripts/gasto-solana-real.ts [address]
 * Por defecto: wallet integracion (FTmsAi4gMRHNpLv25g9pMkmEaLiXPTjNiLzQsEUBniHp)
 */
import { Connection, PublicKey } from "@solana/web3.js";

const WALLET_DEFAULT = "FTmsAi4gMRHNpLv25g9pMkmEaLiXPTjNiLzQsEUBniHp";
const RPC = process.env.SolanaRpcUrl || "https://api.mainnet-beta.solana.com";
const LIMIT = 200;

async function main() {
  const address = process.argv[2] || WALLET_DEFAULT;
  const conn = new Connection(RPC, "confirmed");
  const pubkey = new PublicKey(address);

  const signatures = await conn.getSignaturesForAddress(pubkey, { limit: LIMIT });
  let totalLamports = 0;
  let count = 0;

  for (const { signature } of signatures) {
    try {
      const tx = await conn.getTransaction(signature, {
        maxSupportedTransactionVersion: 2,
        commitment: "confirmed",
      });
      if (tx?.meta?.fee != null) {
        totalLamports += tx.meta.fee;
        count++;
      }
    } catch {
      // ignorar txs que fallen al obtener
    }
  }

  const totalSol = totalLamports / 1e9;
  console.log(JSON.stringify({
    address,
    rpc: RPC,
    transactionsCount: count,
    totalFeeLamports: totalLamports,
    totalFeeSol: totalSol,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
