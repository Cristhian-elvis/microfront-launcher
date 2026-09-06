import { createContext, useCallback } from 'react';
import { api } from '../../lib/api.js';
import { useFlash } from '../hooks/useFlash.js';
import { useProjects } from '../hooks/useProjects.js';

export const ActionsContext = createContext(null);

export function ActionsProvider({ children, onRefreshState }) {
  const { flash } = useFlash();
  const { refreshProjects } = useProjects();

  const action = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: 'POST',
          body: JSON.stringify(body || {}),
        });
        await onRefreshState?.();
        return result;
      } catch (e) {
        flash(e.message, 'error');
      }
    },
    [flash, onRefreshState],
  );

  const startMicrofrontendAction = useCallback(
    async (url, body) => {
      try {
        const result = await api(url, {
          method: 'POST',
          body: JSON.stringify(body || {}),
        });
        await onRefreshState?.();
        return result;
      } catch (e) {
        flash(e.message, 'error');
        throw e;
      }
    },
    [flash, onRefreshState],
  );

  // Acciones específicas
  const onComponentStop = useCallback(
    () => action('/api/components/stop'),
    [action],
  );

  const onComponentStart = useCallback(
    () => action('/api/components/start'),
    [action],
  );

  const onOpenBrowser = useCallback(
    (mode) => action('/api/chrome/open', { mode }),
    [action],
  );

  const onEnvironmentStop = useCallback(
    () => action('/api/environment/stop'),
    [action],
  );

  const onChromeDismiss = useCallback(
    () => action('/api/chrome/dismiss'),
    [action],
  );

  const onChromeOpen = useCallback(
    (mode, remember) => action('/api/chrome/open', { mode, remember }),
    [action],
  );

  const onShellRebuild = useCallback(
    (projectId) => action('/api/shell/rebuild', { projectId }),
    [action],
  );

  const value = {
    action,
    startMicrofrontendAction,
    onComponentStop,
    onComponentStart,
    onOpenBrowser,
    onEnvironmentStop,
    onChromeDismiss,
    onChromeOpen,
    onShellRebuild,
  };

  return (
    <ActionsContext.Provider value={value}>
      {children}
    </ActionsContext.Provider>
  );
}
