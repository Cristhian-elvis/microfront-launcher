export function createNotFoundHandler() {
  return function notFoundHandler(request, response) {
    response.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Ruta no encontrada',
      },
    });
  };
}
