# Ejecuta "anchor build" con permisos de administrador (evita "Acceso denegado" en platform-tools).
# Uso: clic derecho -> "Ejecutar como administrador", o en PowerShell: .\anchor-build-admin.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$solanaRoot = Split-Path -Parent $scriptDir

# Si no somos admin, volver a lanzar este script como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Solicitando permisos de administrador para evitar 'Acceso denegado' en platform-tools..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$($MyInvocation.MyCommand.Path)`"" -Wait
    exit $LASTEXITCODE
}

# Asegurar PATH con herramientas del sistema y usuario
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location $solanaRoot

Write-Host "Ejecutando anchor build en: $solanaRoot" -ForegroundColor Cyan
anchor build
$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Host "Build completado correctamente." -ForegroundColor Green
} else {
    Write-Host "Build falló con código $exitCode." -ForegroundColor Red
}
exit $exitCode
