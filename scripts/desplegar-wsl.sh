#!/bin/bash
# Despliegue completo MONARCA en mainnet desde WSL.
# Ejecutar: wsl bash scripts/desplegar-wsl.sh
# O desde WSL: cd /mnt/d/qrypta/solana && bash scripts/desplegar-wsl.sh

set -e
if [ -n "$MONARCA_SOLANA_ROOT" ]; then
  SOLANA_ROOT="$MONARCA_SOLANA_ROOT"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)"
  SOLANA_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
fi
PROGRAM_ID="97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv"

cd "$SOLANA_ROOT"

# PATH primero (necesario cuando se invoca desde PowerShell sin login shell)
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 18 2>/dev/null

echo ""
echo "========================================"
echo "  Despliegue completo MAINNET (WSL)"
echo "  Token MONARCA (MNCA)"
echo "========================================"
echo ""

# Verificar preparación
for cmd in rustc solana anchor node; do
  if ! command -v $cmd &>/dev/null; then
    echo "[ERROR] $cmd no encontrado. Ejecuta primero: bash scripts/preparar-wsl.sh"
    exit 1
  fi
done

# Wallet
solana config set --url mainnet-beta
solana config set --keypair "$SOLANA_ROOT/integracion/id.json"
BALANCE_RAW=$(solana balance 2>/dev/null || echo "0 SOL")
echo "Wallet: $(solana address)"
echo "Balance: $BALANCE_RAW"

# Build (--no-idl evita fallo en WSL; IDL se copia de idl/)
echo ""
echo "=== anchor build ==="
anchor build --no-idl 2>/dev/null || anchor build
mkdir -p "$SOLANA_ROOT/target/idl"
cp -f "$SOLANA_ROOT/idl/monarca_solana.json" "$SOLANA_ROOT/target/idl/monarca_solana.json" 2>/dev/null || true
echo "[OK] Build"

# Deploy
echo ""
echo "=== anchor deploy (mainnet) ==="
anchor deploy --provider.cluster mainnet
echo "[OK] Desplegado"

# Initialize mint
echo ""
echo "=== initialize_mint ==="
export CLUSTER=mainnet
export PROGRAM_ID="$PROGRAM_ID"
npx ts-node scripts/initialize-mint-solana.ts
echo "[OK] Mint inicializado"

# Metadata
echo ""
echo "=== create-metadata ==="
npx ts-node scripts/create-metadata-solana.ts
echo "[OK] Metadata creada"

echo ""
echo "========================================"
echo "  DESPLIEGUE COMPLETO EXITOSO"
echo "========================================"
echo "  Program ID: $PROGRAM_ID"
echo "  Explora: https://explorer.solana.com/address/$PROGRAM_ID"
echo ""
