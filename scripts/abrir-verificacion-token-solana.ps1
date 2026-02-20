# Abre Solscan token-update y deja el mint MNCA en el portapapeles.
# Uso: pegar (Ctrl+V) en el campo "Token Contract Address".

$MINT = "6cfzjBSA6KSgUCGDCSPetyDUnxRBG1G1wyE7dLxnL34m"
Set-Clipboard -Value $MINT
Start-Process "https://solscan.io/token-update"
Write-Host "Mint copiado al portapapeles. Pagina abierta. Pega (Ctrl+V) en Token Contract Address."
