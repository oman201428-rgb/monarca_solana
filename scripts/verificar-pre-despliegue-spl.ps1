# Verificación previa al despliegue MONARCA (SPL)
# Ejecutar: .\scripts\verificar-pre-despliegue-spl.ps1

$ErrorActionPreference = "Stop"
$cluster = if ($env:CLUSTER) { $env:CLUSTER } else { "mainnet" }

Write-Host ""
Write-Host "========================================"
Write-Host "  Verificación Pre-Despliegue SPL"
Write-Host "  Cluster: $cluster"
Write-Host "========================================"
Write-Host ""

$fallos = 0
$rutaBase = $PSScriptRoot + "\.."

# 1. Wallet
if (-not (Test-Path "$rutaBase\integracion\id.json")) {
    Write-Host "[FALLO] Falta integracion/id.json (wallet)" -ForegroundColor Red
    Write-Host "  Usa: .\scripts\configurar-wallet-integracion.ps1 o import-phantom-wallet.ts" -ForegroundColor Yellow
    $fallos++
} else {
    Write-Host "[OK] Wallet: integracion/id.json" -ForegroundColor Green
}

# 2. METADATA_URI
$metaUri = $env:METADATA_URI
if (-not $metaUri) {
    $metaPath = "$rutaBase\scripts\METADATA_URI.txt"
    if (Test-Path $metaPath) {
        $raw = Get-Content $metaPath -Raw -ErrorAction SilentlyContinue
        if ($raw) { $metaUri = $raw.Trim() }
    }
}
if (-not $metaUri -or $metaUri -match "^\s*$") {
    Write-Host "[FALLO] METADATA_URI no definido" -ForegroundColor Red
    Write-Host "  Crea scripts/METADATA_URI.txt con la URL de Pinata (ver QUE_HACER_EN_PINATA.md)" -ForegroundColor Yellow
    $fallos++
} else {
    Write-Host "[OK] METADATA_URI: $metaUri" -ForegroundColor Green
}

# 3. Node/npm
try {
    $null = node -v
    Write-Host "[OK] Node instalado" -ForegroundColor Green
} catch {
    Write-Host "[FALLO] Node no encontrado. Instala Node.js 18+" -ForegroundColor Red
    $fallos++
}
if (-not (Test-Path "$rutaBase\node_modules\@raydium-io\raydium-sdk-v2")) {
    Write-Host "[AVISO] Raydium SDK no instalado. Ejecuta: npm install" -ForegroundColor Yellow
    Write-Host "  (Solo necesario si vas a crear pool)" -ForegroundColor Gray
}

# 4. Balance SOL (solo mainnet)
if ($cluster -eq "mainnet") {
    Set-Location $rutaBase
    try {
        $balance = solana balance integracion/id.json 2>$null
        if ($balance -match "(\d+\.?\d*)\s+SOL") {
            $sol = [double]$matches[1]
            if ($sol -lt 0.05) {
                Write-Host "[AVISO] Saldo bajo: $sol SOL. Recomendado: 0.1 SOL minimo" -ForegroundColor Yellow
            } else {
                Write-Host "[OK] SOL: $sol" -ForegroundColor Green
            }
        } else {
            Write-Host "[AVISO] No se pudo leer balance (solana CLI)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[AVISO] Solana CLI no disponible o wallet sin configurar" -ForegroundColor Yellow
    }
}

# 5. Para pool: USDC
Write-Host ""
Write-Host "Para crear pool MNCA/USDC (mostrar valor en wallets):" -ForegroundColor Cyan
Write-Host "  - Necesitas USDC en tu wallet (comprar en Jupiter, etc.)" -ForegroundColor Gray
Write-Host "  - Cantidad sugerida: 500-1000 USDC para liquidity inicial" -ForegroundColor Gray
Write-Host ""

if ($fallos -gt 0) {
    Write-Host "========================================"
    Write-Host "  Corrige los fallos antes de desplegar" -ForegroundColor Red
    Write-Host "========================================"
    exit 1
}

Write-Host "========================================"
Write-Host "  Listo para desplegar" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
