# Invoca el despliegue completo en mainnet desde WSL.
# Ejecutar desde PowerShell: .\scripts\desplegar-wsl.ps1

$SolanaRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$WslPath = '/mnt/' + $SolanaRoot.Substring(0,1).ToLower() + ($SolanaRoot.Substring(2) -replace '\\', '/')
wsl -e bash -c "cd '$WslPath' && export MONARCA_SOLANA_ROOT='$WslPath' && sed 's/\r$//' scripts/desplegar-wsl.sh | bash"
