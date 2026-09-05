import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(assets, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src', 'main.jsx')],
  outfile: path.join(assets, 'app.js'),
  bundle: true,
  minify: true,
  sourcemap: false,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }
});

fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#07111f" />
    <title>Microfront Launcher</title>
    <link rel="stylesheet" href="/assets/app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>\n`, 'utf8');

console.log('Interfaz compilada en dist/.');
