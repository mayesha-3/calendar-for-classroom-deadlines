import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'barbie' | 'frost' | 'green'

const THEME_ORDER: Theme[] = ['light', 'dark', 'barbie', 'frost', 'green']

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('kc-theme')
    if (saved === 'dark' || saved === 'barbie' || saved === 'frost' || saved === 'green') return saved
    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'barbie', 'frost', 'green')
    if (theme !== 'light') root.classList.add(theme)
    localStorage.setItem('kc-theme', theme)
  }, [theme])

  const toggle = () =>
    setTheme((prev) => {
      const idx = THEME_ORDER.indexOf(prev)
      return THEME_ORDER[(idx + 1) % THEME_ORDER.length]
    })

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
