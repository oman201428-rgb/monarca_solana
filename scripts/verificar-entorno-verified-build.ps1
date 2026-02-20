# Pre-vuelo para Verified Build (Program is verified = TRUE).
# Comprueba Docker, Anchor, Solana CLI, wallet, mainnet y balance.
# Salida: exit 0 si todo listo; exit 1 si falta algo crítico.

$ErrorActionPreference = "Stop"
if ($env:OS -eq "Windows_NT") {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path (Get-Location) }
$SolanaRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

$fail = $false
$warnings = 0

function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "  [FALTA] $msg" -ForegroundColor Red; $script:fail = $true }
function Write-Warn($msg) { Write-Host "  [AVISO] $msg" -ForegroundColor Yellow; $script:warnings++ }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "=== Pre-vuelo: Verified Build (Program is verified = TRUE) ===" -ForegroundColor Cyan
Write-Host "  Raíz: $SolanaRoot" -ForegroundColor Gray
Write-Host ""

# 1. Docker instalado y en ejecución
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "docker no responde" }
    if ($dockerVersion -match "Version:\s+(\d+\.\d+)") {
        Write-Ok "Docker instalado y en ejecución"
    }
    else {
        Write-Ok "Docker instalado y en ejecución"
    }
}
catch {
    Write-Fail "Docker no instalado o no en ejecución. Instala Docker Desktop y inícialo."
    Write-Info "  Windows: winget install Docker.DockerDesktop"
    Write-Info "  Luego abre Docker Desktop y espera a que esté 'Running'."
}

# 2. Rust
try {
    $rust = rustc --version 2>$null
    if ($LASTEXITCODE -ne 0) { throw "rustc no encontrado" }
    Write-Ok "Rust: $rust"
}
catch {
    Write-Fail "Rust. Instala: https://rustup.rs/"
}

# 3. Solana CLI (>= 1.16 para Anchor 0.29)
try {
    $solanaOut = solana --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "solana no encontrado" }
    $v = $solanaOut -replace "solana-cli\s+", ""
    Write-Ok "Solana CLI: $v"
}
catch {
    Write-Fail "Solana CLI. Ejecuta: .\scripts\instalar-solana-anchor.ps1"
}

# 4. Anchor CLI y versión 0.29.x
try {
    $anchorOut = anchor --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "anchor no encontrado" }
    if ($anchorOut -match "0\.29\.\d+") {
        Write-Ok "Anchor: $anchorOut"
    }
    else {
        Write-Warn "Anchor instalado pero versión distinta de 0.29.x: $anchorOut"
        Write-Info "  Para verified build se recomienda Anchor 0.29: avm install 0.29.0; avm use 0.29.0"
    }
}
catch {
    Write-Fail "Anchor CLI. Ejecuta: .\scripts\instalar-solana-anchor.ps1"
}

# 5. Wallet integracion/id.json
$walletPath = Join-Path $SolanaRoot "integracion\id.json"
if (Test-Path $walletPath) {
    Write-Ok "Wallet: integracion/id.json existe"
}
else {
    Write-Fail "integracion/id.json no existe (wallet con update authority y SOL)"
}

# 6. Solana config: mainnet y wallet por defecto
if (Get-Command solana -ErrorAction SilentlyContinue) {
    solana config set --url mainnet-beta 2>$null
    solana config set --keypair $walletPath 2>$null
    $url = (solana config get 2>$null | Select-String "RPC URL").ToString().Trim()
    if ($url -match "mainnet") {
        Write-Ok "Cluster: mainnet-beta, keypair: integracion/id.json"
    }
    else {
        Write-Warn "Cluster no es mainnet. Ejecuta: solana config set --url mainnet-beta"
    }
}

# 7. Balance SOL (suficiente para verify + posibles fees)
if (Get-Command solana -ErrorAction SilentlyContinue) {
    try {
        $balanceStr = solana balance 2>$null
        $balanceNum = ($balanceStr -replace ' SOL', '').Trim() -as [double]
        if ($balanceNum -ge 0.5) {
            Write-Ok "Balance: $balanceStr"
        }
        elseif ($balanceNum -ge 0.005) {
            Write-Warn "Balance bajo: $balanceStr (recomendado >= 0.5 SOL para verify)"
        }
        else {
            Write-Fail "Balance insuficiente: $balanceStr. Necesitas SOL en integracion/id.json"
        }
    }
    catch {
        Write-Warn "No se pudo leer balance (¿RPC accesible?). Asegúrate de tener algo de SOL."
    }
}

# 8. Imagen Docker Anchor (opcional; v0.31.1 existe en Hub para verified build)
if (-not $fail) {
    try {
        $img = docker images -q solanafoundation/anchor:v0.31.1 2>$null
        if ($img) {
            Write-Ok "Imagen Docker Anchor (v0.31.1) ya descargada"
        }
        else {
            Write-Info "Imagen Docker: el build --verifiable la descargará si hace falta."
        }
    }
    catch { }
}

# 9. Anchor.toml
if (Test-Path (Join-Path $SolanaRoot "Anchor.toml")) {
    Write-Ok "Anchor.toml en raíz del proyecto"
}
else {
    Write-Fail "Anchor.toml no encontrado (ejecuta desde la carpeta solana)"
}

# 10. solana-verify en WSL (opcional; para comparar hashes si anchor verify falla por IDL)
if ($env:OS -eq "Windows_NT") {
    $hasVerify = wsl -e bash -c 'export PATH=$HOME/.cargo/bin:$PATH; command -v solana-verify' 2>$null
    if ($hasVerify) {
        Write-Ok "solana-verify en WSL (para comparar hashes)"
    }
    else {
        Write-Info "solana-verify en WSL no instalado. Se instalará automáticamente al ejecutar el build si hace falta."
    }
}

Write-Host ""
if ($fail) {
    Write-Host "  Corrige los elementos [FALTA] y vuelve a ejecutar." -ForegroundColor Red
    Write-Host "  Para instalar todo: .\scripts\instalar-y-configurar-verified-build.ps1" -ForegroundColor Yellow
    exit 1
}
if ($warnings -gt 0) {
    Write-Host "  Hay $warnings aviso(s). Puedes continuar o corregirlos." -ForegroundColor Yellow
}
Write-Host "  Pre-vuelo OK. Puedes ejecutar: npm run verificar-programa-build" -ForegroundColor Green
Write-Host ""
exit 0
