# Verifica que Rust, Solana CLI y Anchor estén listos para desplegar
# Ejecutar desde: PowerShell (no es necesario ser administrador)

$ErrorActionPreference = "Stop"
$ok = $true

Write-Host "Comprobando entorno para Solana (Anchor)..." -ForegroundColor Cyan

# Rust
try {
    $rust = rustc --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "rustc no encontrado" }
    Write-Host "  [OK] Rust: $rust" -ForegroundColor Green
} catch {
    Write-Host "  [FALTA] Rust. Instala desde https://rustup.rs/" -ForegroundColor Red
    $ok = $false
}

# Solana CLI
try {
    $solana = solana --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "solana no encontrado" }
    Write-Host "  [OK] Solana CLI: $solana" -ForegroundColor Green
} catch {
    Write-Host "  [FALTA] Solana CLI. Instala desde https://docs.solanalabs.com/cli/install" -ForegroundColor Red
    $ok = $false
}

# Anchor
try {
    $anchor = anchor --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "anchor no encontrado" }
    Write-Host "  [OK] Anchor: $anchor" -ForegroundColor Green
} catch {
    Write-Host "  [FALTA] Anchor. Instala con: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force; avm install latest; avm use latest" -ForegroundColor Red
    $ok = $false
}

# Node (opcional pero recomendado para tests)
try {
    $node = node --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "node no encontrado" }
    Write-Host "  [OK] Node.js: $node" -ForegroundColor Green
} catch {
    Write-Host "  [AVISO] Node.js no encontrado (recomendado para tests). https://nodejs.org/" -ForegroundColor Yellow
}

# Wallet por defecto
try {
    $addr = solana address 2>$null
    if ($addr) {
        Write-Host "  [OK] Wallet por defecto: $addr" -ForegroundColor Green
    } else { throw "sin wallet" }
} catch {
    Write-Host "  [AVISO] Configura una wallet: solana keygen new" -ForegroundColor Yellow
}

# Cluster actual
try {
    $url = solana config get 2>$null | Select-String "RPC URL"
    Write-Host "  [INFO] $url" -ForegroundColor Gray
} catch { }

Write-Host ""
if ($ok) {
    Write-Host "Entorno listo. Siguiente: cd solana; npm install; anchor build; anchor deploy" -ForegroundColor Green
} else {
    Write-Host "Instala los componentes marcados como [FALTA] y vuelve a ejecutar este script." -ForegroundColor Red
    exit 1
}
