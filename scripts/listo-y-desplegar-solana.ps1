<#
.SYNOPSIS
  Verificación completa pre-despliegue y, opcionalmente, ejecución del despliegue en Solana mainnet.
  Ejecuta todas las comprobaciones necesarias para evitar errores al desplegar o verificar.

.DESCRIPTION
  1. Refresca PATH (Rust, Solana, Anchor, Cargo).
  2. Verifica entorno (verificar-entorno.ps1).
  3. Verifica pre-despliegue SPL (wallet, METADATA_URI, Node, balance).
  4. Verifica pre-mainnet (herramientas, wallet, cluster, balance, metadata, build).
  5. Si todo OK y -Desplegar: ejecuta desplegar-solana-completo.ps1.
  Si no se pasa -Desplegar, solo verifica y muestra el comando para desplegar.

.PARAMETER Desplegar
  Si se especifica, después de las verificaciones ejecuta el pipeline completo de despliegue.

.PARAMETER SkipMetadata
  Se pasa a desplegar-solana-completo.ps1 si se usa -Desplegar.

.PARAMETER NoPrompt
  Se pasa a desplegar-solana-completo.ps1 si se usa -Desplegar (no pide confirmación por balance bajo).

.EXAMPLE
  .\scripts\listo-y-desplegar-solana.ps1
  .\scripts\listo-y-desplegar-solana.ps1 -Desplegar
  .\scripts\listo-y-desplegar-solana.ps1 -Desplegar -NoPrompt
#>

param(
  [switch]$Desplegar,
  [switch]$SkipMetadata,
  [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$SolanaRoot = $ScriptDir
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
  $SolanaRoot = Join-Path (Split-Path $ScriptDir -Parent) "solana"
}
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
  Write-Host "[ERROR] No se encontró Anchor.toml. Ejecuta desde solana/ o desde solana/scripts/." -ForegroundColor Red
  exit 1
}

# Asegurar PATH para Rust, Solana, Anchor
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
if (Test-Path "$env:USERPROFILE\.cargo\bin") { $env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path }
$sr = "$env:USERPROFILE\.local\share\solana\install\releases"
if (Test-Path $sr) {
  $v = Get-ChildItem $sr -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($v) { $s = Join-Path $v.FullName "solana-release\bin"; if (Test-Path $s) { $env:Path = "$s;" + $env:Path } }
}
$env:HOME = $env:USERPROFILE

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Verificación completa pre-despliegue Solana" -ForegroundColor Cyan
Write-Host "  Raíz: $SolanaRoot" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan

$fallo = $false
$scriptsPath = Join-Path $SolanaRoot "scripts"

# 1. Verificar entorno (Rust, Solana CLI, Anchor, Node)
Write-Host "--- 1/3 Verificación de entorno ---" -ForegroundColor Cyan
& { & (Join-Path $scriptsPath "verificar-entorno.ps1") }
if ($LASTEXITCODE -ne 0) { $fallo = $true }
if ($fallo) {
  Write-Host "`n[ERROR] Corrige el entorno y vuelve a ejecutar." -ForegroundColor Red
  exit 1
}

# 2. Verificación pre-despliegue SPL (wallet, METADATA_URI, etc.)
Write-Host "`n--- 2/3 Verificación pre-despliegue SPL ---" -ForegroundColor Cyan
Push-Location $SolanaRoot
try {
  & { & (Join-Path $scriptsPath "verificar-pre-despliegue-spl.ps1") }
  if ($LASTEXITCODE -ne 0) { $fallo = $true }
} finally {
  Pop-Location
}
if ($fallo) {
  Write-Host "`n[ERROR] Corrige los fallos antes de desplegar (wallet, METADATA_URI, etc.)." -ForegroundColor Red
  exit 2
}

# 3. Verificación pre-mainnet
Write-Host "`n--- 3/3 Verificación pre-mainnet ---" -ForegroundColor Cyan
& { & (Join-Path $scriptsPath "verificar-pre-mainnet.ps1") }
if ($LASTEXITCODE -ne 0) { $fallo = $true }
if ($fallo) {
  Write-Host "`n[ERROR] Corrige los fallos antes de desplegar en mainnet." -ForegroundColor Red
  exit 3
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Todas las verificaciones OK" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

if ($Desplegar) {
  Write-Host "Ejecutando pipeline de despliegue completo...`n" -ForegroundColor Cyan
  $argsDesplegar = @()
  if ($SkipMetadata) { $argsDesplegar += "-SkipMetadata" }
  if ($NoPrompt) { $argsDesplegar += "-NoPrompt" }
  & (Join-Path $scriptsPath "desplegar-solana-completo.ps1") @argsDesplegar
  $exitDeploy = $LASTEXITCODE
  if ($exitDeploy -ne 0) {
    Write-Host "`n[ERROR] El despliegue falló (código $exitDeploy)." -ForegroundColor Red
    exit $exitDeploy
  }
  Write-Host "`nProceso completado: verificación + despliegue." -ForegroundColor Green
  exit 0
}

Write-Host "Para desplegar en mainnet ejecuta:" -ForegroundColor White
Write-Host "  .\scripts\listo-y-desplegar-solana.ps1 -Desplegar" -ForegroundColor Yellow
Write-Host "`nO solo el pipeline (sin volver a verificar):" -ForegroundColor Gray
Write-Host "  .\scripts\desplegar-solana-completo.ps1" -ForegroundColor Gray
Write-Host ""
exit 0
