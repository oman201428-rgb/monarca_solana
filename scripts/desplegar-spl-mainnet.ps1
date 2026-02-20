# Despliegue MONARCA (MNCA) usando SPL Token - Coste ~$1-10
# Ejecutar: .\scripts\desplegar-spl-mainnet.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "========================================"
Write-Host "  Despliegue MONARCA (SPL) - MAINNET"
Write-Host "  Coste aproximado: ~0.1 SOL (~`$8)"
Write-Host "========================================"
Write-Host ""

$env:CLUSTER = "mainnet"

# 1. Crear token
Write-Host "=== 1. Crear token MONARCA (MNCA) ==="
npx ts-node scripts/crear-token-spl.ts
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Crear metadata
Write-Host ""
Write-Host "=== 2. Crear metadata (logo, nombre) ==="
npx ts-node scripts/create-metadata-solana.ts
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "========================================"
Write-Host "  DESPLIEGUE SPL COMPLETO"
Write-Host "========================================"
Write-Host "  Mint: ver integracion/MINT_ADDRESS.txt"
Write-Host "  Para mintear: npx ts-node scripts/mint-tokens-spl.ts <cantidad>"
Write-Host "  Para quemar: npx ts-node scripts/burn-tokens-spl.ts <cantidad>"
Write-Host ""
