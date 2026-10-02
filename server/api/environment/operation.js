import { RuntimeStateService } from '../../services/runtime-state-service.js';

export class EnvironmentOperationService {
  static current = null;

  static start(details = {}) {
    if (EnvironmentOperationService.current)
      throw new Error('Ya hay una operación de entorno en curso.');
    EnvironmentOperationService.current = {
      id: `${Date.now()}-${Math.random()}`,
      controller: new AbortController(),
      ...details,
    };
    RuntimeStateService.emitState();
    return EnvironmentOperationService.current;
  }

  static end(id) {
    if (EnvironmentOperationService.current?.id !== id) return;
    EnvironmentOperationService.current = null;
    RuntimeStateService.emitState();
  }

  static clear() {
    EnvironmentOperationService.current = null;
    RuntimeStateService.emitState();
  }

  static get() {
    return EnvironmentOperationService.current;
  }

  static isRunning() {
    return Boolean(EnvironmentOperationService.current);
  }
}
