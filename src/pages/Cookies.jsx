import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function Cookies() {
  return (
    <>
      <Helmet>
        <title>Política de Cookies — IRIA Systems</title>
        <meta name="description" content="Política de cookies de iriasystems.com. Solo almacenamiento técnico local." />
        <link rel="canonical" href="https://iriasystems.com/politica-cookies" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>


      <main className="section-dark min-h-screen pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-cream/70 text-sm leading-relaxed">
          <h1 className="text-2xl font-bold text-cream mb-8">Política de Cookies</h1>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">¿Este sitio usa cookies?</h2>
          <p>
            <strong className="text-cream">No.</strong> Este sitio web no instala cookies de ningún tipo en tu dispositivo.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">¿Qué almacena entonces?</h2>
          <p>
            Para recordar si ya has visto el aviso de cookies, se usa <strong className="text-cream">localStorage</strong>,
            una función del propio navegador que guarda datos localmente en tu dispositivo.
            A diferencia de las cookies, esta información:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li>No se envía al servidor con cada petición.</li>
            <li>No se comparte con terceros.</li>
            <li>No permite rastrearte entre distintos sitios web.</li>
            <li>Solo existe en tu dispositivo.</li>
          </ul>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">¿Hay analítica o seguimiento de terceros?</h2>
          <p>
            No. Este sitio no incorpora Google Analytics, Meta Pixel, ni ningún otro sistema de
            analítica o rastreo de terceros.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">¿Hay vídeos de YouTube u otros recursos externos?</h2>
          <p>
            No. Todos los recursos (fuentes, iconos, imágenes) están alojados en nuestros propios
            servidores.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">¿Cómo borro el almacenamiento local?</h2>
          <p>
            Puedes eliminar el localStorage de cualquier sitio desde la configuración de privacidad
            de tu navegador o borrando los datos de sitios web. Esto no afecta a tu experiencia
            de navegación en este sitio.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">Contacto</h2>
          <p>
            Para cualquier consulta sobre privacidad o cookies, escríbenos a{' '}
            <a href="mailto:hola@iriasystems.com" className="text-gold hover:underline">hola@iriasystems.com</a>.
          </p>

          <div className="mt-10 pt-6 border-t border-white/10 flex gap-4 text-xs">
            <Link to="/aviso-legal" className="text-gold hover:underline">Aviso Legal</Link>
            <Link to="/politica-privacidad" className="text-gold hover:underline">Política de Privacidad</Link>
          </div>
        </div>
      </main>

    </>
  )
}
