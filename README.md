# Microfront Launcher V2

Aplicación local React + Node para iniciar de forma secuencial MOVA UI
Components, Storybook, una shell y el Chrome de desarrollo autorizado.

## Uso diario

Haz doble clic en `iniciar.cmd` o ejecuta:

```powershell
npm run start
```

La interfaz se abre en `http://127.0.0.1:3187`. No requiere `npm install` para
el uso diario y no utiliza Electron ni servicios de Windows.

## Flujo de inicio

1. Reutiliza o compila la versión MOVA seleccionada y la asocia a la carpeta
   `server` de la shell mediante una junction de Windows.
2. Inicia una única shell en el puerto configurado en **Puerto Components**
   (por defecto, `8080`), con la librería incluida.
3. También puede iniciar únicamente Components en ese mismo puerto.
4. Abre Chrome cuando todos los pasos anteriores están disponibles.

Cancelar el inicio detiene los procesos gestionados, anula las esperas y evita
que Chrome se abra posteriormente.

## Versiones de MOVA UI Components

Los tags se leen desde:

```text
C:\gitlab\mova\mova3\mova3_lib_ui_components
```

El repositorio fuente nunca cambia de rama o tag. Para compilar una versión se
crea una copia aislada, se ejecutan `npm ci` y `npm run build`, y se guardan los
resultados en:

```text
storage\mova-components\versions\<tag>\
├── manifest.json
├── dist\
└── www\
```

La versión `release-1.5.2` se incluye como build inicial importado. Las
preferencias se almacenan en `storage\preferences.json`.

## Seguridad de puertos

- Puerto configurable (por defecto `8080`): shell con Components o Components
  por separado. Solo uno de los dos puede usarlo a la vez.

## Desarrollo del launcher

```powershell
npm install --cache .npm-cache
npm run build
```

## Pendiente

- Mostrar los microfrontends asociados a cada shell.
