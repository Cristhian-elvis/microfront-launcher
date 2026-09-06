import { createContext, useCallback, useState } from 'react';

export const FlashContext = createContext(null);

export function FlashProvider({ children }) {
  const [notice, setNotice] = useState(null);

  const flash = useCallback((message, kind = 'success') => {
    setNotice({ message, kind });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  const value = {
    notice,
    flash,
  };

  return (
    <FlashContext.Provider value={value}>
      {children}
    </FlashContext.Provider>
  );
}
