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
