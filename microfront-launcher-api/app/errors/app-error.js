export class AppError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code Stable error code (e.g. ENV_NOT_FOUND)
   * @param {string} params.message Human-friendly message
   * @param {number} [params.statusCode=500] HTTP status code
   * @param {unknown} [params.details] Optional details for debugging/clients
   * @param {unknown} [params.cause] Optional error cause
   */
  constructor({ code, message, statusCode = 500, details = undefined, cause = undefined }) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor({ message = 'Datos inválidos', details } = {}) {
    super({ code: 'VALIDATION_ERROR', message, statusCode: 400, details });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor({ message = 'No encontrado', details } = {}) {
    super({ code: 'NOT_FOUND', message, statusCode: 404, details });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor({ message = 'Conflicto', details } = {}) {
    super({ code: 'CONFLICT', message, statusCode: 409, details });
    this.name = 'ConflictError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor({ message = 'Servicio no disponible', details, cause } = {}) {
    super({
      code: 'SERVICE_UNAVAILABLE',
      message,
      statusCode: 503,
      details,
      cause,
    });
    this.name = 'ServiceUnavailableError';
  }
}
