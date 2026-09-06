import { useContext } from 'react';
import { ActionsContext } from '../context/ActionsContext.jsx';

export function useActions() {
  const context = useContext(ActionsContext);

  if (!context) {
    throw new Error('useActions debe usarse dentro de ActionsProvider');
  }

  return context;
}
