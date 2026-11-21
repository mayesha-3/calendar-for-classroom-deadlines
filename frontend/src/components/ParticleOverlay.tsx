import { useMemo, memo } from 'react'
import { useTheme } from '../context/ThemeContext'

const COUNT = 24

const SIZES = ['0.4vw', '0.8vw', '1.4vw'] as const

const LEAF_COLORS = [
  'rgba(220, 80, 60, 0.55)',
  'rgba(230, 140, 40, 0.5)',
  'rgba(60, 160, 60, 0.45)',
  'rgba(200, 60, 50, 0.4)',
  'rgba(240, 160, 30, 0.4)',
  'rgba(50, 140, 50, 0.5)',
]

const FIRE_COLORS = [
  'rgba(255, 80, 0, 0.6)',
  'rgba(255, 160, 0, 0.55)',
  'rgba(255, 200, 30, 0.5)',
  'rgba(255, 50, 10, 0.5)',
  'rgba(255, 120, 0, 0.6)',
  'rgba(255, 220, 60, 0.45)',
]

const BLOSSOM_COLORS = [
  'rgba(255, 183, 197, 0.6)',
  'rgba(255, 150, 180, 0.55)',
  'rgba(255, 210, 220, 0.5)',
  'rgba(255, 170, 200, 0.45)',
  'rgba(248, 130, 170, 0.5)',
  'rgba(255, 200, 210, 0.55)',
]

const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

const ParticleOverlay = memo(function ParticleOverlay() {
  const { theme } = useTheme()

  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        i,
        x: r(1, 99),
        delay: r(0, 12),
        dur: r(7, 15),
        size: pick(SIZES),
        drift: r(-40, 40),
        opacity: r(0.3, 0.7),
        leafColor: pick(LEAF_COLORS),
        fireColor: pick(FIRE_COLORS),
        blossomColor: pick(BLOSSOM_COLORS),
        spin: r(180, 720),
      })),
    [],
  )

  return (
    <>
      <style>{`
@keyframes _pfall{
  0%{transform:translateY(-5vh) translateX(0px) rotate(0deg);opacity:0}
  8%{opacity:var(--_po)}
  88%{opacity:var(--_po)}
  100%{transform:translateY(105vh) translateX(var(--_dx)) rotate(var(--_rot));opacity:0}
}
@keyframes _pleaf{
  0%{transform:translate(0px,-5vh) rotate(0deg);opacity:0}
  8%{opacity:var(--_po)}
  88%{opacity:var(--_po)}
  100%{transform:translate(-95vw,105vh) rotate(var(--_rot));opacity:0}
}
@keyframes _pblossom{
  0%{transform:translate(0px,-5vh) rotate(0deg);opacity:0}
  8%{opacity:var(--_po)}
  88%{opacity:var(--_po)}
  100%{transform:translate(95vw,105vh) rotate(var(--_rot));opacity:0}
}
@keyframes _prise{
  0%{transform:translateY(105vh) translateX(0px) scale(1);opacity:0}
  10%{opacity:var(--_po)}
  75%{opacity:calc(var(--_po) * 0.5)}
  100%{transform:translateY(-5vh) translateX(var(--_dx)) scale(0.35);opacity:0}
}
@keyframes _pfire{
  0%{transform:translateY(0px) translateX(0px) scale(1);opacity:0}
  5%{opacity:var(--_po)}
  30%{opacity:var(--_po)}
  60%{opacity:calc(var(--_po)*0.5);transform:translateY(-45vh) translateX(var(--_dx)) scale(0.7)}
  100%{transform:translateY(-90vh) translateX(var(--_dx)) scale(0.1);opacity:0}
}
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 15,
          overflow: 'hidden',
        }}
      >
        {particles.map((p) => {
          const base: Record<string, unknown> = {
            position: 'absolute' as const,
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
            willChange: 'transform',
            '--_dx': `${p.drift}px`,
            '--_po': `${p.opacity}`,
          }

          if (theme === 'light') {
            return null
          } else if (theme === 'dark') {
            // 🌸 Cherry blossoms — diagonal from top-left
            base.left = `${r(-20, 40)}%`
            Object.assign(base, {
              animationName: '_pblossom',
              '--_rot': `${p.spin}deg`,
              width: p.size,
              height: p.size,
              borderRadius: '50% 0% 50% 50%',
              background: `radial-gradient(circle at 50% 40%, ${p.blossomColor}, rgba(255,180,200,0.1))`,
            })
          } else if (theme === 'frost') {
            // ❄️ Snow — pure white, fuzzy halo blur
            Object.assign(base, {
              animationName: '_pfall',
              '--_rot': '0deg',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: '#FFFFFF',
              filter: 'blur(1.5px)',
              boxShadow: '0 0 6px 2px rgba(255,255,255,0.7), 0 0 14px 4px rgba(200,230,255,0.3)',
            })
          } else if (theme === 'green') {
            // 🍃 Leaves — sharp edges, diagonal 45° from top-right
            base.left = `${r(60, 120)}%`
            Object.assign(base, {
              animationName: '_pleaf',
              '--_rot': `${p.spin}deg`,
              width: p.size,
              height: p.size,
              clipPath: 'polygon(50% 0%, 80% 15%, 100% 45%, 85% 75%, 50% 100%, 15% 75%, 0% 45%, 20% 15%)',
              background: p.leafColor,
            })
          } else {
            // 🫧 Bubbles (barbie) — blue/purple/white gradient, rise from below
            Object.assign(base, {
              animationName: '_prise',
              '--_rot': '0deg',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.3) 0%, rgba(100,140,255,0.4) 40%, rgba(160,100,220,0.2) 75%, transparent 100%)',
              border: '1px solid rgba(140,160,255,0.15)',
              boxShadow: '0 0 3px rgba(130,150,255,0.15)',
            })
          }

          return <div key={p.i} style={base as React.CSSProperties} />
        })}
      </div>
    </>
  )
})

export default ParticleOverlay
