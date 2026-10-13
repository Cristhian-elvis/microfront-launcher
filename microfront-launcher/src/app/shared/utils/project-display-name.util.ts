/** Obtiene el identificador corto visible de una shell. */
export function projectDisplayName(name: string | null | undefined): string {
  const value = String(name ?? '');
  const match = /^([a-z0-9]{4})_webapp_/i.exec(value);

  return ((match?.[1] ?? value) || 'Ninguna').toUpperCase();
}
