# Sube solo lo necesario al repo monarca_solana (sin integracion/, .env, target/, etc.).
# Ejecutar desde la carpeta solana: .\scripts\subir-repo-github.ps1
# Requiere: git instalado; la cuenta con la que hagas push debe tener permiso en el repo.

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path (Get-Location) }
$SolanaRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
$Remote = "https://github.com/oman201428-rgb/monarca_solana.git"
# Identidad para commits (solo nombre público; no se guardan contraseñas ni tokens)
$GitUser = "oman201428-rgb"
$GitEmail = "oman201428-rgb@users.noreply.github.com"

Push-Location $SolanaRoot
try {
    if (-not (Test-Path ".git")) {
        Write-Host "Inicializando git en $SolanaRoot..." -ForegroundColor Cyan
        git init
        git branch -M main
    }
    # Identidad local solo para este repo (protege datos sensibles; no usa email real)
    git config user.name $GitUser 2>$null
    git config user.email $GitEmail 2>$null
    $rem = git remote get-url origin 2>$null
    if (-not $rem) {
        Write-Host "Añadiendo remote origin: $Remote" -ForegroundColor Cyan
        git remote add origin $Remote
    } elseif ($rem -ne $Remote) {
        Write-Host "[AVISO] origin ya existe: $rem" -ForegroundColor Yellow
        Write-Host "Para usar monarca_solana: git remote set-url origin $Remote" -ForegroundColor Gray
    }

    Write-Host "Comprobando .gitignore (integracion/ debe estar ignorado)..." -ForegroundColor Cyan
    $ok = Get-Content ".gitignore" -Raw | Select-String -Pattern "integracion" -Quiet
    if (-not $ok) {
        Write-Host "[ERROR] Añade integracion/ a .gitignore antes de subir." -ForegroundColor Red
        exit 1
    }

    Write-Host "Añadiendo archivos (se respeta .gitignore)..." -ForegroundColor Cyan
    git add -A
    $status = git status --short 2>&1
    if (-not $status) {
        Write-Host "Nada que subir (todo ya está en el último commit)." -ForegroundColor Yellow
        Write-Host "Para forzar push: git push -u origin main" -ForegroundColor Gray
        exit 0
    }
    Write-Host $status

    git commit -m "Add Solana program (Anchor) - verified build"
    Write-Host "Subiendo a origin main..." -ForegroundColor Cyan
    git push -u origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[AVISO] Push falló. Crea el repo en GitHub: https://github.com/new?name=monarca_solana (con la cuenta oman201428-rgb)." -ForegroundColor Yellow
        Write-Host "  Luego ejecuta de nuevo: git push -u origin main" -ForegroundColor Gray
        exit 1
    }
    Write-Host "[OK] Repo actualizado. Luego ejecuta: npm run verificar-programa-build" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] $_" -ForegroundColor Red
    Write-Host "Si falla la autenticación: usa GitHub CLI (gh auth login) o configura un token/SSH." -ForegroundColor Yellow
    exit 1
}
finally {
    Pop-Location
}
