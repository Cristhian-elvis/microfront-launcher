import { AppError } from '../errors/app-error.js';

export function createErrorHandler({ exposeInternalDetails = false } = {}) {
  /**
   * Express error-handling middleware.
   * eslint-disable-next-line no-unused-vars
   */
  return function errorHandler(error, request, response, next) {
    const isAppError = error instanceof AppError;

    const statusCode = isAppError ? error.statusCode : 500;
    const code = isAppError ? error.code : 'INTERNAL_ERROR';
    const message = isAppError ? error.message : 'Error interno';

    const details =
      isAppError && error.details !== undefined
        ? error.details
        : exposeInternalDetails
          ? { stack: error?.stack }
          : undefined;

    // Keep server logs rich, client errors stable.
    console.error(error);

    response.status(statusCode).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : null),
      },
    });
  };
}
