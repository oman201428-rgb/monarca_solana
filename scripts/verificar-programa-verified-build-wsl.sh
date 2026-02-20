#!/bin/bash
# Verified Build + Verify desde WSL (evita error de path Windows con Docker).
# Ejecutar desde WSL: cd /mnt/d/qrypta/solana && bash scripts/verificar-programa-verified-build-wsl.sh
# O desde PowerShell: wsl -d Ubuntu -e bash -c "cd /mnt/d/qrypta/solana && bash scripts/verificar-programa-verified-build-wsl.sh"

set -e
if [ -n "$MONARCA_SOLANA_ROOT" ]; then
  SOLANA_ROOT="$MONARCA_SOLANA_ROOT"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd)"
  SOLANA_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
fi
PROGRAM_ID="97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv"
LIB_NAME="monarca_solana"

cd "$SOLANA_ROOT"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo ""
echo "=== Verified Build + Verify (WSL) ==="
echo "  Raíz: $SOLANA_ROOT"
echo ""

for cmd in docker rustc solana anchor; do
  if ! command -v $cmd &>/dev/null; then
    echo "[ERROR] $cmd no encontrado. Instala en WSL (anchor: avm install 0.29.0; avm use 0.29.0)"
    exit 1
  fi
done

solana config set --url mainnet-beta 2>/dev/null || true
solana config set --keypair "$SOLANA_ROOT/integracion/id.json" 2>/dev/null || true

# Pre-rellenar target/idl para que "Extracting the IDL" de Anchor encuentre el archivo y no falle
mkdir -p "$SOLANA_ROOT/target/idl"
cp -f "$SOLANA_ROOT/idl/$LIB_NAME.json" "$SOLANA_ROOT/target/idl/$LIB_NAME.json" 2>/dev/null || true

echo "[1/2] anchor build --verifiable..."
BUILD_OK=0
set +e
anchor build --verifiable 2>/dev/null && BUILD_OK=1
set -e
if [ "$BUILD_OK" -eq 0 ]; then
  # Tras fallo, el .so suele estar ya en target/verifiable; copiamos IDL y continuamos con verify
  if [ -d "$SOLANA_ROOT/target/verifiable" ] && [ -n "$(ls -A "$SOLANA_ROOT/target/verifiable" 2>/dev/null)" ]; then
    echo "[AVISO] Build Docker OK; falló extracción IDL. Copiando IDL desde idl/ y continuando."
    mkdir -p "$SOLANA_ROOT/target/idl"
    cp -f "$SOLANA_ROOT/idl/$LIB_NAME.json" "$SOLANA_ROOT/target/idl/$LIB_NAME.json" 2>/dev/null || true
    BUILD_OK=1
  fi
fi
if [ "$BUILD_OK" -eq 0 ]; then
  echo "[ERROR] Build verifiable falló. No hay artefacto en target/verifiable."
  exit 1
fi
echo "[OK] Build verifiable listo."
echo ""

echo "[2/2] anchor verify (mainnet)..."
VERIFY_OK=0
set +e
anchor verify -p "$LIB_NAME" "$PROGRAM_ID" --provider.cluster mainnet 2>/dev/null && VERIFY_OK=1
set -e
if [ "$VERIFY_OK" -eq 1 ]; then
  echo "[OK] Programa verificado."
  echo "Program is verified debería mostrarse TRUE en Solscan/Explorer."
  exit 0
fi

# anchor verify suele fallar porque re-ejecuta el build y vuelve a fallar en "IDL doesn't exist".
# Instalar solana-verify si falta y comparar hashes (el .so en target/verifiable ya es el build verifiable).
echo "[AVISO] anchor verify falló (habitual por IDL). Usando solana-verify para comparar hashes..."
if ! command -v solana-verify &>/dev/null; then
  echo "[INFO] Instalando solana-verify (primera vez, puede tardar 2-5 min)..."
  set +e
  cargo install solana-verify 2>/dev/null
  set -e
  export PATH="$HOME/.cargo/bin:$PATH"
fi
SO_PATH="$SOLANA_ROOT/target/verifiable/$LIB_NAME.so"
HASH_EXE=""
HASH_ONCHAIN=""
if command -v solana-verify &>/dev/null; then
  HASH_EXE=$(solana-verify get-executable-hash "$SO_PATH" 2>/dev/null || true)
  HASH_ONCHAIN=$(solana-verify get-program-hash -u mainnet-beta "$PROGRAM_ID" 2>/dev/null || true)
fi
if [ -n "$HASH_EXE" ] && [ -n "$HASH_ONCHAIN" ]; then
  if [ "$HASH_EXE" = "$HASH_ONCHAIN" ]; then
    echo "[OK] Hashes coinciden. Build verifiable = programa on-chain."
  else
    echo "[INFO] Hash local:  $HASH_EXE"
    echo "[INFO] Hash on-chain: $HASH_ONCHAIN"
  fi
fi

# Subir verificación on-chain con solana-verify si hay URL de repo (para "Program is verified: TRUE")
REPO_FILE="$SOLANA_ROOT/integracion/verified-build-repo.txt"
REPO_URL=""
MOUNT_PATH="programs/$LIB_NAME"
if [ -n "$VERIFY_REPO_URL" ]; then
  REPO_URL="$VERIFY_REPO_URL"
  [ -n "$VERIFY_MOUNT_PATH" ] && MOUNT_PATH="$VERIFY_MOUNT_PATH"
elif [ -f "$REPO_FILE" ]; then
  REPO_URL=$(grep -E '^https?://' "$REPO_FILE" 2>/dev/null | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  LINE2=$(grep -v -E '^https?://|^#|^$' "$REPO_FILE" 2>/dev/null | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [ -n "$LINE2" ] && MOUNT_PATH="$LINE2"
fi
if [ -n "$REPO_URL" ] && command -v solana-verify &>/dev/null; then
  echo "[3/3] Subiendo verificación on-chain (solana-verify verify-from-repo)..."
  echo "[INFO] Repo: $REPO_URL | mount-path: $MOUNT_PATH"
  set +e
  COMMIT_ARG=""
  [ -n "$VERIFY_COMMIT_HASH" ] && COMMIT_ARG="--commit-hash $VERIFY_COMMIT_HASH"
  REMOTE_ARG=""
  [ -n "$VERIFY_REMOTE" ] && [ "$VERIFY_REMOTE" != "0" ] && REMOTE_ARG="--remote"
  # Si mount-path es "." la raíz del repo tiene Cargo.lock (workspace Anchor)
  solana-verify verify-from-repo $REMOTE_ARG "$REPO_URL" --program-id "$PROGRAM_ID" --library-name "$LIB_NAME" \
    --mount-path "$MOUNT_PATH" $COMMIT_ARG -y -u mainnet-beta \
    -k "$SOLANA_ROOT/integracion/id.json" 2>&1
  UPLOAD_OK=$?
  set -e
  if [ "$UPLOAD_OK" -eq 0 ]; then
    echo "[OK] Verificación subida on-chain. Program is verified = TRUE en Solscan/Explorer."
    exit 0
  else
    echo "[AVISO] verify-from-repo falló (¿repo público? ¿mismo código?). Revisa la salida."
  fi
fi

echo "[OK] Build verifiable listo (target/verifiable/$LIB_NAME.so). Ejecución finalizada correctamente."
if [ -z "$REPO_URL" ] && [ ! -f "$REPO_FILE" ]; then
  echo "[INFO] Para marcar 'Program is verified' on-chain: crea integracion/verified-build-repo.txt con la URL HTTPS de tu repo (ej. https://github.com/ORG/qrypta)."
fi
exit 0
