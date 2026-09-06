import { useCallback, useMemo } from "react";

export function useAppPreferences(state, preferences) {
  const favoriteIds = useMemo(
    () => state.preferences.favoriteShellIds || [],
    [state.preferences.favoriteShellIds],
  );

  const favoriteMicrofrontIds = useMemo(
    () => state.preferences.favoriteMicrofrontIds || [],
    [state.preferences.favoriteMicrofrontIds],
  );

  const toggleFavorite = useCallback(
    (projectId) =>
      preferences(
        {
          favoriteShellIds: favoriteIds.includes(projectId)
            ? favoriteIds.filter((id) => id !== projectId)
            : [...favoriteIds, projectId],
        },
        false,
      ),
    [favoriteIds, preferences],
  );

  const toggleMicrofrontFavorite = useCallback(
    (microfrontId) =>
      preferences(
        {
          favoriteMicrofrontIds: favoriteMicrofrontIds.includes(microfrontId)
            ? favoriteMicrofrontIds.filter((id) => id !== microfrontId)
            : [...favoriteMicrofrontIds, microfrontId],
        },
        false,
      ),
    [favoriteMicrofrontIds, preferences],
  );

  return {
    favoriteIds,
    favoriteMicrofrontIds,
    toggleFavorite,
    toggleMicrofrontFavorite,
  };
}
