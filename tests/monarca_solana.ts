/**
 * Tests del programa del token MONARCA (MNCA) en Solana.
 * Flujo: initialize_mint → crear ATA → mint_tokens → burn_tokens → verificar balance.
 */
import * as anchor from "@coral-xyz/anchor";
import type { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("monarca_solana (token MONARCA / MNCA)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // anchor.workspace.MonarcaSolana se rellena con `anchor build` (target/types)
  const program = anchor.workspace.MonarcaSolana as Program;

  it("Inicializa mint MONARCA, mintea y quema", async () => {
    const [mintPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    await program.methods
      .initializeMint()
      .accounts({
        mint: mintPda,
        authority: provider.wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const ata = getAssociatedTokenAddressSync(
      mintPda,
      provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const ataInfo = await provider.connection.getAccountInfo(ata);
    if (!ataInfo) {
      const createAtaIx = createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey,
        ata,
        provider.wallet.publicKey,
        mintPda
      );
      await provider.sendAndConfirm(new anchor.web3.Transaction().add(createAtaIx));
    }

    const amount = new anchor.BN(1_000_000); // 1 MNCA con 6 decimales
    await program.methods
      .mintTokens(amount)
      .accounts({
        mint: mintPda,
        destination: ata,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const burnAmount = new anchor.BN(100_000);
    await program.methods
      .burnTokens(burnAmount)
      .accounts({
        mint: mintPda,
        source: ata,
        authority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Balance esperado: 1_000_000 - 100_000 = 900_000
    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(ata);
    expect(Number(tokenAccountInfo.value.amount)).to.equal(900_000);
  });
});
