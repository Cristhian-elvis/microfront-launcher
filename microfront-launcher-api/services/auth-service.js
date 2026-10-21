import path from 'node:path';

import { NotFoundError, ServiceUnavailableError, ValidationError } from '../app/errors/app-error.js';
import { executeWrite, queryAll, queryOne } from '../lib/database.js';
import { getIndexedProject, getProjects, readJson } from '../lib/core.js';

const ticketUrl = process.env.AUTH_TICKET_URL;
const tokenUrl = process.env.AUTH_TOKEN_URL;
const tokenGrantType = process.env.AUTH_TOKEN_GRANT_TYPE;

const ticketIdentityDefaults = {
  tipo: '',
  nombre: 'JUAN',
  apellido1: 'PEREZ',
  apellido2: 'string',
  cif: 'string',
  razonSocial: 'string',
};

function normalizeProfile(input) {
  const cdUsuario = String(input?.cdUsuario ?? '').trim().toUpperCase();
  const webapp = String(input?.webapp ?? '').trim();
  const descripcion = String(input?.descripcion ?? '').trim();
  const profiles = Array.isArray(input?.profiles)
    ? [...new Set(input.profiles.map((value) => String(value).trim().toUpperCase()).filter(Boolean))]
    : [];

  if (!cdUsuario || !webapp || !descripcion || !profiles.length) {
    throw new Error('cdUsuario, webapp, descripción y al menos un perfil son obligatorios.');
  }

  return { cdUsuario, webapp, descripcion, profiles };
}

function mapProfile(row) {
  return {
    id: Number(row.id),
    cdUsuario: row.cd_usuario,
    webapp: row.webapp,
    profiles: JSON.parse(row.profiles),
    descripcion: row.descripcion,
  };
}

function mapStoredToken(row) {
  return {
    id: Number(row.id),
    userProfileId: Number(row.user_profile_id),
    webapp: row.webapp,
    profileDescription: row.profile_description,
    cdUsuario: row.cd_usuario,
    accessToken: row.access_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStoredTokens() {
  const rows = await queryAll(
    `SELECT token.id, token.user_profile_id, token.webapp, token.access_token,
            token.created_at, token.updated_at,
            profile.descripcion AS profile_description, profile.cd_usuario
     FROM auth_tokens AS token
     INNER JOIN auth_user_profiles AS profile ON profile.id = token.user_profile_id
     ORDER BY token.updated_at DESC`,
  );
  return rows.map(mapStoredToken);
}

export async function deleteStoredToken(id) {
  const token = await queryOne('SELECT id FROM auth_tokens WHERE id = ?', [id]);
  if (!token) throw new NotFoundError({ message: 'No se encontró el token guardado.' });
  await executeWrite('DELETE FROM auth_tokens WHERE id = ?', [id]);
}

export async function listUserProfiles(webapp) {
  const rows = await queryAll(
    `SELECT id, cd_usuario, webapp, profiles, descripcion
     FROM auth_user_profiles
     WHERE (? = '' OR webapp = ?)
     ORDER BY descripcion, cd_usuario`,
    [webapp ?? '', webapp ?? ''],
  );
  return rows.map(mapProfile);
}

export async function createUserProfile(input) {
  const profile = normalizeProfile(input);
  await executeWrite(
    `INSERT INTO auth_user_profiles (cd_usuario, webapp, profiles, descripcion)
     VALUES (?, ?, ?, ?)`,
    [profile.cdUsuario, profile.webapp, JSON.stringify(profile.profiles), profile.descripcion],
  );
  const row = await queryOne(
    `SELECT id, cd_usuario, webapp, profiles, descripcion
     FROM auth_user_profiles
     WHERE cd_usuario = ? AND webapp = ?`,
    [profile.cdUsuario, profile.webapp],
  );
  if (!row) throw new Error('No se pudo recuperar el perfil creado.');
  return mapProfile(row);
}

export async function updateUserProfile(id, input) {
  const profile = normalizeProfile(input);
  await executeWrite(
    `UPDATE auth_user_profiles
     SET cd_usuario = ?, webapp = ?, profiles = ?, descripcion = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [profile.cdUsuario, profile.webapp, JSON.stringify(profile.profiles), profile.descripcion, id],
  );
  const row = await queryOne(
    'SELECT id, cd_usuario, webapp, profiles, descripcion FROM auth_user_profiles WHERE id = ?',
    [id],
  );
  if (!row) throw new Error('No se encontró el perfil de usuario.');
  return mapProfile(row);
}

export async function deleteUserProfile(id) {
  const profile = await queryOne('SELECT id FROM auth_user_profiles WHERE id = ?', [id]);
  if (!profile) throw new Error('No se encontró el perfil de usuario.');
  await executeWrite('DELETE FROM auth_tokens WHERE user_profile_id = ?', [id]);
  await executeWrite('DELETE FROM auth_user_profiles WHERE id = ?', [id]);
}

function appCredentials(project) {
  const configPaths = [
    project.webappPath && path.join(
      project.webappPath,
      'config',
      project.configFolder,
      'app-config.json',
    ),
    path.join(project.path, 'config', project.configFolder, 'app-config.json'),
  ].filter(Boolean);

  for (const appConfigPath of configPaths) {
    const config = readJson(appConfigPath, null);
    const credentials = config?.environment?.clientCredentials ?? config?.clientCredentials;
    if (credentials?.clientId && credentials?.secretId && credentials?.scope) {
      return credentials;
    }
  }

  throw new ValidationError({
    message: 'La webapp no tiene clientCredentials válidas en config.environment.clientCredentials.',
  });
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ServiceUnavailableError({
        message: 'La solicitud al servicio de autenticación agotó el tiempo de espera.',
      });
    }
    throw new ServiceUnavailableError({
      message: 'No fue posible conectar con el servicio de autenticación.',
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseJson(response, operation) {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ServiceUnavailableError({
      message: `${operation} falló (${response.status}).`,
      details: body,
    });
  }
  return body;
}

export async function generateToken({ projectId, userProfileId }) {
  let project = getIndexedProject(projectId);

  // El índice se mantiene en memoria y puede estar vacío tras reiniciar el API
  // o invalidar el escaneo, aunque el frontend conserve un projectId válido.
  if (!project) {
    await getProjects();
    project = getIndexedProject(projectId);
  }

  if (!project?.configFolder) {
    throw new NotFoundError({
      message: 'No se encontró la webapp seleccionada. Actualiza la lista de shells e inténtalo de nuevo.',
    });
  }

  const row = await queryOne(
    'SELECT id, cd_usuario, webapp, profiles, descripcion FROM auth_user_profiles WHERE id = ?',
    [userProfileId],
  );
  if (!row) throw new NotFoundError({ message: 'No se encontró el perfil de usuario.' });
  const userProfile = mapProfile(row);
  if (userProfile.webapp !== project.configFolder) {
    throw new ValidationError({ message: 'El perfil seleccionado no pertenece a la webapp elegida.' });
  }

  const credentials = appCredentials(project);
  const basicAuthorization = `Basic ${Buffer.from(
    `${credentials.clientId}:${credentials.secretId}`,
  ).toString('base64')}`;
  const ticketRequestBody = {
    ...ticketIdentityDefaults,
    nif: userProfile.cdUsuario,
    cdUsuario: userProfile.cdUsuario,
    perfiles: userProfile.profiles,
  };

  const ticketResponse = await fetchWithTimeout(ticketUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuthorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(ticketRequestBody),
  });
  const ticketPayload = await responseJson(ticketResponse, 'La generación de ticket');
  const ticket = ticketPayload?.data;
  if (!ticket || typeof ticket !== 'string') throw new Error('La respuesta de ticket no contiene data.');

  const tokenBody = new URLSearchParams({
    grant_type: tokenGrantType,
    'autologin-ticket': ticket,
    scope: credentials.scope,
  });
  const tokenResponse = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuthorization,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody,
  });
  const tokenPayload = await responseJson(tokenResponse, 'La generación de token');
  await executeWrite('DELETE FROM auth_tokens WHERE webapp = ?', [userProfile.webapp]);
  await executeWrite(
    `INSERT INTO auth_tokens (user_profile_id, webapp, access_token)
     VALUES (?, ?, ?)`,
    [userProfile.id, userProfile.webapp, tokenPayload?.access_token],
  );

  return {
    accessToken: tokenPayload?.access_token,
  };
}
