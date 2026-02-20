/**
 * Fetches a Solana transaction by signature and prints whether it looks like
 * an add-liquidity (e.g. Raydium CLMM) transaction.
 * Usage: npx ts-node scripts/verificar-tx-liquidez.ts <SIGNATURE>
 */

import { Connection } from "@solana/web3.js";

const SIG =
  process.argv[2] || "2ke4DR5td9bTStaMKapxypTMesn1wrRg7mssjk6RvnUe8TWLHhuUDZJe9dUSkjjG4hE9eMP4BSqRPkBM7cGXL7Af";
const RPC = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

const RAYDIUM_CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const tx = await connection.getParsedTransaction(SIG, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    console.error("Transaction not found or not confirmed yet.");
    process.exit(1);
  }

  const meta = tx.meta;
  const err = meta?.err;
  if (err) {
    console.log("Transaction status: FAILED");
    console.log("Error:", JSON.stringify(err));
    process.exit(1);
  }

  console.log("Transaction status: SUCCESS");
  console.log("Block time:", tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "N/A");
  console.log("Slot:", tx.slot);
  const message = tx.transaction.message;
  const accountKeys = message.accountKeys.map((k) => (typeof k.pubkey === "string" ? k.pubkey : k.pubkey.toBase58()));
  const instructions = message.instructions;
  const innerInstructions = meta?.innerInstructions ?? [];
  const hasRaydiumInAccounts = accountKeys.includes(RAYDIUM_CLMM);
  console.log("Raydium CLMM in account keys:", hasRaydiumInAccounts ? "YES" : "NO");
  console.log("Inner instruction groups:", innerInstructions.length);
  console.log("");

  let isLiquidity = false;
  let programIdUsed: string[] = [];

  for (let i = 0; i < instructions.length; i++) {
    const ix = instructions[i] as {
      programIdIndex?: number;
      parsed?: unknown;
      program?: string;
      data?: string;
    };
    let programId: string | undefined;
    if ("program" in ix && typeof ix.program === "string") {
      programId = ix.program;
    } else if (typeof ix.programIdIndex === "number") {
      programId = accountKeys[ix.programIdIndex];
    }
    if (programId) {
      programIdUsed.push(programId);
      if (programId === RAYDIUM_CLMM) {
        isLiquidity = true;
        console.log("[Raydium CLMM] Program invoked (top-level):", programId);
        if (ix.data) console.log("  Instruction data (base58):", ix.data.slice(0, 80) + "...");
      }
    }
  }

  for (const innerBlock of innerInstructions) {
    const inIxs = (innerBlock as { instructions: Array<{ programIdIndex?: number; program?: string }> }).instructions;
    for (const ix of inIxs) {
      const pid =
        typeof ix.programIdIndex === "number"
          ? accountKeys[ix.programIdIndex]
          : undefined;
      if (pid === RAYDIUM_CLMM) {
        isLiquidity = true;
        console.log("[Raydium CLMM] Inner instruction (add liquidity / increase liquidity likely)");
      }
      if (pid) programIdUsed.push(pid);
    }
  }

  if (hasRaydiumInAccounts) isLiquidity = true;

  console.log("");
  if (isLiquidity) {
    console.log(">>> YES: This transaction involved the Raydium CLMM program (add/increase liquidity or related).");
  } else {
    console.log("Programs invoked:", [...new Set(programIdUsed)].join(", ") || "(none resolved)");
    console.log(">>> Raydium CLMM was not detected in this transaction.");
  }

  console.log("");
  console.log("Solscan:", `https://solscan.io/tx/${SIG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
