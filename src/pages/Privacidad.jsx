import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function Privacidad() {
  return (
    <>
      <Helmet>
        <title>Política de Privacidad — IRIA Systems</title>
        <meta name="description" content="Política de privacidad y tratamiento de datos personales de IRIA Systems." />
        <link rel="canonical" href="https://iriasystems.com/politica-privacidad" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>


      <main className="section-dark min-h-screen pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-cream/70 text-sm leading-relaxed">
          <h1 className="text-2xl font-bold text-cream mb-8">Política de Privacidad</h1>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">1. Responsable del tratamiento</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-cream">Titular:</strong> Iryna Lyovina</li>
            <li><strong className="text-cream">Correo:</strong> <a href="mailto:hola@iriasystems.com" className="text-gold hover:underline">hola@iriasystems.com</a></li>
          </ul>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">2. Datos que se recogen y cómo</h2>
          <p>
            Este sitio web <strong className="text-cream">no dispone de formularios de contacto ni recoge datos personales de forma automática</strong>.
            El contacto se realiza a través de canales externos (WhatsApp, email, Telegram) gestionados
            por sus respectivos proveedores.
          </p>
          <p className="mt-3">
            Cuando te pones en contacto a través de esos canales, los datos que facilites
            (nombre, correo, información de tu consulta) se tratan únicamente para responder
            y gestionar la relación comercial.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">3. Finalidad y base legal</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Responder a consultas y gestionar la relación precontractual o contractual.</li>
            <li>Base legal: interés legítimo y ejecución del contrato (art. 6.1.b y f del RGPD).</li>
          </ul>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">4. Conservación</h2>
          <p>
            Los datos se conservan durante el tiempo necesario para la prestación del servicio
            y, en caso de contrato, durante los plazos legales de conservación mercantil y fiscal.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">5. Cesión a terceros</h2>
          <p>
            No se ceden datos a terceros salvo obligación legal. El uso de canales de mensajería
            externos (WhatsApp, Telegram) implica el tratamiento de datos por sus propietarios
            según sus propias políticas de privacidad.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">6. Tus derechos</h2>
          <p>
            Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación, portabilidad
            y oposición escribiendo a <a href="mailto:hola@iriasystems.com" className="text-gold hover:underline">hola@iriasystems.com</a>.
            Si consideras que el tratamiento no es conforme al RGPD, puedes reclamar ante la Agencia
            Española de Protección de Datos (aepd.es).
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">7. Almacenamiento local en el navegador</h2>
          <p>
            Este sitio utiliza <strong className="text-cream">localStorage</strong> exclusivamente para recordar
            tu elección sobre el aviso de cookies. No se almacena ningún dato personal y la
            información no sale de tu dispositivo.
          </p>

          <div className="mt-10 pt-6 border-t border-white/10 flex gap-4 text-xs">
            <Link to="/aviso-legal" className="text-gold hover:underline">Aviso Legal</Link>
            <Link to="/politica-cookies" className="text-gold hover:underline">Política de Cookies</Link>
          </div>
        </div>
      </main>

    </>
  )
}
