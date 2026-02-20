# Comprueba si puedes ejecutar las tareas pendientes (pool, Polygon, etc.).
# Ejecutar: desde solana/ con  npm run verificar-listos
# O:  pwsh -File scripts/verificar-listos-para-tareas.ps1

$ErrorActionPreference = "SilentlyContinue"
# PSScriptRoot = solana/scripts; parent = solana; repo root = parent of solana
$solanaDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Split-Path $solanaDir -Parent
$evmDir = Join-Path $repoRoot "evm"
$integracion = Join-Path $solanaDir "integracion"

function Test-Listo($cond, $msgFalta) {
    if ($cond) { return @{ Listo = $true; Msg = "OK" } }
    return @{ Listo = $false; Msg = $msgFalta }
}

$resultados = @()

# 1. Pool Raydium (Solana)
$idJson = Join-Path $integracion "id.json"
$mintTxt = Join-Path $integracion "MINT_ADDRESS.txt"
$r1 = Test-Listo ((Test-Path $idJson) -and (Test-Path $mintTxt)) "Falta integracion/id.json o MINT_ADDRESS.txt"
$resultados += @{ Tarea = "1. Pool Raydium (Solana)"; Listo = $r1.Listo; Msg = $r1.Msg }

# 2–4. Jupiter / Solscan / Trust: manual, solo indicar que hay datos
$datosVerif = Join-Path $solanaDir "scripts\DATOS-VERIFICACION-TOKEN-SOLANA.md"
$r2 = Test-Listo (Test-Path $datosVerif) "Revisar DATOS-VERIFICACION-TOKEN-SOLANA.md"
$resultados += @{ Tarea = "2-4. Jupiter/Solscan/Trust (manual)"; Listo = $true; Msg = "Datos en scripts/DATOS-VERIFICACION-TOKEN-SOLANA.md" }

# 5. CoinGecko: manual
$resultados += @{ Tarea = "5. CoinGecko (manual)"; Listo = $true; Msg = "Formulario + post verificación" }

# 6. Polygon deploy
$envExample = Join-Path $evmDir ".env.example"
$envFile = Join-Path $evmDir ".env"
$envExists = Test-Path $envFile
$envOk = $false
if ($envExists) {
    $content = Get-Content $envFile -Raw
    $hasPk = $content -match "PRIVATE_KEY=0x[0-9a-fA-F]{40,}" -and $content -notmatch "PRIVATE_KEY=0x\.\.\."
    $hasOwner = $content -match "OWNER_ADDRESS=0x[a-fA-F0-9]{40}"
    $hasMultisig = $content -match "MULTISIG_ADDRESS=0x[a-fA-F0-9]{40}"
    $envOk = $hasPk -and $hasOwner -and $hasMultisig
}
$r6Msg = if (-not $envExists) { "Crear evm/.env desde .env.example" } elseif (-not $envOk) { "Rellenar PRIVATE_KEY, OWNER_ADDRESS, MULTISIG_ADDRESS en evm/.env" } else { "OK" }
$resultados += @{ Tarea = "6. Polygon deploy"; Listo = $envExists -and $envOk; Msg = $r6Msg }

# 7. Comprobaciones
$verifScript = Join-Path $solanaDir "scripts\verificar-listados-token.ts"
$resultados += @{ Tarea = "7. Comprobaciones (listados+on-chain)"; Listo = (Test-Path $verifScript); Msg = "npm run comprobaciones" }

Write-Host ""
Write-Host "=== Verificación para tareas pendientes ===" -ForegroundColor Cyan
Write-Host ""

foreach ($r in $resultados) {
    $icon = if ($r.Listo) { "[OK]" } else { "[--]" }
    $color = if ($r.Listo) { "Green" } else { "Yellow" }
    Write-Host $icon -NoNewline -ForegroundColor $color
    Write-Host (" " + $r.Tarea + " — " + $r.Msg)
}

Write-Host ""
Write-Host "Lista completa y comandos: ../docs/TAREAS_PENDIENTES.md (o docs/TAREAS_PENDIENTES.md desde la raíz)" -ForegroundColor Gray
Write-Host ""
