# Despliegue del programa token MONARCA (MNCA) en Solana MAINNET.
# IMPORTANTE: usa SOL real. Ejecutar solo cuando estés listo para mainnet.
# Ejecutar desde: PowerShell, en la raíz del repo o desde solana/.
# Para pipeline completo automatizado: .\scripts\desplegar-solana-completo.ps1

param([switch]$NoPrompt)

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

# Asegurar PATH (Solana/Anchor/Cargo) por si se ejecuta desde un contexto sin ellos
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
if (Test-Path "$env:USERPROFILE\.cargo\bin") { $env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path }
$sr = "$env:USERPROFILE\.local\share\solana\install\releases"
if (Test-Path $sr) {
  $v = Get-ChildItem $sr -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($v) { $s = Join-Path $v.FullName "solana-release\bin"; if (Test-Path $s) { $env:Path = "$s;" + $env:Path } }
}
$env:HOME = $env:USERPROFILE

Write-Host "`n=== Despliegue Solana MAINNET (token MONARCA / MNCA) ===" -ForegroundColor Cyan
Write-Host "  ATENCION: Usa SOL real. Asegurate de tener suficiente balance." -ForegroundColor Yellow
Write-Host "  Raíz: $SolanaRoot`n" -ForegroundColor Gray

# Verificar herramientas
$missing = @()
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) { $missing += "Rust" }
if (-not (Get-Command solana -ErrorAction SilentlyContinue)) { $missing += "Solana CLI" }
if (-not (Get-Command anchor -ErrorAction SilentlyContinue)) { $missing += "Anchor CLI" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js" }
if ($missing.Count -gt 0) {
    Write-Host "  [FALTA] $($missing -join ', '). Ejecuta primero: .\scripts\verificar-entorno.ps1" -ForegroundColor Red
    exit 1
}

# Verificar cluster mainnet
solana config set --url mainnet-beta 2>$null
$url = (solana config get 2>$null | Select-String "RPC URL").ToString()
if ($url -notmatch "mainnet") {
    Write-Host "  [AVISO] Configurando mainnet-beta..." -ForegroundColor Yellow
    solana config set --url mainnet-beta
}

# Verificar wallet
$walletPath = Join-Path $SolanaRoot "integracion\id.json"
if (-not (Test-Path $walletPath)) {
    Write-Host "  [ERROR] No existe integracion/id.json. Crea o copia tu keypair ahí." -ForegroundColor Red
    Write-Host "  Para mainnet usa una wallet con SOL real." -ForegroundColor Gray
    exit 1
}

# Verificar balance
$balance = solana balance 2>$null
Write-Host "  Wallet: $(solana address 2>$null)" -ForegroundColor Gray
Write-Host "  Balance: $balance" -ForegroundColor Gray
$balanceNum = ($balance -replace ' SOL','') -as [double]
if ($balanceNum -lt 2) {
    Write-Host "  [AVISO] Balance bajo. Deploy en mainnet requiere ~2-5 SOL (rent + fees)." -ForegroundColor Yellow
    if ($NoPrompt) {
        Write-Host "  [ERROR] Balance insuficiente. Usa -NoPrompt solo con balance >= 2 SOL." -ForegroundColor Red
        exit 1
    }
    $confirm = Read-Host "  Continuar de todos modos? (s/N)"
    if ($confirm -ne 's' -and $confirm -ne 'S') { exit 1 }
}

Push-Location $SolanaRoot
try {
    Write-Host "  1. npm install..." -ForegroundColor Yellow
    npm install --silent 2>$null
    if ($LASTEXITCODE -ne 0) { npm install }

    Write-Host "  2. anchor keys sync..." -ForegroundColor Yellow
    anchor keys sync 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "  [AVISO] keys sync falló; continúo con build." -ForegroundColor Yellow }

    Write-Host "  3. anchor build (production)..." -ForegroundColor Yellow
    anchor build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] anchor build falló." -ForegroundColor Red
        exit 1
    }

    Write-Host "  4. anchor deploy (mainnet)..." -ForegroundColor Yellow
    anchor deploy --provider.cluster mainnet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] anchor deploy falló." -ForegroundColor Red
        exit 1
    }

    $programId = (anchor keys list 2>$null | Select-String "monarca_solana").ToString().Split(" ")[-1].Trim()
    Write-Host "`n  [OK] Programa desplegado en MAINNET." -ForegroundColor Green
    Write-Host "  Program Id: $programId" -ForegroundColor Gray
    Write-Host "`n  Siguientes pasos:" -ForegroundColor Cyan
    Write-Host "  - Inicializar mint (una vez): llama initialize_mint con tu wallet como authority." -ForegroundColor White
    Write-Host "  - Metadatos: CLUSTER=mainnet npx ts-node scripts/create-metadata-solana.ts" -ForegroundColor White
    Write-Host "  - Ver: docs/solana/CHECKLIST_MAINNET_SOLANA.md" -ForegroundColor Gray
} finally {
    Pop-Location
}
