import { useEffect, useRef } from 'react'

/**
 * Añade la clase `is-visible` al elemento cuando entra en el viewport.
 * Úsalo así:
 *   const ref = useReveal()
 *   <div ref={ref} className="reveal"> ...
 *
 * Para stagger pasa el delay en ms:
 *   const ref = useReveal(200)
 *   <div ref={ref} className="reveal" style={{ '--delay': '200ms' }}>
 */
export function useReveal(delay = 0) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Si ya es visible (SSR o precarga), mostrar directamente
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay) {
            setTimeout(() => el.classList.add('is-visible'), delay)
          } else {
            el.classList.add('is-visible')
          }
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return ref
}

/**
 * Versión para contenedores con múltiples hijos en stagger.
 * Añade is-visible con delay incremental a cada hijo con clase `reveal`.
 */
export function useRevealChildren(staggerMs = 80) {
  const ref = useRef(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const children = container.querySelectorAll('.reveal')

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          children.forEach((child, i) => {
            setTimeout(() => child.classList.add('is-visible'), i * staggerMs)
          })
          observer.disconnect()
        }
      },
      { threshold: 0.05 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [staggerMs])

  return ref
}
