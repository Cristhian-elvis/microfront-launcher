import fs from 'node:fs';
import path from 'node:path';

import {
  versionsRoot,
  workRoot,
  readConfig,
  writeJson,
  assertInside,
} from '../../lib/core.js';
import { movaTagsService } from '../../services/mova-tags-service.js';
import { addLog } from '../../lib/runtime-events.js';
import { startStaticServer, stopStaticServer } from '../../lib/static-server.js';
import { selectedVersion } from '../../services/components-version-service.js';
import { RuntimeStateService } from '../../services/runtime-state-service.js';
import { assertNotCancelled, runProcessStep } from '../../services/process-runner-service.js';
import { ConflictError, ValidationError } from '../../app/errors/app-error.js';

const state = RuntimeStateService.getState();
let startOperation = null;

export async function buildComponents(version, signal, { force = false } = {}) {
    const tag = version.tag;
    let localVersion = await movaTagsService.getVersionByTag(tag);
    let tagsSynchronized = false;

    if (!localVersion) {
      assertNotCancelled(signal);
      addLog(
        'MOVA Components',
        'stage',
        `El tag ${tag} no está disponible localmente. Sincronizando tags remotos.`,
      );
      await movaTagsService.refreshTags();
      tagsSynchronized = true;
      assertNotCancelled(signal);
      localVersion = await movaTagsService.getVersionByTag(tag);
    }

    if (!localVersion) throw new ValidationError({ message: `El tag no existe localmente: ${tag}` });

    if (tagsSynchronized) {
      addLog('MOVA Components', 'success', `Tag ${tag} sincronizado correctamente.`);
    }

    const config = readConfig();
    const storageDirectories = [
      { path: versionsRoot, label: 'caché de versiones' },
      { path: workRoot, label: 'área de trabajo temporal' },
    ];

    for (const directory of storageDirectories) {
      if (fs.existsSync(directory.path)) continue;
      addLog('Versiones', 'stage', `Creando ${directory.label}: ${directory.path}`);
      fs.mkdirSync(directory.path, { recursive: true });
      addLog('Versiones', 'success', `${directory.label} creada.`);
    }

    const working = path.join(
      workRoot,
      `${movaTagsService.safeTagName(tag)}-${Date.now()}`,
    );
    assertInside(workRoot, working);

    const destination = movaTagsService.versionPaths(tag);
    const hasCachedBuild =
      fs.existsSync(destination.manifest) && fs.existsSync(destination.dist);

    if (hasCachedBuild && !force) return destination;

    try {
      await runProcessStep({
        key: 'build:clone',
        label: 'Versiones',
        file: 'git',
        args: ['clone', '--local', '--no-checkout', config.mova.sourcePath, working],
        cwd: workRoot,
        signal,
      });

      await runProcessStep({
        key: 'build:checkout',
        label: 'Versiones',
        file: 'git',
        args: ['checkout', '--detach', tag],
        cwd: working,
        signal,
      });

      await runProcessStep({
        key: 'build:install',
        label: 'Build MOVA',
        file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['ci'],
        cwd: working,
        signal,
      });

      await runProcessStep({
        key: 'build:compile',
        label: 'Build MOVA',
        file: process.platform === 'win32' ? 'npm.cmd' : 'npm',
        args: ['run', 'build'],
        cwd: working,
        signal,
      });

      assertNotCancelled(signal);

      const sourceDist = path.join(working, 'dist');
      if (!fs.existsSync(sourceDist)) {
        throw new ValidationError({ message: 'El build no generó la carpeta dist.' });
      }

      if (force && fs.existsSync(destination.root)) {
        assertInside(versionsRoot, destination.root);
        fs.rmSync(destination.root, { recursive: true, force: true });
      }

      fs.mkdirSync(destination.root, { recursive: true });
      fs.cpSync(sourceDist, destination.dist, { recursive: true });

      assertNotCancelled(signal);
      writeJson(destination.manifest, { tag });

      addLog('Build MOVA', 'success', `${tag} compilado y almacenado para reutilizarse.`);
      return destination;
    } finally {
      if (!fs.existsSync(destination.manifest) && fs.existsSync(destination.root)) {
        assertInside(versionsRoot, destination.root);
        fs.rmSync(destination.root, { recursive: true, force: true });
      }
      if (fs.existsSync(working)) {
        assertInside(workRoot, working);
        fs.rmSync(working, { recursive: true, force: true });
      }
    }
  }

async function startComponentsStandalone() {
    if (state.components?.status === 'running') {
      throw new ConflictError({ message: 'Components ya está en ejecución.' });
    }

    const version = await selectedVersion();
    if (!version) {
      throw new ValidationError({
        message: 'Selecciona una versión de MOVA Components antes de iniciarlo.',
      });
    }

    const paths = await buildComponents(version, new AbortController().signal);
    const config = readConfig();

    const server = await startStaticServer({
      key: 'components',
      label: 'MOVA Components',
      root: paths.dist,
      port: Number(config.shellDefaults.serverPort),
      aliases: ['/cudc-lib-componentes-stencil-VAL'],
      fallbackIndex: false,
    });

    RuntimeStateService.setComponentsState({
      status: 'running',
      url: server.url,
      version: version.version,
      tag: version.tag,
      external: false,
    });
    return state.components;
  }

export function startComponentsInBackground() {
    if (startOperation || state.components?.status === 'running') {
      throw new ConflictError({
        message: 'MOVA Components ya está iniciándose o en ejecución.',
      });
    }

    RuntimeStateService.setComponentsState({
      status: 'starting',
      url: null,
      version: null,
      tag: null,
      external: false,
    });

    startOperation = startComponentsStandalone()
      .catch((error) => {
        RuntimeStateService.setComponentsState({
          status: 'error',
          url: null,
          version: null,
          tag: null,
          external: false,
        });
        addLog(
          'MOVA Components',
          'error',
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        startOperation = null;
      });
  }

export async function stopComponents() {
    await stopStaticServer('components');
    RuntimeStateService.resetComponentsState();
  }
