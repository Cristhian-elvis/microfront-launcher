import { useContext } from 'react';
import { FlashContext } from '../context/FlashContext.jsx';

export function useFlash() {
  const context = useContext(FlashContext);

  if (!context) {
    throw new Error('useFlash debe usarse dentro de FlashProvider');
  }

  return {
    notice: context.notice,
    flash: context.flash,
  };
}
