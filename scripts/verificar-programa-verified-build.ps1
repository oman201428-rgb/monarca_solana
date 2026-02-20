# Verified Build + Verify: "Program is verified" = TRUE.
# En Windows ejecuta el build en WSL. Uso: .\scripts\verificar-programa-verified-build.ps1  o  npm run verificar-programa-build

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path (Get-Location) }
$SolanaRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
if ($env:OS -eq "Windows_NT") {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Pre-vuelo
& (Join-Path $ScriptDir "verificar-entorno-verified-build.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Pre-vuelo falló. Ejecuta: .\scripts\instalar-y-configurar-verified-build.ps1" -ForegroundColor Red
    exit 1
}

Push-Location $SolanaRoot
try {
    Write-Host ""
    Write-Host "=== Verified Build + Verify (Program is verified = TRUE) ===" -ForegroundColor Cyan
    Write-Host ""

    if ($env:OS -eq "Windows_NT") {
        $WslPath = '/mnt/' + $SolanaRoot.Substring(0, 1).ToLower() + ($SolanaRoot.Substring(2) -replace '\\', '/')
        Write-Host "[Windows] Ejecutando build + verify en WSL..." -ForegroundColor Yellow
        wsl -e bash -c "cd '$WslPath' && export MONARCA_SOLANA_ROOT='$WslPath' && sed 's/\r$//' scripts/verificar-programa-verified-build-wsl.sh | bash"
        $exit = $LASTEXITCODE
    } else {
        Write-Host "[1/2] anchor build --verifiable..." -ForegroundColor Yellow
        anchor build --verifiable
        if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
        Write-Host "[2/2] anchor verify (mainnet)..." -ForegroundColor Yellow
        anchor verify -p monarca_solana 97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv --provider.cluster mainnet
        $exit = $LASTEXITCODE
    }

    if ($exit -eq 0) {
        Write-Host ""
        Write-Host "Ejecución finalizada correctamente. Build verifiable en target/verifiable." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Si verify falló por hash: redespliega y vuelve a ejecutar." -ForegroundColor Yellow
    }
    exit $exit
} finally {
    Pop-Location
}
