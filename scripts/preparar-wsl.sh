#!/bin/bash
# Preparación y build del token MONARCA en WSL.
# Ejecutar: wsl bash scripts/preparar-wsl.sh
# O desde WSL: cd /mnt/d/qrypta/solana && bash scripts/preparar-wsl.sh

set -e
if [ -n "$MONARCA_SOLANA_ROOT" ]; then
  SOLANA_ROOT="$MONARCA_SOLANA_ROOT"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)"
  SOLANA_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
fi
cd "$SOLANA_ROOT"

# PATH para herramientas
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

echo ""
echo "========================================"
echo "  Preparación MONARCA en WSL"
echo "========================================"
echo "  Proyecto: $SOLANA_ROOT"
echo ""

# 1. Rust
if ! command -v rustc &>/dev/null; then
  echo "=== Instalando Rust ==="
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
echo "[OK] Rust: $(rustc --version)"

# 2. Solana CLI
if ! command -v solana &>/dev/null; then
  echo ""
  echo "=== Instalando Solana CLI v1.18 ==="
  sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi
echo "[OK] Solana: $(solana --version)"

# 3. Anchor CLI
if ! command -v anchor &>/dev/null; then
  echo ""
  echo "=== Instalando Anchor CLI (puede tardar varios minutos) ==="
  cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0 --locked
  export PATH="$HOME/.cargo/bin:$PATH"
fi
echo "[OK] Anchor: $(anchor --version)"

# 4. Node (sin sudo: usa nvm en $HOME)
if ! command -v node &>/dev/null; then
  echo ""
  echo "=== Instalando Node.js (nvm, sin sudo) ==="
  if ! command -v nvm &>/dev/null; then
    export NVM_DIR="$HOME/.nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
  nvm install 18
  nvm use 18
fi
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"
echo "[OK] Node: $(node --version)"

# 5. Wallet
INTEGRACION="$SOLANA_ROOT/integracion"
mkdir -p "$INTEGRACION"
if [ ! -f "$INTEGRACION/id.json" ]; then
  echo ""
  echo "=== Creando wallet ==="
  solana-keygen new -o "$INTEGRACION/id.json" --no-bip39-passphrase --force
fi
solana config set --keypair "$INTEGRACION/id.json"
echo "[OK] Wallet: $(solana address)"

# 6. npm install
echo ""
echo "=== npm install ==="
npm install --silent 2>/dev/null || npm install
echo "[OK] Dependencias instaladas"

# 7. anchor build (--no-idl evita fallo por stack overflow en deps)
echo ""
echo "=== anchor build ==="
anchor keys sync 2>/dev/null || true
anchor build --no-idl 2>/dev/null || anchor build
# Copiar IDL manual: anchor build con IDL falla en WSL; usamos idl/ versionado
mkdir -p "$SOLANA_ROOT/target/idl"
cp -f "$SOLANA_ROOT/idl/monarca_solana.json" "$SOLANA_ROOT/target/idl/monarca_solana.json" 2>/dev/null || true
echo "[OK] Build completado"

echo ""
echo "========================================"
echo "  ENTORNO LISTO EN WSL"
echo "========================================"
echo "  Para desplegar mainnet:"
echo "    anchor deploy --provider.cluster mainnet"
echo "  Luego: CLUSTER=mainnet npx ts-node scripts/initialize-mint-solana.ts"
echo "  Luego: CLUSTER=mainnet npx ts-node scripts/create-metadata-solana.ts"
echo ""
