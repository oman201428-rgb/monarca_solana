# Despliegue del programa token MONARCA (MNCA) en Solana.
# Ejecutar desde: PowerShell, en la raíz del repo o desde solana/.
# Requiere: Rust, Solana CLI, Anchor CLI, Node.js (ver verificar-entorno.ps1).

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$SolanaRoot = $ScriptDir
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
    $SolanaRoot = Join-Path (Split-Path $SolanaRoot -Parent) "solana"
}
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
    Write-Host "[ERROR] No se encontró Anchor.toml. Ejecuta desde la raíz del repo o desde solana/." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Despliegue Solana (token MONARCA / MNCA) ===" -ForegroundColor Cyan
Write-Host "  Raíz: $SolanaRoot`n" -ForegroundColor Gray

# Verificación rápida de entorno
$missing = @()
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { $missing += "Rust" }
if (-not (Get-Command solana -ErrorAction SilentlyContinue)) { $missing += "Solana CLI" }
if (-not (Get-Command anchor -ErrorAction SilentlyContinue)) { $missing += "Anchor CLI" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js" }
if ($missing.Count -gt 0) {
    Write-Host "  [FALTA] $($missing -join ', '). Ejecuta primero: .\scripts\verificar-entorno.ps1" -ForegroundColor Red
    exit 1
}

Push-Location $SolanaRoot
try {
    # Wallet
    $walletPath = Join-Path $SolanaRoot "integracion\id.json"
    if (-not (Test-Path $walletPath)) {
        Write-Host "  [AVISO] No existe integracion/id.json. Crea o copia tu keypair ahí." -ForegroundColor Yellow
        Write-Host "  Ejemplo: solana-keygen new -o integracion/id.json --no-bip39-passphrase" -ForegroundColor Gray
        exit 1
    }

    Write-Host "  1. npm install..." -ForegroundColor Yellow
    npm install --silent 2>$null
    if ($LASTEXITCODE -ne 0) { npm install }

    Write-Host "  2. anchor keys sync..." -ForegroundColor Yellow
    anchor keys sync 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "  [AVISO] keys sync falló; continúo con build." -ForegroundColor Yellow }

    Write-Host "  3. anchor build..." -ForegroundColor Yellow
    anchor build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] anchor build falló." -ForegroundColor Red
        exit 1
    }

    Write-Host "  4. anchor deploy..." -ForegroundColor Yellow
    anchor deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] anchor deploy falló (¿SOL en la wallet? ¿cluster correcto?)." -ForegroundColor Red
        exit 1
    }

    $programId = (anchor keys list 2>$null | Select-String "monarca_solana").ToString().Split(" ")[-1].Trim()
    Write-Host "`n  [OK] Programa desplegado." -ForegroundColor Green
    Write-Host "  Program Id: $programId" -ForegroundColor Gray
    Write-Host "`n  Siguientes pasos:" -ForegroundColor Cyan
    Write-Host "  - Inicializar mint (una vez): llama initialize_mint con tu wallet como authority." -ForegroundColor White
    Write-Host "  - Metadatos (logo): npx ts-node scripts/create-metadata-solana.ts (lee METADATA_URI.txt si no hay env)." -ForegroundColor White
    Write-Host "  - Ver: solana/scripts/README_METADATA.md y ../SOLANA_DESPLIEGUE.md §6." -ForegroundColor Gray
} finally {
    Pop-Location
}
