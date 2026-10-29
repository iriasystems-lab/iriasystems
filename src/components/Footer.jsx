export default function Footer() {
  return (
    <footer className="section-charcoal border-t border-gold/10 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-cream/30 text-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IRIA Systems" className="h-6 w-6 object-contain opacity-60" />
          <span>IRIA Systems</span>
        </div>
        <p>Sistemas inteligentes para liberar tu tiempo</p>
        <div className="flex flex-col items-center md:items-end gap-1">
          <p>© {new Date().getFullYear()} IRIA Systems · iriasystems.com</p>
          <div className="flex gap-3 text-xs">
            <a href="/aviso-legal" className="hover:text-cream/60 transition-colors">Aviso Legal</a>
            <span>·</span>
            <a href="/politica-privacidad" className="hover:text-cream/60 transition-colors">Privacidad</a>
            <span>·</span>
            <a href="/politica-cookies" className="hover:text-cream/60 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
