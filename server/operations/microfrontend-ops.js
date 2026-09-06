import { addLog, stopProcess } from "../lib/runtime.js";
import { getProjects } from "../lib/core.js";
import { spawn } from "node:child_process";

/**
 * Obtiene el microfrontend del proyecto
 * @param {string} projectId - ID del proyecto
 * @param {string} microfrontendId - ID del microfrontend
 * @returns {Promise<Object>} Objeto con {project, microfrontend}
 * @throws {Error} Si proyecto o microfrontend no existe
 */
async function getMicrofrontendData(projectId, microfrontendId) {
  const projects = await getProjects();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    throw new Error(`Proyecto con ID "${projectId}" no encontrado.`);
  }

  const microfrontend = project.microfrontends?.find(
    (m) => m.id === microfrontendId,
  );

  if (!microfrontend) {
    throw new Error(
      `Microfrontend con ID "${microfrontendId}" no encontrado en "${project.name}".`,
    );
  }

  return { project, microfrontend };
}

/**
 * Lanza el explorador de archivos o aplicación para abrir una carpeta
 * @param {string} folderPath - Ruta de la carpeta
 * @throws {Error} Si falla al abrir la carpeta
 */
function launchFileExplorer(folderPath) {
  return new Promise((resolve, reject) => {
    const command =
      process.platform === "win32" ? "explorer.exe" : "xdg-open";

    const child = spawn(command, [folderPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

/**
 * Abre la carpeta del microfrontend en el explorador de archivos
 * @param {string} projectId - ID del proyecto
 * @param {string} microfrontendId - ID del microfrontend
 * @throws {Error} Si el microfrontend no existe
 */
export async function openMicrofrontendFolder(projectId, microfrontendId) {
  const { microfrontend } = await getMicrofrontendData(
    projectId,
    microfrontendId,
  );

  try {
    await launchFileExplorer(microfrontend.path);
    addLog(
      "Microfronts",
      "system",
      `Carpeta abierta para ${microfrontend.name}.`,
    );
  } catch (error) {
    addLog("Microfronts", "error", `Error al abrir carpeta: ${error.message}`);
    throw error;
  }
}

/**
 * Detiene el proceso de watch del microfrontend
 * @param {string} projectId - ID del proyecto
 * @param {string} microfrontendId - ID del microfrontend
 * @returns {boolean} true si el proceso fue detenido, false si no estaba activo
 */
export function stopMicrofrontendWatch(projectId, microfrontendId) {
  return stopProcess(`microfrontend:${projectId}:${microfrontendId}`);
}
