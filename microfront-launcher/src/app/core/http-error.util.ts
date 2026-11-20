import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

const FALLBACK_MESSAGE = 'No se pudo completar la operación.';

export function getHttpErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const payload = error.error as ApiErrorPayload | null;
    const apiMessage = payload?.error?.message?.trim();

    if (apiMessage) {
      return apiMessage;
    }

    if (error.message) {
      return error.message;
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : FALLBACK_MESSAGE;
}
