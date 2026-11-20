import {
  readPreferences
} from "./../lib/core.js";
import { state } from "./../state.js";
import { emit } from '../lib/runtime-events.js';

export class RuntimeStateService {
  static getState() {
    return state;
  }

  static getRuntime() {
    return { ...state, preferences: readPreferences() };
  }

  static emitState() {
    emit('runtime', RuntimeStateService.getRuntime());
  }

  static emitPreferences() {
    emit('preferences', readPreferences());
  }

  // ---- Components state ----
  static setComponentsState(patch) {
    state.components = { ...state.components, ...patch };
    RuntimeStateService.emitState();
  }

  static resetComponentsState() {
    RuntimeStateService.setComponentsState({
      status: 'stopped',
      url: null,
      version: null,
      tag: null,
      external: false,
    });
  }

  // ---- Microfrontend branch/build/operations ----
  static updateMicrofrontendBranch(patch) {
    state.microfrontendBranch = { ...state.microfrontendBranch, ...patch };
    RuntimeStateService.emitState();
  }

  static updateMicrofrontendBuild(patch) {
    state.microfrontendBuild = { ...state.microfrontendBuild, ...patch };
    RuntimeStateService.emitState();
  }

  static updateMicrofrontendOperation(kind, projectId, microfrontendId, patch) {
    const key = `${kind}:${microfrontendId}`;
    state.microfrontendOperations = {
      ...state.microfrontendOperations,
      [key]: {
        ...(state.microfrontendOperations[key] || {}),
        kind,
        projectId,
        microfrontendId,
        ...patch,
      },
    };
    RuntimeStateService.emitState();
  }
}
