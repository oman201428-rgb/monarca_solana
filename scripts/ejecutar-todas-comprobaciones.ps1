# Ejecuta todas las comprobaciones de listados y on-chain.
# Requisitos: Node.js, npm install en solana/
# Para Jupiter: hace falta red donde token.jup.ag resuelva (en algunas redes no).

$ErrorActionPreference = "Continue"
$mintRef = "38gRbAsqwiZMhMojWN3pFt27PCSitUfRGju3RDUi1QyD"

Write-Host "`n=== 1. Listados (CoinGecko + Jupiter si hay red) ===" -ForegroundColor Cyan
Set-Location $PSScriptRoot\..
npm run verificar-listados -- $mintRef

Write-Host "`n=== 2. Comparación on-chain (MNCA vs referencia) ===" -ForegroundColor Cyan
npm run comparar-token -- $mintRef

Write-Host "`nComprobaciones terminadas." -ForegroundColor Green
Write-Host "Si Jupiter sale 'no disponible', ejecuta desde una red donde token.jup.ag resuelva (p. ej. otra WiFi o datos)." -ForegroundColor Gray
