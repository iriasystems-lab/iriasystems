export default function Footer() {
  return (
    <footer className="section-charcoal border-t border-gold/10 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-cream/30 text-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="IRIA Systems" className="h-6 w-6 object-contain opacity-60" />
          <span>IRIA Systems</span>
        </div>
        <p>Sistemas inteligentes para liberar tu tiempo</p>
        <p>© {new Date().getFullYear()} IRIA Systems · iriasystems.com</p>
      </div>
    </footer>
  )
}
