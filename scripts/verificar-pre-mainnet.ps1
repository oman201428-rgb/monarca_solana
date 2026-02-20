# Verificación previa al despliegue en Solana MAINNET.
# Ejecutar antes de desplegar-solana-mainnet.ps1.

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$SolanaRoot = $ScriptDir
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
    $SolanaRoot = Join-Path (Split-Path $SolanaRoot -Parent) "solana"
}

Write-Host "`n=== Verificación pre-mainnet (token MONARCA / MNCA) ===" -ForegroundColor Cyan

$ok = $true

# 1. Herramientas
foreach ($cmd in @("rustc", "solana", "anchor", "node")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] $cmd" -ForegroundColor Green
    } else {
        Write-Host "  [FALTA] $cmd" -ForegroundColor Red
        $ok = $false
    }
}

# 2. Wallet
$walletPath = Join-Path $SolanaRoot "integracion\id.json"
if (Test-Path $walletPath) {
    Write-Host "  [OK] integracion/id.json existe" -ForegroundColor Green
} else {
    Write-Host "  [FALTA] integracion/id.json" -ForegroundColor Red
    $ok = $false
}

# 3. Cluster (solo si solana está disponible)
if (Get-Command solana -ErrorAction SilentlyContinue) {
  solana config set --url mainnet-beta 2>$null
  $url = (solana config get 2>$null | Select-String "RPC URL").ToString()
  if ($url -match "mainnet") {
    Write-Host "  [OK] Cluster: mainnet-beta" -ForegroundColor Green
  } else {
    Write-Host "  [AVISO] Cluster no es mainnet: $url" -ForegroundColor Yellow
  }
} else {
  Write-Host "  [SKIP] Cluster (solana no instalado)" -ForegroundColor Gray
}

# 4. Balance (solo si solana está disponible)
if (Get-Command solana -ErrorAction SilentlyContinue) {
  $balance = solana balance 2>$null
  $balanceNum = ($balance -replace ' SOL','') -as [double]
  if ($balanceNum -ge 2) {
    Write-Host "  [OK] Balance: $balance (suficiente para deploy)" -ForegroundColor Green
  } elseif ($balanceNum -ge 0.5) {
    Write-Host "  [AVISO] Balance: $balance (recomendado >= 2 SOL)" -ForegroundColor Yellow
  } else {
    Write-Host "  [FALTA] Balance: $balance (necesitas SOL real)" -ForegroundColor Red
    $ok = $false
  }
} else {
  Write-Host "  [SKIP] Balance (solana no instalado)" -ForegroundColor Gray
}

# 5. METADATA_URI
$uriPath = Join-Path $SolanaRoot "scripts\METADATA_URI.txt"
if (Test-Path $uriPath) {
    $uri = (Get-Content $uriPath -Raw).Trim()
    if ($uri -match "https?://") {
        Write-Host "  [OK] METADATA_URI.txt configurado" -ForegroundColor Green
    } else {
        Write-Host "  [AVISO] METADATA_URI.txt vacío o inválido" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [AVISO] scripts/METADATA_URI.txt no existe (necesario para metadata)" -ForegroundColor Yellow
}

# 6. Build
if (Test-Path (Join-Path $SolanaRoot "target\deploy\monarca_solana.so")) {
    Write-Host "  [OK] target/deploy/monarca_solana.so existe" -ForegroundColor Green
} else {
    Write-Host "  [INFO] Ejecuta 'anchor build' antes del deploy" -ForegroundColor Gray
}

Write-Host ""
if ($ok) {
    Write-Host "  Listo para mainnet. Ejecuta: .\scripts\desplegar-solana-mainnet.ps1" -ForegroundColor Green
} else {
    Write-Host "  Corrige los errores antes de desplegar en mainnet." -ForegroundColor Red
    exit 1
}
