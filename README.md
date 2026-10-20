# Microfront Launcher

Herramienta local para iniciar y administrar el entorno de desarrollo de MOVA.

## Estructura

- `microfront-launcher/`: frontend Angular.
- `microfront-launcher-api/`: API local en Node.js.
- `data/` y `storage/`: configuración y estado local; no se versionan.

## Primer uso

Desde la raíz, instala el coordinador de procesos:

```powershell
npm install
```

Instala las dependencias del frontend:

```powershell
npm --prefix microfront-launcher install
```

## Desarrollo

Para iniciar API y frontend juntos:

```powershell
npm start
```

La API queda disponible en `http://127.0.0.1:3187` y el frontend en
`http://localhost:4200`.

También pueden ejecutarse por separado con `npm run start:api` y
`npm run start:web`.

## Versionado de microfronts

El comando siguiente incrementa la versión del microfront con `npm version`,
crea su tag `vX.Y.Z` y actualiza el remote correspondiente en todos los
`config/*/app-config.json` de las webapps encontradas:

```powershell
npm run release:microfront -- hcen_mf_centros patch
```

Los tipos de versión permitidos son `patch`, `minor` y `major`. La raíz de
proyectos se obtiene de `data/config.json`; si se necesita limitar la búsqueda
se puede indicar `--root C:\\gitlab\\hcen` y, opcionalmente,
`--webapp hcen_webapp_centros`. Antes de efectuar cambios consulta `origin`,
valida que el microfront y las webapps estén limpios, en la rama `main` o
`master` y exactamente sincronizados con `origin/main` u `origin/master`.

Para revisar el alcance sin modificar nada:

```powershell
npm run release:microfront -- hcen_mf_centros patch --dry-run
```
