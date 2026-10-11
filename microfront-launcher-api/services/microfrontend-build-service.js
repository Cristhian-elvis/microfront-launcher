import { isBranchOperationRunning } from '../application/microfrontends/branch-use-cases.js';
import { addLog } from '../lib/runtime-events.js';
import { spawnManaged } from '../lib/process-manager.js';
import { state } from '../state.js';
import { RuntimeStateService } from './runtime-state-service.js';
import { selectMicrofrontends } from './microfrontend-selection-service.js';

/**
 * Construye los argumentos de `npm run check-project` a partir de las opciones
 * elegidas por el usuario. Por defecto (sin pasar `options`) replica exactamente
 * el comportamiento nativo del script: no se salta ningún paso.
 * @param {string} microfrontendName
 * @param {{ syncGit?: boolean, forceBuild?: boolean, skipBuild?: boolean, skipCheck?: boolean, localMode?: boolean }} [options]
 */
function buildCheckProjectArgs(microfrontendName, options = {}) {
  const {
    syncGit = true, forceBuild = false, skipBuild = false, skipCheck = false, localMode = false,
  } = options;
  const args = ['run', 'check-project', '--', microfrontendName];
  const skip = [];
  // El paso `update` ejecuta git fetch/pull automáticamente; se puede omitir
  // explícitamente para evitar latencia de red o cambios no esperados.
  if (!syncGit) skip.push('update');
  // `check` e `install` están acoplados en check-project: `install` solo se
  // activa si `check` detectó dependencias faltantes, así que se omiten juntos.
  if (skipCheck) skip.push('check', 'install');
  // Permite usar check-project únicamente para sincronizar Git, sin compilar.
  if (skipBuild) skip.push('build');
  if (skip.length) args.push(`--skip=${skip.join(',')}`);
  if (forceBuild) args.push('--forceBuild');
  // Enlaza las librerías mova3 localmente vía symlink en vez de usar la versión publicada.
  if (localMode) args.push('--local');
  return args;
}

/**
 * Compila un microfrontend delegando en el script oficial `check-project` de la shell.
 *
 * `check-project` (provisto por `@mova3/lib-schematics`) además de compilar:
 * - Revisa dependencias del microfrontend e instala las que falten.
 * - Enlaza el resultado del build (`dist/`) como symlink dentro de `server/<nombre>/<version>`,
 *   que es lo que permite que la shell local sirva el remote sin pasos manuales adicionales.
 *
 * El comando debe ejecutarse con cwd en la shell (carpeta hermana del microfrontend),
 * ya que así resuelve `check-project` la ruta del proyecto objetivo.
 * @param {{ syncGit?: boolean, forceBuild?: boolean }} [options]
 */
function spawnCheckProjectBuild(project, microfrontend, options) {
  return spawnManaged({
    key: `microfrontend-build:${project.id}:${microfrontend.id}`,
    label: `Build · ${microfrontend.name}`,
    file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: buildCheckProjectArgs(microfrontend.name, options),
    cwd: project.path,
    longRunning: false,
  });
}

export function buildMicrofrontend(project, microfrontend, options) {
    if (isBranchOperationRunning() || state.microfrontendBuild.status === 'running') {
      throw new Error('Ya hay una operación de microfrontend en curso.');
    }
    if (!microfrontend?.buildAvailable) {
      throw new Error(
        `El microfrontend ${microfrontend?.name || ''} no define npm run build.`,
      );
    }
    if (!project?.workflow?.checkProject) {
      throw new Error(
        `La shell ${project?.name || ''} no define npm run check-project.`,
      );
    }

    const record = spawnCheckProjectBuild(project, microfrontend, options);
    RuntimeStateService.updateMicrofrontendBuild({
      status: 'running',
      projectId: project.id,
      microfrontendId: microfrontend.id,
      phase: 'build',
      message: 'Compilando.',
      error: null,
      startedAt: new Date().toISOString(),
    });
    record.done.then(({ code }) => {
      if (state.microfrontendBuild.microfrontendId !== microfrontend.id) return;
      if (code === 0) {
        RuntimeStateService.updateMicrofrontendBuild({
          status: 'success',
          message: `${microfrontend.name} compilado correctamente.`,
          error: null,
        });
        return;
      }
      RuntimeStateService.updateMicrofrontendBuild({
        status: 'error',
        message: 'La compilación no se completó.',
        error: `${microfrontend.name} terminó con código ${code ?? '-'}.`,
      });
    });
    return record;
  }

export async function startBatch(projectId, microfrontendIds, options) {
    if (isBranchOperationRunning() || state.microfrontendBuild.status === 'running') {
      throw new Error('Ya hay una operación de microfrontend en curso.');
    }
    const { project, microfrontends } = await selectMicrofrontends(
      projectId,
      microfrontendIds,
    );
    if (microfrontends.some((item) => !item.buildAvailable)) {
      throw new Error('La selección contiene microfronts sin el script npm run build.');
    }
    if (!project?.workflow?.checkProject) {
      throw new Error(`La shell ${project?.name || ''} no define npm run check-project.`);
    }
    const startedAt = new Date().toISOString();
    void (async () => {
      const results = [];
      try {
        // Se compila un microfrontend a la vez: check-project ejecuta procesos pesados
        // (npm install, ng build) que compiten por CPU/red si se lanzan en paralelo,
        // y mantiene la columna de "Chequeo de proceso" de la UI legible y ordenada.
        for (const microfrontend of microfrontends) {
          RuntimeStateService.updateMicrofrontendOperation('build', projectId, microfrontend.id, {
            status: 'running', phase: 'build', message: 'Compilando', error: null, startedAt,
          });
          const record = spawnCheckProjectBuild(project, microfrontend, options);
          const { code } = await record.done;
          const succeeded = code === 0;
          RuntimeStateService.updateMicrofrontendOperation('build', projectId, microfrontend.id, {
            status: succeeded ? 'success' : 'error', phase: succeeded ? 'done' : 'error',
            message: succeeded ? 'Completado' : 'No se completó la compilación',
            error: succeeded ? null : `Terminó con código ${code ?? '-'}.`, startedAt,
          });
          results.push(succeeded);
        }
        const completedIds = microfrontends.filter((_, index) => results[index]).map((item) => item.id);
        RuntimeStateService.updateMicrofrontendBuild({
          status: results.every(Boolean) ? 'success' : 'error', projectId,
          microfrontendId: microfrontends.at(-1).id, phase: 'done',
          message: `${completedIds.length}/${microfrontends.length} microfronts compilados.`,
          error: null, startedAt, batchIds: microfrontendIds, completedIds,
        });
      } catch (error) {
        RuntimeStateService.updateMicrofrontendBuild({
          status: 'error', error: error.message,
          message: 'La compilación por lote no se completó.', startedAt, batchIds: microfrontendIds,
        });
        addLog('Microfronts', 'error', error.message);
      }
    })();
  }
