import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  readConfig,
  versionsRoot,
} from '../lib/core.js';
import {
  ServiceUnavailableError,
  ValidationError,
} from '../app/errors/app-error.js';

const execFileAsync = promisify(execFile);

let tagCache = null;

function cacheTags(tags) {
  tagCache = Array.isArray(tags) ? tags : [];
  return tagCache;
}

function safeTagName(tag) {
  return String(tag).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function versionPaths(tag) {
  const root = path.join(versionsRoot, safeTagName(tag));

  return {
    root,
    dist: path.join(root, 'dist'),
    manifest: path.join(root, 'manifest.json'),
  };
}

function getCachedVersions() {
  if (!fs.existsSync(versionsRoot)) return [];

  return fs
    .readdirSync(versionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const root = path.join(versionsRoot, entry.name);
      const manifestPath = path.join(root, 'manifest.json');

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return fs.existsSync(path.join(root, 'dist')) ? manifest : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getSourcePath() {
  return String(readConfig().mova.sourcePath || '').trim();
}

function assertRepositoryAvailable(sourcePath) {
  if (sourcePath && fs.existsSync(path.join(sourcePath, '.git'))) {
    return;
  }

  throw new ValidationError({
    message: 'El repositorio MOVA no está disponible para consultar o actualizar tags.',
  });
}

async function readTagsFromGit(sourcePath) {
  const { stdout } = await execFileAsync(
    'git',
    [
      '-C',
      sourcePath,
      'tag',
      '--sort=-creatordate',
      '--format=%(refname:short)|%(creatordate:iso8601)|%(objectname:short)',
    ],
    { encoding: 'utf8', windowsHide: true },
  );

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [tag, date, commit] = line.split('|');
      return { tag, date, commit };
    })
    .filter((item) => item.tag.startsWith('release-'));
}

async function getTags() {
  if (tagCache) return tagCache;

  const sourcePath = getSourcePath();
  if (!sourcePath) return [];

  try {
    assertRepositoryAvailable(sourcePath);
    return cacheTags(await readTagsFromGit(sourcePath));
  } catch {
    return [];
  }
}

async function getVersionByTag(tag) {
  const normalizedTag = String(tag || '').trim();

  if (!/^release-[a-zA-Z0-9._-]+$/.test(normalizedTag)) {
    return null;
  }

  const sourcePath = getSourcePath();
  if (!sourcePath || !fs.existsSync(path.join(sourcePath, '.git'))) {
    return null;
  }

  try {
    const { stdout } = await execFileAsync(
      'git',
      [
        '-C',
        sourcePath,
        'for-each-ref',
        `refs/tags/${normalizedTag}`,
        '--format=%(refname:short)|%(creatordate:iso8601)|%(objectname:short)',
      ],
      { encoding: 'utf8', windowsHide: true },
    );

    const [foundTag, date, commit] = stdout.trim().split('|');
    if (foundTag !== normalizedTag) return null;

    return {
      tag: normalizedTag,
      date,
      commit,
      version: normalizedTag.replace(/^release-/, ''),
      cached: getCachedVersions().some((item) => item.tag === normalizedTag),
      preferred: false,
    };
  } catch {
    return null;
  }
}

async function refreshTags() {
  const sourcePath = getSourcePath();
  assertRepositoryAvailable(sourcePath);

  try {
    await execFileAsync(
      'git',
      ['-C', sourcePath, 'fetch', '--tags', '--prune'],
      { encoding: 'utf8', windowsHide: true },
    );
  } catch (error) {
    throw new ServiceUnavailableError({
      message: 'No se pudieron actualizar los tags de MOVA. Verifica la conexión con GitLab e inténtalo de nuevo.',
      cause: error,
    });
  }

  return cacheTags(await readTagsFromGit(sourcePath));
}

export const movaTagsService = {
  getCachedVersions,
  getTags,
  getVersionByTag,
  refreshTags,
  safeTagName,
  versionPaths,
};
