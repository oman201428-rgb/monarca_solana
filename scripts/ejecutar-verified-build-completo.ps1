# Orquestador: instala, configura y ejecuta Verified Build con seguimiento en VITACORA.
# Evita errores comprobando Docker (con espera), pre-vuelo y registrando cada paso.
#
# Uso: desde carpeta solana: .\scripts\ejecutar-verified-build-completo.ps1
#   o: npm run verified-build-completo
#
# Log: d:\VITACORA\VERIFIED_BUILD_<fecha>_<hora>.log

param(
    [int]$EsperarDockerSegundos = 180,
    [int]$IntervaloPollSegundos = 15,
    [switch]$OmitirEsperaDocker = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path (Get-Location) }
$SolanaRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

$Vitacora = "d:\VITACORA"
$LogFile = Join-Path $Vitacora ("VERIFIED_BUILD_" + (Get-Date -Format "yyyy-MM-dd_HH-mm") + ".log")

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
    Write-Host $line
}

function LogBlock($title, $content) {
    Log "--- $title ---"
    foreach ($l in ($content -split "`n")) { Add-Content -Path $LogFile -Value $l -ErrorAction SilentlyContinue }
    Log "---"
}

# Crear VITACORA si no existe
if (-not (Test-Path $Vitacora)) { New-Item -ItemType Directory -Path $Vitacora -Force | Out-Null }

Log "=========================================="
Log "VERIFIED BUILD COMPLETO - Inicio"
Log "Raíz: $SolanaRoot"
Log "Log: $LogFile"
Log "=========================================="

Push-Location $SolanaRoot

try {
    # --- Fase -1: Activar integración WSL en Docker (Windows) ---
    if ($env:OS -eq "Windows_NT") {
        $dockerSettingsPath = "$env:APPDATA\Docker\settings-store.json"
        if (Test-Path $dockerSettingsPath) {
            try {
                $settings = Get-Content $dockerSettingsPath -Raw | ConvertFrom-Json
                if ($settings.EnableIntegrationWithDefaultWslDistro -eq $false) {
                    $settings.EnableIntegrationWithDefaultWslDistro = $true
                    $settings | ConvertTo-Json -Depth 10 | Set-Content $dockerSettingsPath -Encoding UTF8
                    Log "  Integración WSL con Docker activada. Reinicia Docker Desktop si docker no está en WSL."
                }
            } catch { }
        }
    }

    # --- Fase 0: Esperar Docker ---
    Log ""
    Log "Fase 0: Comprobando Docker..."
    $dockerOk = $false
    $waited = 0
    $maxWait = if ($OmitirEsperaDocker) { 0 } else { $EsperarDockerSegundos }
    while ($waited -le $maxWait) {
        try {
            $null = docker version 2>&1
            if ($LASTEXITCODE -eq 0) { $dockerOk = $true; break }
        }
        catch { }
        if ($waited -eq 0 -and $maxWait -gt 0) {
            Log "  Docker no responde. Esperando hasta $maxWait s (poll cada $IntervaloPollSegundos s)..."
        }
        if ($maxWait -gt 0) {
            Start-Sleep -Seconds $IntervaloPollSegundos
            $waited += $IntervaloPollSegundos
        }
        else {
            break
        }
    }

    if (-not $dockerOk) {
        Log "ERROR: Docker no está en ejecución."
        Log "  -> Abre Docker Desktop, espera a que esté 'Running', y ejecuta de nuevo:"
        Log "  ->   cd $SolanaRoot"
        Log "  ->   npm run verified-build-completo"
        Log "  -> Log de este intento: $LogFile"
        Log "FIN: FALLO (Docker)"
        exit 1
    }
    Log "  Docker OK."

    # --- Fase 1: Instalación y configuración ---
    Log ""
    Log "Fase 1: Instalación y configuración..."
    $out1 = & pwsh -NoProfile -File (Join-Path $ScriptDir "instalar-y-configurar-verified-build.ps1") 2>&1 | Out-String
    LogBlock "Salida instalar-verified-build" $out1
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: Instalación/configuración falló (exit $LASTEXITCODE)."
        Log "FIN: FALLO (Fase 1)"
        exit 1
    }
    Log "  Fase 1 OK."

    # --- Fase 2: Pre-vuelo explícito ---
    Log ""
    Log "Fase 2: Pre-vuelo..."
    $out2 = & pwsh -NoProfile -File (Join-Path $ScriptDir "verificar-entorno-verified-build.ps1") 2>&1 | Out-String
    LogBlock "Salida pre-vuelo" $out2
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: Pre-vuelo falló (exit $LASTEXITCODE)."
        Log "FIN: FALLO (Fase 2)"
        exit 1
    }
    Log "  Fase 2 OK."

    # --- Fase 3: Verified Build + Verify ---
    Log ""
    Log "Fase 3: anchor build --verifiable + anchor verify..."
    $out3 = & pwsh -NoProfile -File (Join-Path $ScriptDir "verificar-programa-verified-build.ps1") 2>&1 | Out-String
    LogBlock "Salida verificar-programa-build" $out3
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: Verified build o verify falló (exit $LASTEXITCODE)."
        Log "Revisa el log arriba. Si el hash no coincide, redespliega y vuelve a ejecutar."
        Log "FIN: FALLO (Fase 3)"
        exit 1
    }

    Log ""
    Log "=========================================="
    Log "VERIFIED BUILD COMPLETO - ÉXITO"
    Log "Ejecución finalizada correctamente. Build verifiable en target/verifiable."
    Log "=========================================="
    Log "FIN: OK"
    exit 0
}
catch {
    Log "EXCEPCIÓN: $_"
    Log "FIN: FALLO (excepción)"
    exit 1
}
finally {
    Pop-Location
}
