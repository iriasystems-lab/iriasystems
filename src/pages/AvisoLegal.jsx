import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function AvisoLegal() {
  return (
    <>
      <Helmet>
        <title>Aviso Legal — IRIA Systems</title>
        <meta name="description" content="Aviso legal e información sobre el titular de iriasystems.com." />
        <link rel="canonical" href="https://iriasystems.com/aviso-legal" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <Navbar />

      <main className="section-dark min-h-screen pt-28 pb-20 px-6">
        <div className="max-w-3xl mx-auto prose prose-invert text-cream/70 text-sm leading-relaxed">
          <h1 className="text-2xl font-bold text-cream mb-8">Aviso Legal</h1>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">1. Titular del sitio web</h2>
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la
            Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong className="text-cream">Titular:</strong> Iryna Lyovina</li>
            <li><strong className="text-cream">Actividad:</strong> Consultoría de inteligencia artificial y automatización de procesos</li>
            <li><strong className="text-cream">Correo electrónico:</strong> <a href="mailto:hola@iriasystems.com" className="text-gold hover:underline">hola@iriasystems.com</a></li>
            <li><strong className="text-cream">Sitio web:</strong> https://iriasystems.com</li>
          </ul>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">2. Objeto y condiciones de uso</h2>
          <p>
            Este sitio web tiene carácter informativo y comercial. Su uso implica la aceptación de
            las presentes condiciones. El titular se reserva el derecho a modificar el contenido del
            sitio sin previo aviso.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">3. Propiedad intelectual</h2>
          <p>
            Los textos, imágenes, logotipos y demás contenidos de este sitio son propiedad de Iryna
            Lyovina o están debidamente licenciados. Queda prohibida su reproducción total o parcial
            sin autorización expresa.
          </p>
          <p className="mt-3">
            Algunas imágenes de este sitio pueden haber sido generadas o retocadas con herramientas
            de inteligencia artificial.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">4. Exclusión de responsabilidad</h2>
          <p>
            El titular no garantiza la disponibilidad continua del sitio ni se hace responsable de
            los daños derivados de su uso. Los enlaces a sitios externos son de responsabilidad de
            sus respectivos titulares.
          </p>

          <h2 className="text-lg font-semibold text-cream mt-8 mb-3">5. Legislación aplicable</h2>
          <p>
            Las presentes condiciones se rigen por la legislación española. Para cualquier
            controversia, las partes se someten a los juzgados y tribunales de España, salvo que
            la normativa de consumo aplicable establezca un fuero diferente.
          </p>

          <div className="mt-10 pt-6 border-t border-white/10 flex gap-4 text-xs">
            <Link to="/politica-privacidad" className="text-gold hover:underline">Política de Privacidad</Link>
            <Link to="/politica-cookies" className="text-gold hover:underline">Política de Cookies</Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
