import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAppPreferences } from './AppPreferencesContext';
import { themeForScheme, type AppTheme } from '../theme';

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = useAppPreferences();
  const theme = useMemo(() => themeForScheme(preferences.colorScheme), [preferences.colorScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
