<#
.SYNOPSIS
  Pipeline completo de despliegue del token MONARCA (MNCA) en Solana MAINNET.
  Ejecuta: verificación → build → deploy → initialize_mint → metadata.

.DESCRIPTION
  Automatiza todo el proceso para evitar errores y pasos manuales.
  Usa SOL real. Ejecutar solo cuando estés listo para mainnet.

.PARAMETER SkipMetadata
  Si se especifica, omite la creación de metadata (útil si no tienes METADATA_URI configurado).

.PARAMETER NoPrompt
  No pide confirmación si el balance es bajo. Continúa o falla según el umbral.

.EXAMPLE
  .\scripts\desplegar-solana-completo.ps1
  .\scripts\desplegar-solana-completo.ps1 -SkipMetadata -NoPrompt
#>

param(
  [switch]$SkipMetadata,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$SolanaRoot = $ScriptDir
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
  $SolanaRoot = Join-Path (Split-Path $SolanaRoot -Parent) "solana"
}
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
  Write-Host "[ERROR] No se encontró Anchor.toml. Ejecuta desde solana/ o la raíz del repo." -ForegroundColor Red
  exit 1
}

$ProgramId = "97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv"

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  if (Test-Path "$env:USERPROFILE\.cargo\bin") { $env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path }
  $sr = "$env:USERPROFILE\.local\share\solana\install\releases"
  if (Test-Path $sr) {
    $v = Get-ChildItem $sr -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($v) { $s = Join-Path $v.FullName "solana-release\bin"; if (Test-Path $s) { $env:Path = "$s;" + $env:Path } }
  }
  $env:HOME = $env:USERPROFILE
}
function Ensure-QryptaJunction {
  $link = Join-Path $SolanaRoot "programs\qrypta_solana"
  $target = Join-Path $SolanaRoot "programs\monarca_solana"
  if (-not (Test-Path $link)) { cmd /c mklink /J $link $target 2>$null }
}

function Write-Step { param($n, $msg) Write-Host "`n--- Paso $n : $msg ---" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err { param($msg) Write-Host "  [ERROR] $msg" -ForegroundColor Red; exit 1 }
function Write-Warn { param($msg) Write-Host "  [AVISO] $msg" -ForegroundColor Yellow }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Despliegue COMPLETO Solana MAINNET" -ForegroundColor Cyan
Write-Host "  Token MONARCA (MNCA)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Raíz: $SolanaRoot`n" -ForegroundColor Gray

# --- Refrescar PATH (mismo que listo-y-desplegar-solana.ps1) ---
Refresh-Path

# --- Paso 1: Verificar herramientas ---
Write-Step 1 "Verificar herramientas"
$missing = @()
foreach ($cmd in @("rustc", "solana", "anchor", "node")) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { Write-Ok $cmd }
  else { Write-Err "Falta: $cmd. Ejecuta .\scripts\verificar-entorno.ps1" }
}

# --- Paso 2: Verificar wallet y cluster ---
Write-Step 2 "Wallet y cluster"
solana config set --url mainnet-beta 2>$null
$walletPath = Join-Path $SolanaRoot "integracion\id.json"
if (-not (Test-Path $walletPath)) {
  Write-Err "No existe integracion/id.json. Crea o copia tu keypair ahí."
}
Write-Ok "Wallet: integracion/id.json"

$balance = solana balance 2>$null
$addr = solana address 2>$null
Write-Host "  Dirección: $addr" -ForegroundColor Gray
Write-Host "  Balance: $balance" -ForegroundColor Gray
$balanceNum = ($balance -replace ' SOL','') -as [double]
if ($balanceNum -lt 2) {
  if (-not $NoPrompt) {
    Write-Warn "Balance bajo. Deploy requiere ~2-5 SOL."
    $confirm = Read-Host "  Continuar de todos modos? (s/N)"
    if ($confirm -ne 's' -and $confirm -ne 'S') { exit 1 }
  } else {
    Write-Err "Balance insuficiente ($balance). Necesitas al menos ~2 SOL."
  }
}
Write-Ok "Cluster: mainnet-beta"

# --- Paso 3: METADATA_URI (si no SkipMetadata) ---
if (-not $SkipMetadata) {
  Write-Step 3 "Verificar METADATA_URI"
  $uriPath = Join-Path $SolanaRoot "scripts\METADATA_URI.txt"
  if (-not (Test-Path $uriPath)) {
    Write-Err "scripts/METADATA_URI.txt no existe. Crea el JSON en Pinata y guarda la URL ahí, o usa -SkipMetadata."
  }
  $uri = (Get-Content $uriPath -Raw).Trim()
  if ($uri -notmatch "https?://") {
    Write-Err "METADATA_URI.txt vacío o inválido. Debe ser una URL válida (p. ej. Pinata)."
  }
  Write-Ok "METADATA_URI configurado"
}

# --- Pasos 4-9: ejecutar desde solana/ ---
Refresh-Path
Ensure-QryptaJunction
Push-Location $SolanaRoot
try {
  Write-Step 4 "npm install"
  npm install --silent 2>$null
  if ($LASTEXITCODE -ne 0) { npm install }
  Write-Ok "Dependencias instaladas"

  Write-Step 5 "anchor build"
  anchor keys sync 2>&1
  if ($LASTEXITCODE -ne 0) { Write-Warn "anchor keys sync falló; continúo con build." }
  anchor build
  if ($LASTEXITCODE -ne 0) { Write-Err "anchor build falló." }
  Write-Ok "Build completado"

  Write-Step 6 "anchor deploy (mainnet)"
  anchor deploy --provider.cluster mainnet
  if ($LASTEXITCODE -ne 0) { Write-Err "anchor deploy falló." }
  Write-Ok "Programa desplegado"

  Write-Step 7 "Verificación post-despliegue"
  $programInfo = solana program show $ProgramId 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "No se pudo verificar el programa (solana program show). El deploy puede haber sido exitoso."
  } else {
    Write-Ok "Programa verificado en chain"
    Write-Host $programInfo -ForegroundColor Gray
  }

  Write-Step 8 "initialize_mint"
  $env:CLUSTER = "mainnet"
  $env:PROGRAM_ID = $ProgramId
  npx ts-node scripts/initialize-mint-solana.ts
  if ($LASTEXITCODE -ne 0) { Write-Err "initialize_mint falló." }
  Write-Ok "Mint inicializado"

  if (-not $SkipMetadata) {
    Write-Step 9 "Crear metadata Metaplex"
    npx ts-node scripts/create-metadata-solana.ts
    if ($LASTEXITCODE -ne 0) { Write-Err "create-metadata-solana falló." }
    Write-Ok "Metadata creada"
  } else {
    Write-Host "`n--- Paso 9 : Metadata omitida (-SkipMetadata) ---" -ForegroundColor Yellow
    Write-Host "  Para crear metadata después: `$env:CLUSTER='mainnet'; npx ts-node scripts/create-metadata-solana.ts" -ForegroundColor Gray
  }

  Write-Host "`n========================================" -ForegroundColor Green
  Write-Host "  DESPLIEGUE COMPLETO EXITOSO" -ForegroundColor Green
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "  Program ID: $ProgramId" -ForegroundColor Gray
  Write-Host "  Mint PDA: (seeds=['mint'])" -ForegroundColor Gray
  Write-Host "  Explorador: https://explorer.solana.com/address/$ProgramId" -ForegroundColor Gray
  Write-Host ""
} finally {
  Pop-Location
}
