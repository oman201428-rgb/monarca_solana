# Despliegue completo MONARCA (SPL) en mainnet
# Incluye: token, metadata, mint inicial, y opcionalmente pool Raydium
#
# Ejecutar: .\scripts\desplegar-todo-spl-mainnet.ps1
# Con pool:   .\scripts\desplegar-todo-spl-mainnet.ps1 -CrearPool -CantidadMnca 500 -CantidadUsdc 500

param(
    [switch]$CrearPool = $false,
    [int]$CantidadMnca = 1000,
    [int]$CantidadUsdc = 1000,
    [switch]$SaltarVerificacion = $false,
    [switch]$SoloMetadataYMint = $false
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:CLUSTER = "mainnet"

Write-Host ""
Write-Host "========================================"
Write-Host "  DESPLIEGUE COMPLETO MONARCA (SPL)"
Write-Host "  Mainnet"
Write-Host "========================================"
Write-Host ""

# Verificacion previa
if (-not $SaltarVerificacion) {
    & "$PSScriptRoot\verificar-pre-despliegue-spl.ps1"
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host ""
}

# 1. Crear token (omitir si SoloMetadataYMint)
if (-not $SoloMetadataYMint) {
    Write-Host "=== 1/4 Crear token MONARCA (MNCA) ===" -ForegroundColor Cyan
    npx ts-node scripts/crear-token-spl.ts
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host ""
} else {
    if (-not (Test-Path "integracion\MINT_ADDRESS.txt")) {
        Write-Host "[FALLO] SoloMetadataYMint requiere integracion/MINT_ADDRESS.txt (token ya creado)" -ForegroundColor Red
        exit 1
    }
    Write-Host "=== 1/4 Omitido (SoloMetadataYMint) ===" -ForegroundColor Gray
}

# 2. Crear metadata
Write-Host "=== 2/4 Crear metadata (logo, nombre) ===" -ForegroundColor Cyan
npx ts-node scripts/create-metadata-solana.ts
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host ""

# 3. Mintear cantidad inicial
$cantidadRaw = $CantidadMnca * 1000000  # 6 decimals
Write-Host "=== 3/4 Mintear $CantidadMnca MNCA ===" -ForegroundColor Cyan
npx ts-node scripts/mint-tokens-spl.ts $cantidadRaw
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host ""

# 4. Pool (opcional)
if ($CrearPool) {
    if (-not (Test-Path "node_modules\@raydium-io\raydium-sdk-v2")) {
        Write-Host "[FALLO] Raydium SDK no instalado. Ejecuta: npm install" -ForegroundColor Red
        exit 1
    }
    Write-Host "=== 4/4 Crear pool MNCA/USDC en Raydium ===" -ForegroundColor Cyan
    Write-Host "  Ratio: $CantidadMnca MNCA : $CantidadUsdc USDC (1 MNCA = 1 USD)" -ForegroundColor Gray
    npx ts-node scripts/crear-pool-raydium-mnca-usdc.ts $CantidadMnca $CantidadUsdc
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    Write-Host "=== 4/4 Pool omitido (usa -CrearPool para crearlo) ===" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================"
Write-Host "  DESPLIEGUE COMPLETO" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "  Mint:    integracion/MINT_ADDRESS.txt"
Write-Host "  Mintear: npx ts-node scripts/mint-tokens-spl.ts <cantidad_raw>"
Write-Host "  Quemar:  npx ts-node scripts/burn-tokens-spl.ts <cantidad_raw>"
if (-not $CrearPool) {
    Write-Host ""
    Write-Host "  Para crear pool (mostrar valor en wallets):"
    Write-Host "    npx ts-node scripts/crear-pool-raydium-mnca-usdc.ts 500 500"
}
Write-Host ""
