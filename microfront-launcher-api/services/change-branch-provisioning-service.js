import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeJson } from '../lib/core.js';

const libDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(libDir, '..', 'templates', 'change-branch-project.mjs');

const SCRIPT_RELATIVE_PATH = path.join('scripts', 'change-branch-project.mjs');
const SCRIPT_NAME = 'change-branch-project';
const SCRIPT_COMMAND = `node ${SCRIPT_RELATIVE_PATH.replace(/\\/g, '/')}`;

/**
 * Asegura que la shell del proyecto tenga el script `change-branch-project`
 * disponible, copiando la plantilla oficial del launcher y registrándolo en
 * su `package.json` si todavía no existe.
 *
 * Es una operación idempotente: si el script y la entrada del `package.json`
 * ya existen, no hace nada.
 * @param {{ path: string }} project Proyecto (shell) sobre el que operar.
 * @returns {boolean} `true` si el script quedó disponible (ya existía o se provisionó).
 */
export function ensureChangeBranchScript(project) {
  const shellPath = project.path;
  const scriptPath = path.join(shellPath, SCRIPT_RELATIVE_PATH);
  const packageJsonPath = path.join(shellPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) return false;

  if (!fs.existsSync(scriptPath)) {
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.copyFileSync(templatePath, scriptPath);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.scripts?.[SCRIPT_NAME] !== SCRIPT_COMMAND) {
    packageJson.scripts = { ...packageJson.scripts, [SCRIPT_NAME]: SCRIPT_COMMAND };
    writeJson(packageJsonPath, packageJson);
  }

  return true;
}

export { SCRIPT_NAME as changeBranchScriptName };
