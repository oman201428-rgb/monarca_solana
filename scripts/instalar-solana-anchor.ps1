# Instala Solana CLI y Anchor CLI (ejecutar en PowerShell).
# Requisito: Rust ya instalado (rustc, cargo en PATH).
# Opcional: ejecutar como Administrador para instalar Solana en ubicación por defecto.

$ErrorActionPreference = "Stop"
$SolanaVersion = "v1.18.18"
$SolanaUrl = "https://release.solana.com/$SolanaVersion/solana-install-init-x86_64-pc-windows-msvc.exe"
$SolanaDir = "$env:TEMP\solana-install-tmp"
$SolanaExe = "$SolanaDir\solana-install-init.exe"

# Refrescar PATH para tener cargo/rustc
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "=== 1. Solana CLI ===" -ForegroundColor Cyan
if (Get-Command solana -ErrorAction SilentlyContinue) {
    Write-Host "  Solana ya instalado: $(solana --version)" -ForegroundColor Green
} else {
    Write-Host "  Descargando instalador Solana $SolanaVersion..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $SolanaDir | Out-Null
    try {
        Invoke-WebRequest -Uri $SolanaUrl -OutFile $SolanaExe -UseBasicParsing
    } catch {
        Write-Host "  Error al descargar. Descarga manual: $SolanaUrl" -ForegroundColor Red
        Write-Host "  Guárdalo como $SolanaExe y vuelve a ejecutar este script." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  Ejecutando instalador (puede pedir permisos)..." -ForegroundColor Yellow
    & $SolanaExe $SolanaVersion
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (-not (Get-Command solana -ErrorAction SilentlyContinue)) {
        Write-Host "  Cierra y abre de nuevo PowerShell, luego ejecuta: solana --version" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] Solana: $(solana --version)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== 2. Anchor CLI ===" -ForegroundColor Cyan
if (Get-Command anchor -ErrorAction SilentlyContinue) {
    Write-Host "  Anchor ya instalado: $(anchor --version)" -ForegroundColor Green
} else {
    Write-Host "  Instalando Anchor v0.29 (puede tardar varios minutos)..." -ForegroundColor Yellow
    cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0 --locked
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Get-Command anchor -ErrorAction SilentlyContinue) {
        Write-Host "  [OK] Anchor: $(anchor --version)" -ForegroundColor Green
    } else {
        Write-Host "  Cargo instala en %USERPROFILE%\.cargo\bin. Asegúrate de tenerlo en PATH." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Comprobación final:" -ForegroundColor Cyan
.\verificar-entorno.ps1
