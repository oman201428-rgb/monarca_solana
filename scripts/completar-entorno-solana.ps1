# Script único: instala Solana (si falta), configura wallet/devnet, npm install y anchor build.
# Ejecutar en PowerShell. Requiere: Rust, Anchor CLI y Node ya instalados.

$ErrorActionPreference = "Stop"
$SolanaVersion = "v1.18.18"
$SolanaDir = "$env:TEMP\solana-install-tmp"
$SolanaExe = "$SolanaDir\solana-install-init.exe"
# GitHub suele ser más estable que release.solana.com en algunas redes
$Urls = @(
    "https://github.com/solana-labs/solana/releases/download/$SolanaVersion/solana-install-init-x86_64-pc-windows-msvc.exe",
    "https://release.solana.com/$SolanaVersion/solana-install-init-x86_64-pc-windows-msvc.exe"
)
# Usar carpeta de integración del proyecto (todo en la misma carpeta)
$SolanaProjectRoot = Split-Path $PSScriptRoot -Parent
$SolanaConfigDir = Join-Path $SolanaProjectRoot "integracion"
$SolanaKeypair = Join-Path $SolanaConfigDir "id.json"

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# --- 1. Solana CLI ---
Write-Host "`n=== 1. Solana CLI ===" -ForegroundColor Cyan
if (Get-Command solana -ErrorAction SilentlyContinue) {
    Write-Host "  [OK] Ya instalado: $(solana --version)" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Force -Path $SolanaDir | Out-Null
    $downloaded = $false
    foreach ($url in $Urls) {
        try {
            Write-Host "  Descargando desde $($url.Split('/')[2])..." -ForegroundColor Yellow
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $url -OutFile $SolanaExe -UseBasicParsing -TimeoutSec 120
            if (Test-Path $SolanaExe -PathType Leaf) { $downloaded = $true; break }
        } catch {
            Write-Host "  Fallo: $($_.Exception.Message)" -ForegroundColor Gray
        }
    }
    if (-not $downloaded) {
        Write-Host "  [ERROR] No se pudo descargar. Ejecuta manualmente los pasos en INSTALAR_SOLANA_UN_PASO.md" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Ejecutando instalador..." -ForegroundColor Yellow
    $p = Start-Process -FilePath $SolanaExe -ArgumentList $SolanaVersion -Wait -PassThru -NoNewWindow
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Get-Command solana -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] $(solana --version)" -ForegroundColor Green
    } else {
        Write-Host "  [AVISO] Cierra y abre PowerShell y vuelve a ejecutar este script." -ForegroundColor Yellow
        exit 0
    }
}

# --- 2. Wallet y devnet ---
Write-Host "`n=== 2. Wallet y devnet ===" -ForegroundColor Cyan
if (-not (Get-Command solana -ErrorAction SilentlyContinue)) {
    Write-Host "  [SKIP] Solana no disponible." -ForegroundColor Yellow
} else {
    New-Item -ItemType Directory -Force -Path $SolanaConfigDir | Out-Null
    # integracion/ es la carpeta única del proyecto para wallet y config
    if (-not (Test-Path $SolanaKeypair)) {
        Write-Host "  Creando wallet por defecto en integracion/..." -ForegroundColor Yellow
        solana-keygen new -o $SolanaKeypair --no-bip39-passphrase --force 2>$null
        if (Test-Path $SolanaKeypair) {
            solana config set --keypair $SolanaKeypair
            Write-Host "  [OK] Wallet: $(solana address)" -ForegroundColor Green
        }
    } else {
        solana config set --keypair $SolanaKeypair
        Write-Host "  [OK] Wallet en integracion/: $(solana address)" -ForegroundColor Green
    }
    solana config set --url devnet 2>$null
    Write-Host "  Solicitando airdrop devnet (2 SOL)..." -ForegroundColor Yellow
    solana airdrop 2 2>$null
    Write-Host "  Balance: $(solana balance)" -ForegroundColor Green
}

# --- 3. Dependencias npm y anchor build ---
$SolanaProjectRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $SolanaProjectRoot "Anchor.toml"))) {
    $SolanaProjectRoot = Join-Path (Split-Path $SolanaProjectRoot -Parent) "solana"
}
Write-Host "`n=== 3. Proyecto Solana (npm + anchor build) ===" -ForegroundColor Cyan
Push-Location $SolanaProjectRoot
try {
    if (Test-Path "package.json") {
        Write-Host "  npm install..." -ForegroundColor Yellow
        npm install --silent 2>$null
        Write-Host "  [OK] npm install" -ForegroundColor Green
    }
    if (Get-Command anchor -ErrorAction SilentlyContinue) {
        Write-Host "  anchor keys sync..." -ForegroundColor Yellow
        anchor keys sync 2>$null
        Write-Host "  anchor build..." -ForegroundColor Yellow
        anchor build 2>&1
        if ($LASTEXITCODE -eq 0) { Write-Host "  [OK] anchor build" -ForegroundColor Green } else { Write-Host "  [AVISO] Si falla, ejecuta 'anchor build' desde una terminal nueva (PATH completo)." -ForegroundColor Yellow }
    }
} finally {
    Pop-Location
}

# --- 4. Verificación final ---
Write-Host "`n=== 4. Verificación ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "verificar-entorno.ps1")
