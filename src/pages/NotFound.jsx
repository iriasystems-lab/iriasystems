import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Página no encontrada — IRIA Systems</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>


      <main className="section-dark min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-4">Error 404</p>
          <h1 className="text-4xl md:text-5xl font-bold text-cream mb-6">Página no encontrada</h1>
          <p className="text-cream/60 mb-10">
            Esta página no existe o ha sido movida. Vuelve al inicio o escríbeme si necesitas algo.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-charcoal font-bold px-8 py-4 rounded-full transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </main>

    </>
  )
}
