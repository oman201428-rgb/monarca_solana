# Invoca la preparación y build en WSL.
# Ejecutar desde PowerShell: .\scripts\preparar-wsl.ps1

$SolanaRoot = (Resolve-Path (Split-Path $PSScriptRoot -Parent)).Path
$WslPath = '/mnt/' + $SolanaRoot.Substring(0,1).ToLower() + ($SolanaRoot.Substring(2) -replace '\\', '/')
# Ejecutar en WSL (sed quita CRLF si existe)
wsl -e bash -c "cd '$WslPath' && export MONARCA_SOLANA_ROOT='$WslPath' && sed 's/\r$//' scripts/preparar-wsl.sh | bash"
