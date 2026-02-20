# Script que prepara todo y despliega MONARCA en una sola ejecución
# Crea wallet si falta, hace airdrop en devnet, despliega token con logo y nombre

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$mainnet = ($env:CLUSTER -eq "mainnet") -or ($env:CLUSTER -eq "")
if (-not $mainnet) { $env:CLUSTER = "devnet" } else { $env:CLUSTER = "mainnet" }

Write-Host ""
Write-Host "========================================"
Write-Host "  MONARCA - Despliegue completo"
Write-Host "  Cluster: $env:CLUSTER"
Write-Host "========================================"
Write-Host ""

# Crear wallet si no existe (requiere Solana CLI)
if (-not (Test-Path "integracion\id.json")) {
    $solana = Get-Command solana-keygen -ErrorAction SilentlyContinue
    if ($solana) {
        Write-Host "Creando wallet..."
        solana-keygen new --no-bip39-passphrase --outfile integracion/id.json --force 2>$null
        $pub = solana address -k integracion/id.json
        Set-Content -Path "integracion\DIRECCION_PARA_RECIBIR_SOL.txt" -Value $pub
        Write-Host "Wallet creada: $pub"
    } else {
        Write-Host "[FALLO] Falta integracion/id.json. Crea wallet con: npx ts-node scripts/import-phantom-wallet.ts" -ForegroundColor Red
        exit 1
    }
}

# Airdrop en devnet (requiere Solana CLI)
if (-not $mainnet) {
    $solana = Get-Command solana -ErrorAction SilentlyContinue
    if ($solana) {
        Write-Host "Solicitando airdrop (devnet)..."
        solana airdrop 2 integracion/id.json --url devnet 2>$null
        Start-Sleep -Seconds 2
    } else {
        Write-Host "[AVISO] Solana CLI no en PATH. Asegurate de tener SOL en devnet (solana airdrop 2)" -ForegroundColor Yellow
    }
}

# METADATA_URI (obligatorio para logo y nombre)
$meta = $null
if (Test-Path "scripts\METADATA_URI.txt") { $meta = (Get-Content "scripts\METADATA_URI.txt" -Raw -ErrorAction SilentlyContinue).Trim() }
if (-not $meta) {
    Write-Host "[FALLO] Falta scripts/METADATA_URI.txt" -ForegroundColor Red
    Write-Host "  1. Sube scripts/metadata-monarca.json a Pinata (pinata.cloud)" -ForegroundColor Yellow
    Write-Host "  2. Copia la URL del JSON (https://gateway.pinata.cloud/ipfs/...)" -ForegroundColor Yellow
    Write-Host "  3. Pegala en scripts/METADATA_URI.txt" -ForegroundColor Yellow
    Write-Host "  Ver: scripts/QUE_HACER_EN_PINATA.md" -ForegroundColor Gray
    exit 1
}

# Desplegar
Write-Host ""
npx ts-node scripts/desplegar-mnca-una-sola-vez.ts
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Añade el token en Phantom: Settings > Add Token > pega el Mint de integracion/MINT_ADDRESS.txt"
Write-Host ""
