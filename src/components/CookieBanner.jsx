import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'iria_cookies_ok'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true)
    } catch {
      // localStorage bloqueado (modo privado u otra restricción): no mostrar
    }
  }, [])

  function accept() {
    try { localStorage.setItem(KEY, '1') } catch { /* ok */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 bg-charcoal border-t border-gold/20 px-6 py-4 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-cream/70 text-sm leading-relaxed">
          Este sitio usa únicamente <strong className="text-cream">localStorage</strong> para recordar esta elección.
          No hay cookies de seguimiento ni analítica de terceros.{' '}
          <Link to="/politica-cookies" className="text-gold hover:underline">Saber más</Link>.
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 bg-gold hover:bg-gold-light text-charcoal font-bold text-sm px-6 py-2 rounded-full transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
