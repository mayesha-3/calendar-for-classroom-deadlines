import { Sun, Moon, Sparkles, Snowflake, Leaf } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const themeLabels = {
  light: 'dark',
  dark: 'barbie',
  barbie: 'frost',
  frost: 'green',
  green: 'light',
} as const

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-4 z-50 w-11 h-11 sm:w-12 sm:h-12 sm:bottom-6 sm:right-6 rounded-full flex items-center justify-center
        bg-[var(--surface)] border border-[var(--border)] shadow-lg
        hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
      title={`Switch to ${themeLabels[theme]} mode`}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-[var(--text2)]" />
      ) : theme === 'dark' ? (
        <Sparkles size={20} className="text-pink-400" />
      ) : theme === 'barbie' ? (
        <Snowflake size={20} className="text-sky-300" />
      ) : theme === 'frost' ? (
        <Leaf size={20} className="text-emerald-400" />
      ) : (
        <Sun size={20} className="text-amber-400" />
      )}
    </button>
  )
}
