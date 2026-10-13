/* eslint-disable no-console */
import process from 'process';
import chalk from 'chalk';
import ora from 'ora';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getColouredBranchName, getProjectCurrentBranch, selectProjectBranch } from '@mova3/lib-schematics';

const args = yargs(hideBin(process.argv)).argv;

// Admite uno o más microfronts: como argumentos posicionales (separados por
// espacios) y/o mediante `-p`/`--project` (admite una lista separada por comas).
const projectNames = [
  ...(args._ ?? []),
  ...(args.project ? String(args.project).split(',') : []),
  ...(args.p ? String(args.p).split(',') : []),
]
  .map(value => String(value).trim())
  .filter(Boolean);

// Nombre de la rama a seleccionar. Puede ser un nombre simple ("main") o incluir
// el remote explícitamente ("miOrigin/main") para desambiguar si hay varios
// remotes con una rama del mismo nombre; `git checkout` interpreta ambos casos.
const branchName = args.branch || args.b;

if (!projectNames.length || !branchName) {
  console.log(
    [
      chalk.red('Debe especificar al menos un microfront y la rama a seleccionar.\n'),
      '',
      '-----------------------------------------------------------------------------------------------------------------------',
      chalk.bold('Instrucciones de uso:'),
      '-----------------------------------------------------------------------------------------------------------------------',
      `$ npm run ${chalk.magenta('change-branch-project')} -- ${chalk.blue('<microfront-1> [microfront-2 ...]')} ${chalk.blue('[-b, --branch=]<nombre-rama>')}`,
      '',
      chalk.bold('Opciones:'),
      '  [-b, --branch=<nombre-rama>]    Nombre de la rama a seleccionar en los microfronts indicados.',
      '                                  Puede incluir el remote explícitamente (p. ej. "miOrigin/main")',
      '                                  si hay varios remotes con una rama del mismo nombre y hay que desambiguar.',
      '  [-p, --project=<lista>]         Lista de microfronts separados por comas (alternativa a los argumentos posicionales).',
      '',
      chalk.gray(
        '  Nota: este script solo cambia de rama (git checkout). Para sincronizar, instalar dependencias',
      ),
      chalk.gray(
        `  o compilar tras el cambio, use ${chalk.magenta('check-project')} o ${chalk.magenta('prepare-server')}.`,
      ),
      '',
      chalk.bold('Ejemplos:'),
      chalk.gray('El siguiente ejemplo cambia la rama del microfront "hcen_mf_grupos" a "develop"'),
      `$ npm run ${chalk.magenta('change-branch-project')} -- ${chalk.blue('hcen_mf_grupos')} ${chalk.green('--branch=develop')}`,
      '',
      chalk.gray('El siguiente ejemplo cambia la rama de varios microfronts a la vez (argumentos posicionales)'),
      `$ npm run ${chalk.magenta('change-branch-project')} -- ${chalk.blue('hcen_mf_grupos hcen_mf_usuarios')} ${chalk.green('-b=develop')}`,
      '',
      chalk.gray('El siguiente ejemplo es equivalente al anterior, usando `--project` con una lista separada por comas'),
      `$ npm run ${chalk.magenta('change-branch-project')} -- ${chalk.green('--project=hcen_mf_grupos,hcen_mf_usuarios')} ${chalk.green('-b=develop')}`,
      '',
      chalk.gray('El siguiente ejemplo desambigua explícitamente indicando el remote dentro de la rama'),
      `$ npm run ${chalk.magenta('change-branch-project')} -- ${chalk.blue('hcen_mf_grupos')} ${chalk.green('-b=miOrigin/main')}`,
      '-----------------------------------------------------------------------------------------------------------------------',
    ].join('\n'),
  );
  process.exit(0);
}

/**
 * Cambia la rama de un único microfront, mostrando el progreso con un spinner.
 * Se asume que el proyecto estará en una ruta hermana a la carpeta actual (shell).
 *
 * Responsabilidad única: cambiar de rama (`git checkout`). No sincroniza, instala
 * dependencias ni compila; para eso ya existen los scripts `check-project` y
 * `prepare-server`, que delegan en `ProjectChecker`/`MicrofrontendProjectChecker`.
 *
 * `selectProjectBranch` ejecuta literalmente `git checkout <targetBranch>`, por lo
 * que el string recibido puede ser un nombre simple ("main") o incluir el remote
 * explícitamente ("miOrigin/main"); es responsabilidad del propio Git (y de quien
 * invoca el script) resolver la ambigüedad si existiera, sin lógica adicional aquí.
 *
 * Importante: únicamente ejecuta una operación local respecto al remoto. Nunca
 * sobrescribe ni fuerza cambios en el repositorio remoto (`origin`): el checkout
 * solo mueve el `HEAD` local o crea una rama de tracking local si aún no existe.
 * @param {string} projectName Nombre de la carpeta que contiene el microfront.
 * @param {string} targetBranch Nombre de la rama a seleccionar.
 * @returns {Promise<boolean>} `true` si el cambio de rama se realizó correctamente.
 */
async function changeMicrofrontendBranch(projectName, targetBranch) {
  const spinner = ora();
  const projectPath = `../${projectName}`;

  spinner.start(`Procesando el microfront ${chalk.yellow(projectName)} ...`);

  const currentBranch = getProjectCurrentBranch(projectPath);

  if (currentBranch === targetBranch) {
    spinner.succeed(
      `El microfront ${chalk.green(projectName)} ya está en la rama ${getColouredBranchName(targetBranch, 'green')}.`,
    );
    return true;
  }

  try {
    spinner.start(
      `Cambiando el microfront ${chalk.yellow(projectName)} de la rama ${getColouredBranchName(
        currentBranch,
        'yellow',
      )} a ${getColouredBranchName(targetBranch, 'green')} ...`,
    );
    await selectProjectBranch(projectName, targetBranch);
    spinner.succeed(
      `Microfront ${chalk.green(projectName)} cambiado correctamente a la rama ${getColouredBranchName(targetBranch, 'green')}.`,
    );
    return true;
  } catch (error) {
    spinner.fail(chalk.red(`No se ha podido cambiar la rama del microfront ${projectName}: ${error.message || error}`));
    return false;
  }
}

try {
  console.log(
    chalk.blue(
      `\nCambiando ${projectNames.length} microfront(s) a la rama ${chalk.bold(branchName)} ...\n`,
    ),
  );

  const results = [];
  for (const projectName of projectNames) {
    // Se procesa un microfront a la vez para mantener la salida en consola ordenada y legible.
    results.push(await changeMicrofrontendBranch(projectName, branchName));
  }

  const succeededCount = results.filter(Boolean).length;
  console.log(
    chalk.blue(
      `\n${succeededCount}/${projectNames.length} microfront(s) actualizados correctamente a la rama ${chalk.bold(branchName)}.`,
    ),
  );

  process.exit(succeededCount === projectNames.length ? 0 : 1);
} catch (error) {
  ora().fail(chalk.red(error));
  process.exit(1);
}
