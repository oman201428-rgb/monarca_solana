# Instala y configura TODO lo necesario para Verified Build (Program is verified = TRUE).
# Ejecutar desde la carpeta solana: .\scripts\instalar-y-configurar-verified-build.ps1
# Opcional: -EjecutarBuild para lanzar el verified build al final si todo está OK.

param(
    [switch]$EjecutarBuild = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path (Get-Location) }
$SolanaRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

Push-Location $SolanaRoot

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "=== Paso $n === $msg" -ForegroundColor Cyan
}

try {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Instalación y configuración completa" -ForegroundColor Green
    Write-Host "  para Verified Build (Program = TRUE)" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green

    # --- 1. Docker ---
    Write-Step 1 "Docker"
    $dockerOk = $false
    try {
        $null = docker version 2>&1
        if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
    }
    catch { }

    if (-not $dockerOk) {
        Write-Host "  Docker no está instalado o no está en ejecución." -ForegroundColor Yellow
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Host "  Intentando instalar Docker Desktop con winget..." -ForegroundColor Yellow
            winget install --id Docker.DockerDesktop -e --accept-source-agreements --accept-package-agreements
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Docker Desktop instalado. ABRE DOCKER DESKTOP y espera a que inicie." -ForegroundColor Green
                Write-Host "  Luego vuelve a ejecutar este script." -ForegroundColor Yellow
                exit 0
            }
        }
        Write-Host "  [FALTA] Instala Docker Desktop manualmente: https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Red
        Write-Host "  O con winget: winget install Docker.DockerDesktop" -ForegroundColor Gray
        exit 1
    }
    Write-Host "  [OK] Docker en ejecución" -ForegroundColor Green

    # --- 2. Rust ---
    Write-Step 2 "Rust"
    if (Get-Command rustc -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] $(rustc --version)" -ForegroundColor Green
    }
    else {
        Write-Host "  [FALTA] Instala Rust: https://rustup.rs/ (ejecuta rustup-init y reinicia PowerShell)" -ForegroundColor Red
        exit 1
    }

    # --- 3. Solana CLI y Anchor ---
    Write-Step 3 "Solana CLI y Anchor 0.29"
    $needInstall = $false
    if (-not (Get-Command solana -ErrorAction SilentlyContinue)) { $needInstall = $true }
    if (-not (Get-Command anchor -ErrorAction SilentlyContinue)) { $needInstall = $true }
    if ($needInstall) {
        & (Join-Path $ScriptDir "instalar-solana-anchor.ps1")
        if ($LASTEXITCODE -ne 0) { exit 1 }
    }
    else {
        Write-Host "  [OK] Solana: $(solana --version)" -ForegroundColor Green
        Write-Host "  [OK] Anchor: $(anchor --version)" -ForegroundColor Green
    }

    # Asegurar Anchor 0.29 si existe avm
    if (Get-Command avm -ErrorAction SilentlyContinue) {
        $avmList = avm list 2>$null
        if ($avmList -match "0\.29") {
            avm use 0.29.0 2>$null
            Write-Host "  [OK] avm use 0.29.0" -ForegroundColor Green
        }
    }

    # --- 4. Wallet y config Solana ---
    Write-Step 4 "Wallet y cluster mainnet"
    $walletPath = Join-Path $SolanaRoot "integracion\id.json"
    if (-not (Test-Path $walletPath)) {
        Write-Host "  [FALTA] integracion/id.json no existe. Crea o copia la wallet que sea update authority del programa." -ForegroundColor Red
        exit 1
    }
    solana config set --url mainnet-beta 2>$null
    solana config set --keypair $walletPath 2>$null
    Write-Host "  [OK] Keypair: integracion/id.json, URL: mainnet-beta" -ForegroundColor Green
    $bal = solana balance 2>$null
    Write-Host "  [INFO] Balance: $bal" -ForegroundColor Gray

    # --- 5. Imagen Docker Anchor (v0.31.1; v0.29 no existe en Hub) ---
    Write-Step 5 "Imagen Docker Anchor v0.31.1"
    $img = docker images -q solanafoundation/anchor:v0.31.1 2>$null
    if (-not $img) {
        Write-Host "  Descargando solanafoundation/anchor:v0.31.1 (puede tardar varios minutos)..." -ForegroundColor Yellow
        docker pull solanafoundation/anchor:v0.31.1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [AVISO] Fallo al descargar. anchor build --verifiable lo intentará de nuevo." -ForegroundColor Yellow
        }
        else {
            Write-Host "  [OK] Imagen descargada" -ForegroundColor Green
        }
    }
    else {
        Write-Host "  [OK] Imagen ya presente" -ForegroundColor Green
    }

    # --- 5b. solana-verify en WSL (para comparar hashes cuando anchor verify falle por IDL) ---
    Write-Step "5b" "solana-verify en WSL"
    $hasVerify = wsl -e bash -c 'export PATH=$HOME/.cargo/bin:$PATH; command -v solana-verify' 2>$null
    if ($hasVerify) {
        Write-Host "  [OK] solana-verify ya instalado en WSL" -ForegroundColor Green
    }
    else {
        Write-Host "  Instalando solana-verify en WSL (puede tardar 2-5 min)..." -ForegroundColor Yellow
        wsl -e bash -c 'export PATH=$HOME/.cargo/bin:$PATH; cargo install solana-verify' 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] solana-verify instalado" -ForegroundColor Green
        }
        else {
            Write-Host "  [AVISO] No se pudo instalar. El script de build instalará solana-verify si hace falta." -ForegroundColor Yellow
        }
    }

    # --- 6. Pre-vuelo ---
    Write-Step 6 "Pre-vuelo (comprobación final)"
    & (Join-Path $ScriptDir "verificar-entorno-verified-build.ps1")
    if ($LASTEXITCODE -ne 0) { exit 1 }

    # --- 7. Opcional: ejecutar build ---
    if ($EjecutarBuild) {
        Write-Step 7 "Ejecutando Verified Build + Verify"
        & (Join-Path $ScriptDir "verificar-programa-verified-build.ps1")
        if ($LASTEXITCODE -ne 0) { exit 1 }
    }
    else {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Instalación y configuración completadas" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Siguiente paso (Verified Build):" -ForegroundColor Cyan
        Write-Host "    npm run verificar-programa-build" -ForegroundColor White
        Write-Host ""
        Write-Host "  O con ejecución automática del build:" -ForegroundColor Gray
        Write-Host "    .\scripts\instalar-y-configurar-verified-build.ps1 -EjecutarBuild" -ForegroundColor Gray
        Write-Host ""
    }
}
finally {
    Pop-Location
}
