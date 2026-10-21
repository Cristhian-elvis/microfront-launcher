import {
  createUserProfile,
  deleteStoredToken,
  deleteUserProfile,
  generateToken,
  listStoredTokens,
  listUserProfiles,
  updateUserProfile,
} from '../../services/auth-service.js';

async function listProfiles(request, response) {
  response.json(await listUserProfiles(String(request.query.webapp ?? '')));
}

async function createProfile(request, response) {
  const profile = await createUserProfile(request.body);
  response.status(201).json(profile);
}

async function updateProfile(request, response) {
  const profile = await updateUserProfile(Number(request.params.id), request.body);
  response.json(profile);
}

async function removeProfile(request, response) {
  await deleteUserProfile(Number(request.params.id));
  response.status(204).end();
}

async function createToken(request, response) {
  const token = await generateToken({
    projectId: String(request.body?.projectId ?? ''),
    userProfileId: Number(request.body?.userProfileId),
  });
  response.json(token);
}

async function listTokens(_request, response) {
  response.json(await listStoredTokens());
}

async function removeToken(request, response) {
  await deleteStoredToken(Number(request.params.id));
  response.status(204).end();
}

export const authController = {
  createProfile,
  createToken,
  listProfiles,
  listTokens,
  removeProfile,
  removeToken,
  updateProfile,
};
