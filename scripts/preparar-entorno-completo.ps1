<#
.SYNOPSIS
  Prepara TODO el entorno para desplegar MONARCA en Solana: Rust, Solana, Anchor, wallet, build.
  Ejecuta automáticamente todo lo necesario. Sin intervención manual.
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path $PSScriptRoot -Parent
$SolanaRoot = $ScriptDir
if (-not (Test-Path (Join-Path $SolanaRoot "Anchor.toml"))) {
  $SolanaRoot = Join-Path (Split-Path $SolanaRoot -Parent) "solana"
}
$SolanaVersion = "v1.18.18"
$IntegracionDir = Join-Path $SolanaRoot "integracion"
$KeypairPath = Join-Path $IntegracionDir "id.json"

function Refresh-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  if (Test-Path "$env:USERPROFILE\.cargo\bin") {
    $env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
  }
  $solanaReleases = "$env:USERPROFILE\.local\share\solana\install\releases"
  if (Test-Path $solanaReleases) {
    $ver = Get-ChildItem $solanaReleases -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if ($ver) {
      $solanaBin = Join-Path $ver.FullName "solana-release\bin"
      if (Test-Path $solanaBin) { $env:Path = "$solanaBin;" + $env:Path }
    }
  }
  $env:HOME = $env:USERPROFILE
}

function Write-Step { param($n, $msg) Write-Host "`n=== Paso $n : $msg ===" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [AVISO] $msg" -ForegroundColor Yellow }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Preparación completa entorno Solana" -ForegroundColor Cyan
Write-Host "  Token MONARCA (MNCA)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Refresh-Path

# --- 1. Rust ---
Write-Step 1 "Rust"
if (Get-Command rustc -ErrorAction SilentlyContinue) {
  Write-Ok "Rust: $(rustc --version)"
} else {
  Write-Host "  Instalando Rust (winget)..." -ForegroundColor Yellow
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install Rustlang.Rustup --accept-package-agreements --accept-source-agreements 2>$null
    Refresh-Path
    if (Get-Command rustc -ErrorAction SilentlyContinue) {
      Write-Ok "Rust instalado: $(rustc --version)"
    } else {
      Write-Host "  Intentando rustup-init..." -ForegroundColor Yellow
      $rustupExe = "$env:TEMP\rustup-init.exe"
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupExe -UseBasicParsing
      Start-Process -FilePath $rustupExe -ArgumentList "-y" -Wait -NoNewWindow
      Refresh-Path
      if (Get-Command rustc -ErrorAction SilentlyContinue) {
        Write-Ok "Rust instalado"
      } else {
        Write-Host "  [ERROR] Rust no instalado. Cierra PowerShell, ábrelo de nuevo y ejecuta este script otra vez." -ForegroundColor Red
        exit 1
      }
    }
  } else {
    $rustupExe = "$env:TEMP\rustup-init.exe"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustupExe -UseBasicParsing
    Start-Process -FilePath $rustupExe -ArgumentList "-y" -Wait -NoNewWindow
    Refresh-Path
    if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
      Write-Host "  [ERROR] Reinicia PowerShell y vuelve a ejecutar." -ForegroundColor Red
      exit 1
    }
  }
}

# --- 2. Solana CLI ---
Write-Step 2 "Solana CLI"
Refresh-Path
if (Get-Command solana -ErrorAction SilentlyContinue) {
  Write-Ok "Solana: $(solana --version)"
} else {
  $SolanaDir = "$env:TEMP\solana-install-tmp"
  $SolanaExe = "$SolanaDir\solana-install-init.exe"
  New-Item -ItemType Directory -Force -Path $SolanaDir | Out-Null
  $Urls = @(
    "https://github.com/solana-labs/solana/releases/download/$SolanaVersion/solana-install-init-x86_64-pc-windows-msvc.exe",
    "https://release.solana.com/$SolanaVersion/solana-install-init-x86_64-pc-windows-msvc.exe"
  )
  $downloaded = $false
  foreach ($url in $Urls) {
    try {
      Write-Host "  Descargando Solana $SolanaVersion..." -ForegroundColor Yellow
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri $url -OutFile $SolanaExe -UseBasicParsing -TimeoutSec 120
      if (Test-Path $SolanaExe) { $downloaded = $true; break }
    } catch { Write-Host "  Fallo: $($_.Exception.Message)" -ForegroundColor Gray }
  }
  if (-not $downloaded) {
    Write-Host "  [ERROR] No se pudo descargar Solana." -ForegroundColor Red
    exit 1
  }
  Write-Host "  Ejecutando instalador..." -ForegroundColor Yellow
  Start-Process -FilePath $SolanaExe -ArgumentList $SolanaVersion -Wait -NoNewWindow
  Refresh-Path
  if (Get-Command solana -ErrorAction SilentlyContinue) {
    Write-Ok "Solana instalado"
  } else {
    Write-Host "  [AVISO] Cierra y abre PowerShell, luego ejecuta de nuevo." -ForegroundColor Yellow
    exit 1
  }
}

# --- 3. Anchor CLI ---
Write-Step 3 "Anchor CLI"
Refresh-Path
if (Get-Command anchor -ErrorAction SilentlyContinue) {
  Write-Ok "Anchor: $(anchor --version)"
} else {
  Write-Host "  Instalando Anchor v0.29 (puede tardar 5-15 min)..." -ForegroundColor Yellow
  cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0 --locked
  Refresh-Path
  if (Get-Command anchor -ErrorAction SilentlyContinue) {
    Write-Ok "Anchor instalado"
  } else {
    Write-Host "  [AVISO] Cargo instala en ~\.cargo\bin. Asegúrate de tenerlo en PATH." -ForegroundColor Yellow
    Write-Host "  Cierra PowerShell, ábrelo de nuevo, y ejecuta este script otra vez." -ForegroundColor Yellow
    exit 1
  }
}

# --- 4. Wallet ---
Write-Step 4 "Wallet"
New-Item -ItemType Directory -Force -Path $IntegracionDir | Out-Null
if (Test-Path $KeypairPath) {
  solana config set --keypair $KeypairPath 2>$null
  Write-Ok "Wallet: $(solana address)"
} else {
  Write-Host "  Creando wallet en integracion/id.json..." -ForegroundColor Yellow
  solana-keygen new -o $KeypairPath --no-bip39-passphrase --force 2>$null
  solana config set --keypair $KeypairPath
  Write-Ok "Wallet creada: $(solana address)"
}

# --- 5. npm install ---
Write-Step 5 "npm install"
Push-Location $SolanaRoot
try {
  npm install --silent 2>$null
  if ($LASTEXITCODE -ne 0) { npm install }
  Write-Ok "Dependencias instaladas"
} finally {
  Pop-Location
}

# --- 6. Junction qrypta_solana (compatibilidad Anchor 0.32) ---
$qryptaLink = Join-Path $SolanaRoot "programs\qrypta_solana"
$monarcaPath = Join-Path $SolanaRoot "programs\monarca_solana"
if (-not (Test-Path $qryptaLink)) {
  cmd /c mklink /J $qryptaLink $monarcaPath 2>$null
  Write-Ok "Junction qrypta_solana creada (Anchor 0.32)"
}

# --- 7. anchor build ---
Write-Step 7 "anchor build"
Refresh-Path
Push-Location $SolanaRoot
try {
  anchor keys sync 2>$null
  anchor build
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] anchor build falló." -ForegroundColor Red
    exit 1
  }
  Write-Ok "Build completado"
} finally {
  Pop-Location
}

# --- 8. Verificación final ---
Write-Step 8 "Verificación"
& (Join-Path $PSScriptRoot "verificar-entorno.ps1")

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ENTORNO LISTO PARA DESPLIEGUE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Para mainnet: .\scripts\desplegar-solana-completo.ps1" -ForegroundColor Gray
Write-Host "  Para devnet:  .\scripts\desplegar-solana.ps1" -ForegroundColor Gray
Write-Host ""
