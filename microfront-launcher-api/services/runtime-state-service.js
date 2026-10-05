import {
  readPreferences
} from "./../lib/core.js";
import { state } from "./../state.js";
import {
  emit
} from "./../lib/runtime.js";

export class RuntimeStateService {
  static getRuntime() {
    return { ...state, preferences: readPreferences() };
  }

  static emitState() {
    emit('runtime', RuntimeStateService.getRuntime());
  }

  static emitPreferences() {
    emit('preferences', readPreferences());
  }

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
