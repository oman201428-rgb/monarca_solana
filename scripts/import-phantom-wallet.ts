/**
 * Convierte la clave privada de Phantom (base58) al formato id.json.
 * Uso: PHANTOM_KEY="tu_clave_base58" npx ts-node scripts/import-phantom-wallet.ts
 * O: npx ts-node scripts/import-phantom-wallet.ts "tu_clave_base58"
 *
 * IMPORTANTE: Borra la clave del historial después. No la subas a git.
 */

import * as fs from "fs";
import * as path from "path";
import { Keypair } from "@solana/web3.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require("bs58") as { decode: (s: string) => Uint8Array };

function main() {
  const key =
    process.env.PHANTOM_KEY ||
    process.argv[2]?.trim() ||
    "";

  if (!key) {
    console.error("Uso:");
    console.error("  PHANTOM_KEY=\"tu_clave_base58\" npx ts-node scripts/import-phantom-wallet.ts");
    console.error("  npx ts-node scripts/import-phantom-wallet.ts \"tu_clave_base58\"");
    console.error("");
    console.error("Obtén la clave en Phantom: Configuración → Seguridad → Exportar clave privada");
    process.exit(1);
  }

  try {
    const bytes = bs58.decode(key);
    let keypair: Keypair;

    if (bytes.length === 64) {
      keypair = Keypair.fromSecretKey(bytes);
    } else if (bytes.length === 32) {
      keypair = Keypair.fromSeed(bytes);
    } else if (bytes.length >= 32) {
      // 63 bytes: usar primeros 32 como seed (estándar)
      keypair = Keypair.fromSeed(bytes.subarray(0, 32));
    } else {
      console.error(`[ERROR] Clave inválida: ${bytes.length} bytes (esperado 32 o 64).`);
      process.exit(1);
    }

    const secretKey = keypair.secretKey;
    const address = keypair.publicKey.toBase58();

    const idPath = path.join(__dirname, "..", "integracion", "id.json");
    fs.mkdirSync(path.dirname(idPath), { recursive: true });
    fs.writeFileSync(idPath, JSON.stringify(Array.from(secretKey)), "utf-8");

    console.log("[OK] id.json creado en integracion/id.json");
    console.log("     Dirección:", address);
    console.log("");
    console.log("IMPORTANTE: Borra la clave del historial de comandos si la usaste por terminal.");
  } catch (e) {
    console.error("[ERROR] Clave inválida:", (e as Error).message);
    process.exit(1);
  }
}

main();
