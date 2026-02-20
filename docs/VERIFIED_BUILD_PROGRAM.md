# Cómo poner "Program is verified" en TRUE

Cuando en Solscan o el Explorer aparece **Program is verified: FALSE**, puedes dejarlo en **TRUE** siguiendo el flujo de **Verified Builds** de Anchor.

---

## Procedimiento automatizado con seguimiento (recomendado)

Un solo comando orquesta instalación, configuración, pre-vuelo y verified build, y registra cada paso en **d:\\VITACORA\\** para evitar errores y poder depurar:

```powershell
cd d:\qrypta\solana
npm run verified-build-completo
```

- **Si Docker no está en ejecución:** el script espera hasta 3 minutos; si tras eso sigue sin responder, indica que abras Docker Desktop y ejecutes de nuevo el mismo comando.
- **Log de cada ejecución:** `d:\VITACORA\VERIFIED_BUILD_AAAA-MM-DD_HH-mm.log` (fecha y hora de inicio).
- **Si algo falla:** el log contiene la salida de cada fase; corrige lo indicado y vuelve a ejecutar `npm run verified-build-completo`.

Para no esperar a Docker (si ya sabes que está corriendo):

```powershell
.\scripts\ejecutar-verified-build-completo.ps1 -OmitirEsperaDocker
```

---

## Instalación y configuración completa (primera vez)

Para dejar **todo instalado y configurado** sin errores, ejecuta una sola vez desde la carpeta **solana**:

```powershell
npm run instalar-verified-build
```

O:

```powershell
.\scripts\instalar-y-configurar-verified-build.ps1
```

Ese script:

1. **Docker** — Comprueba que Docker esté instalado y en ejecución. Si falta, intenta instalarlo con `winget install Docker.DockerDesktop` (Windows).
2. **Rust** — Comprueba que Rust esté instalado.
3. **Solana CLI y Anchor 0.29** — Si faltan, ejecuta `instalar-solana-anchor.ps1`.
4. **Wallet y mainnet** — Configura `integracion/id.json` como keypair y mainnet-beta como RPC.
5. **Imagen Docker Anchor 0.29** — Descarga `solanafoundation/anchor:v0.29.0` para evitar fallos a mitad de build.
6. **Pre-vuelo** — Ejecuta todas las comprobaciones (balance, etc.).

Si quieres que tras la instalación se ejecute también el verified build:

```powershell
.\scripts\instalar-y-configurar-verified-build.ps1 -EjecutarBuild
```

---

## Comprobar que todo está listo (pre-vuelo)

Antes de lanzar el build, puedes comprobar el entorno:

```powershell
npm run pre-vuelo-verified-build
```

o:

```powershell
.\scripts\verificar-entorno-verified-build.ps1
```

Si algo falla, el script indica qué falta y cómo corregirlo.

---

## Ejecutar Verified Build + Verify

Cuando la instalación y el pre-vuelo estén OK:

```powershell
npm run verificar-programa-build
```

O:

```powershell
.\scripts\verificar-programa-verified-build.ps1
```

El script hace automáticamente:

1. **Pre-vuelo** — Si falla, no continúa.
2. **Descarga de imagen Docker** (si falta) — Para no fallar a mitad de build.
3. **anchor build --verifiable** — Build determinístico en Docker.
4. **anchor verify -p monarca_solana &lt;program-id&gt; --provider.cluster mainnet** — Registra la verificación on-chain.

Si todo va bien, al refrescar la página del programa en Solscan/Explorer deberías ver **Program is verified: TRUE**.

---

## Requisitos resumidos

- **Docker** instalado y en ejecución.
- **Rust** (rustup).
- **Solana CLI** (>= 1.16 recomendado para Anchor 0.29).
- **Anchor CLI 0.29.x** (avm use 0.29.0 si usas avm).
- **Wallet** `integracion/id.json` con algo de SOL (>= 0.5 SOL recomendado para verify).
- Código en un **repositorio Git** (opcional pero recomendado para que la verificación enlaze al código).

---

## Si el programa se desplegó con un build normal

Si el programa se desplegó con `anchor build` (sin `--verifiable`), el hash on-chain puede no coincidir. En ese caso:

1. Redespliega con el `.so` que genera el build verifiable:

   ```powershell
   anchor deploy --provider.cluster mainnet
   ```

2. Vuelve a ejecutar la verificación:

   ```powershell
   npm run verificar-programa-build
   ```

   (o solo el verify: `anchor verify -p monarca_solana 97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv --provider.cluster mainnet`).

---

## Comandos manuales

```powershell
# Pre-vuelo
.\scripts\verificar-entorno-verified-build.ps1

# Build verifiable (Docker)
anchor build --verifiable

# Verificar contra mainnet
anchor verify -p monarca_solana 97k3YzUyZWYPVYCkMRkaHbpARiV4tzgSfDYVdbZg5Nbv --provider.cluster mainnet
```

---

## Referencias

- [Anchor — Verifiable Builds](https://www.anchor-lang.com/docs/verifiable-builds)
- [Solana — Verified Builds](https://solana.com/docs/programs/verified-builds)
