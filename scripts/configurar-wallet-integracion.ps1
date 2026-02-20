# Configura Solana CLI para usar la wallet de la carpeta integracion/
# Así Anchor y Solana CLI usan el mismo keypair: solana/integracion/id.json

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$IntegracionDir = Join-Path $ScriptDir "integracion"
$Keypair = Join-Path $IntegracionDir "id.json"

if (-not (Test-Path $Keypair)) {
    Write-Host "Crea la carpeta y coloca tu keypair:" -ForegroundColor Yellow
    Write-Host "  $IntegracionDir\id.json" -ForegroundColor White
    New-Item -ItemType Directory -Force -Path $IntegracionDir | Out-Null
    Write-Host "Carpeta creada. Copia tu archivo de wallet como 'id.json' y vuelve a ejecutar este script." -ForegroundColor Yellow
    exit 1
}

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if (Get-Command solana -ErrorAction SilentlyContinue) {
    solana config set --keypair $Keypair
    solana config set --url devnet
    Write-Host "Wallet configurada: $Keypair" -ForegroundColor Green
    Write-Host "Dirección: $(solana address)" -ForegroundColor Green
    Write-Host "Balance: $(solana balance)" -ForegroundColor Green
} else {
    Write-Host "Solana CLI no encontrado. Anchor seguirá usando integracion/id.json desde Anchor.toml." -ForegroundColor Yellow
}
