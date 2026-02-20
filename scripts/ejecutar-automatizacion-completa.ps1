# Script maestro: orden 1 -> 2 -> 3
# 1. Informe diferencias reales (por qué el otro token se muestra y el nuestro no)
# 2. Hacer token visible (metadata, CSV Jupiter, pasos Trust/CoinGecko/etc.)
# 3. Verificación de listos y comprobaciones
# Si hay errores, se muestran y el script termina con código de salida distinto de 0.

$ErrorActionPreference = "Stop"
$SolanaRoot = $PSScriptRoot -replace "\\scripts$", ""
Set-Location $SolanaRoot

$failed = $false
$step = 0

# --- Paso 1: Informe diferencias reales ---
$step = 1
Write-Host "`n=== Paso ${step}: Generar informe de diferencias reales ===`n" -ForegroundColor Cyan
try {
    npx ts-node scripts/generar-informe-diferencias-reales.ts
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    Write-Host "Error en paso ${step}: $_" -ForegroundColor Red
    $failed = $true
}
if ($failed) {
    Write-Host "Detenido por error en paso ${step}." -ForegroundColor Red
    exit 1
}

# --- Paso 2: Hacer token visible ---
$step = 2
Write-Host "`n=== Paso ${step}: Hacer token visible (metadata, Jupiter CSV, pasos) ===`n" -ForegroundColor Cyan
try {
    npx ts-node scripts/hacer-token-visible.ts
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    Write-Host "Error en paso ${step}: $_" -ForegroundColor Red
    $failed = $true
}
if ($failed) {
    Write-Host "Detenido por error en paso ${step}." -ForegroundColor Red
    exit 2
}

# --- Paso 3: Verificar listos y comprobaciones ---
$step = 3
Write-Host "`n=== Paso ${step}: Verificar listos para tareas ===`n" -ForegroundColor Cyan
try {
    & pwsh -File scripts/verificar-listos-para-tareas.ps1
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    Write-Host "Error en paso ${step}: $_" -ForegroundColor Red
    $failed = $true
}

Write-Host "`n=== Ejecutando comprobaciones adicionales ===`n" -ForegroundColor Cyan
try {
    & pwsh -File scripts/ejecutar-todas-comprobaciones.ps1
    if ($LASTEXITCODE -ne 0) { $failed = $true }
} catch {
    Write-Host "Error en comprobaciones: $_" -ForegroundColor Red
    $failed = $true
}

if ($failed) {
    Write-Host "`nAlgunos pasos fallaron. Revisa la salida arriba." -ForegroundColor Yellow
    exit 3
}
Write-Host "`nAutomatización completada." -ForegroundColor Green
exit 0
