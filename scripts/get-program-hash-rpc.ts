/**
 * Obtiene el hash SHA256 del binario de un programa Solana desplegado (upgradeable).
 * Mismo criterio que solana-verify get-program-hash: PDA program data, quitar metadata, recortar zeros finales, SHA256.
 *
 * Uso: npx ts-node scripts/get-program-hash-rpc.ts [programId] [rpcUrl]
 * Por defecto: Raydium CLMM, mainnet.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

const BPF_LOADER_UPGRADEABLE_ID = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const PROGRAMDATA_METADATA_SIZE = 45; // slot (8) + option<Pubkey> (1+32) + discriminator (4)

function getProgramDataAddress(programId: PublicKey): PublicKey {
  // PDA: seeds = [program_id], program = BPFLoaderUpgradeable (igual que get_program_data_address en Rust)
  const [pda] = PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_LOADER_UPGRADEABLE_ID
  );
  return pda;
}

function getBinaryHash(data: Buffer): string {
  let end = data.length;
  while (end > 0 && data[end - 1] === 0) end--;
  const trimmed = data.subarray(0, end);
  return createHash("sha256").update(trimmed).digest("hex");
}

async function main() {
  const programIdStr = process.argv[2] ?? "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
  const rpcUrl = process.argv[3] ?? process.env.SolanaRpcUrl ?? "https://api.mainnet-beta.solana.com";

  const conn = new Connection(rpcUrl);
  const programId = new PublicKey(programIdStr);
  const programDataAddress = getProgramDataAddress(programId);

  const account = await conn.getAccountInfo(programDataAddress);
  if (!account?.data) {
    console.error("No se encontró la cuenta de program data para", programIdStr);
    process.exit(1);
  }

  const programBytes = account.data.subarray(PROGRAMDATA_METADATA_SIZE);
  const hash = getBinaryHash(programBytes);
  console.log(hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
