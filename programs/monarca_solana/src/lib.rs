//! Programa Solana del token **MONARCA (MNCA)**.
//! SPL Token con mint en PDA fijo, mint/burn para bridge y 6 decimales alineados al contrato.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};

declare_id!("97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv");

#[error_code]
pub enum ErrorCode {
    #[msg("El monto debe ser mayor que cero.")]
    InvalidAmount,
}

/// Decimals del token MONARCA (MNCA), alineado con el contrato.
pub const MONARCA_DECIMALS: u8 = 6;

/// Tamaño de una cuenta Mint SPL (Token Program).
const MINT_ACCOUNT_SIZE: u64 = 82;

#[program]
pub mod monarca_solana {
    use super::*;

    /// Crea el Mint del token MONARCA (MNCA) en un PDA fijo (actualizable; mismo mint tras upgrades).
    /// Solo se puede llamar una vez; la segunda llamada falla porque la cuenta ya existe.
    /// El mint queda con mint_authority y freeze_authority = authority, 6 decimales.
    pub fn initialize_mint(ctx: Context<InitializeMint>) -> Result<()> {
        let lamports = ctx.accounts.rent.minimum_balance(MINT_ACCOUNT_SIZE as usize);

        let create_ix = system_instruction::create_account(
            &ctx.accounts.authority.key(),
            &ctx.accounts.mint.key(),
            lamports,
            MINT_ACCOUNT_SIZE as u64,
            &ctx.accounts.token_program.key(),
        );
        anchor_lang::solana_program::program::invoke(
            &create_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.mint.to_account_info(),
            ],
        )?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::InitializeMint2 {
                mint: ctx.accounts.mint.to_account_info(),
            },
        );
        token::initialize_mint2(
            cpi_ctx,
            MONARCA_DECIMALS,
            &ctx.accounts.authority.key(),
            Some(&ctx.accounts.authority.key()),
        )?;
        Ok(())
    }

    /// Emite tokens (p. ej. para bridge o suministro inicial). Solo la authority del mint puede mintear.
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::mint_to(cpi_ctx, amount)?;
        Ok(())
    }

    /// Quema tokens (p. ej. para bridge o deflación). El signer debe ser el dueño del token account.
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::burn(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    /// Cuenta Mint en PDA; se crea con owner = Token Program y luego se inicializa.
    /// CHECK: validado por dirección PDA
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: UncheckedAccount<'info>,

    /// Paga la creación del mint y queda como mint_authority y freeze_authority.
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Sysvar Rent para calcular lamports de la cuenta Mint (obligatorio en la tx).
    pub rent: Sysvar<'info, Rent>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// Mint MONARCA (PDA del programa).
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: Account<'info, Mint>,

    /// Token account de destino; debe ser del mismo mint.
    #[account(mut, constraint = destination.mint == mint.key())]
    pub destination: Account<'info, TokenAccount>,

    /// Debe ser la mint_authority configurada en el mint (la que llamó a initialize_mint).
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    /// Mint MONARCA (PDA del programa).
    #[account(mut, seeds = [b"mint"], bump)]
    pub mint: Account<'info, Mint>,

    /// Token account del que se quema; debe ser del mismo mint.
    #[account(mut, constraint = source.mint == mint.key())]
    pub source: Account<'info, TokenAccount>,

    /// Debe ser el dueño del token account (source.owner); el Token Program lo valida en la CPI.
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
