import { Helmet } from 'react-helmet-async'
import { CheckCircle, MessageCircle, GraduationCap, Briefcase, Globe2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import { useReveal, useRevealChildren } from '../hooks/useReveal'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

const values = [
  'Más de 2 años trabajando con automatización e inteligencia artificial aplicada a negocios',
  'Especializada en IA práctica: solo lo que funciona para tu negocio, nada de tecnología por tecnología',
  'Formación y acompañamiento para que el cliente gane autonomía e independencia real',
  'Experiencia en empresas de varios sectores: cultura, eventos, gastronomía y servicios',
  'Trabajo en español, inglés y ruso',
]

const highlights = [
  { icon: GraduationCap, title: 'Máster en IA aplicada',  desc: 'Formación especializada en Inteligencia Artificial aplicada a negocios y equipos empresariales.' },
  { icon: Briefcase,     title: 'Proyectos reales',        desc: 'Automatizaciones activas en Make y n8n, apps web funcionales con IA y pipelines de datos para clientes.' },
  { icon: Globe2,        title: 'Multilingüe',             desc: 'Trabajo con clientes en España, Rusia y el mercado hispanohablante en general.' },
  { icon: Sparkles,      title: 'Enfoque práctico',        desc: 'No vendo promesas: entrego sistemas que funcionan y que el cliente puede mantener solo.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  '@id': 'https://iriasystems.com/sobre-iryna',
  name: 'Sobre Iryna Lyovina — IRIA Systems',
  url: 'https://iriasystems.com/sobre-iryna',
  mainEntity: {
    '@type': 'Person',
    '@id': 'https://iriasystems.com/#iryna',
    name: 'Iryna Lyovina',
    jobTitle: 'Consultora de Inteligencia Artificial y Automatización',
    description: 'Especialista en automatización de procesos con Make y n8n, agentes IA, desarrollo de aplicaciones con vibe coding y formación en IA para equipos empresariales.',
    image: 'https://iriasystems.com/foto-iryna.jpg',
    url: 'https://iriasystems.com/sobre-iryna',
    worksFor: { '@type': 'Organization', name: 'IRIA Systems', url: 'https://iriasystems.com' },
    knowsLanguage: ['es', 'en', 'uk'],
    areaServed: { '@type': 'Country', name: 'España' },
  },
}

export default function SobreMi() {
  const photoRef    = useReveal()
  const textRef     = useReveal()
  const valHeaderRef = useReveal()
  const valListRef  = useRevealChildren(80)
  const gridRef     = useRevealChildren(80)
  const ctaRef       = useReveal()
  const hlHeaderRef  = useReveal()

  return (
    <>
      <Helmet>
        <title>Sobre Iryna Lyovina — Consultora IA y Automatización | IRIA Systems</title>
        <meta name="description" content="Soy Iryna Lyovina, consultora especializada en automatización con Make/n8n, agentes IA y formación para equipos. Diseño sistemas inteligentes que liberan tiempo y escalan negocios." />
        <link rel="canonical" href="https://iriasystems.com/sobre-iryna" />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content="https://iriasystems.com/sobre-iryna" />
        <meta property="og:title" content="Sobre Iryna Lyovina — Consultora IA y Automatización" />
        <meta property="og:description" content="Especialista en automatización e inteligencia artificial. Diseño sistemas que trabajan por tu negocio." />
        <meta property="og:image" content="https://iriasystems.com/foto-iryna.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navbar />

      <main className="section-dark min-h-screen">

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-32 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            <div ref={photoRef} className="reveal-left relative flex justify-center lg:justify-start">
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl border border-gold/20" />
                <div className="absolute -inset-6 rounded-3xl border border-gold/10" />
                <img
                  src="/foto-iryna.jpg"
                  alt="Iryna Lyovina — Consultora IA y Automatización, IRIA Systems"
                  loading="eager"
                  decoding="async"
                  className="relative w-80 h-96 object-cover object-top rounded-2xl"
                />
                <div className="absolute -bottom-4 -right-4 w-8 h-8 rounded-full bg-gold opacity-80" />
                <div className="absolute -top-4 -left-4 w-4 h-4 rounded-full border-2 border-gold/50" />
              </div>
            </div>

            <div ref={textRef} className="reveal-right">
              <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-4">Sobre mí</p>
              <h1 className="text-4xl md:text-5xl font-bold text-cream mb-6 leading-tight">
                Hola, soy Iryna.<br />
                <span className="gold-gradient">Diseño sistemas</span><br />
                que trabajan por ti.
              </h1>
              <p className="text-cream/60 text-base leading-relaxed mb-5">
                Soy consultora especializada en automatización e inteligencia artificial aplicada a negocios.
                Llevo años ayudando a emprendedores y empresas a recuperar horas perdidas en tareas repetitivas, creando sistemas que funcionan solos.
              </p>
              <p className="text-cream/60 text-base leading-relaxed mb-8">
                Mi misión es simple: que tu negocio funcione mejor, con menos esfuerzo manual.
                No se trata de hacer más cosas — se trata de tener mejores sistemas.
              </p>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                className="btn-glow inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-charcoal font-bold px-8 py-4 rounded-full">
                <MessageCircle size={20} />
                Hablemos por WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-charcoal/50 border-y border-gold/10 py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div ref={valHeaderRef} className="reveal mb-10 text-center">
              <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-3">Por qué elegirme</p>
              <h2 className="text-3xl md:text-4xl font-bold text-cream">Lo que me diferencia</h2>
            </div>
            <ul ref={valListRef} className="space-y-4">
              {values.map((item, i) => (
                <li key={i} className="reveal flex items-start gap-3 text-cream/70 text-base">
                  <CheckCircle size={18} className="text-gold mt-1 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Highlights */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div ref={hlHeaderRef} className="reveal text-center mb-14">
              <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-3">Trayectoria</p>
              <h2 className="text-3xl md:text-4xl font-bold text-cream">Formación y experiencia</h2>
            </div>
            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {highlights.map((h) => {
                const HIcon = h.icon
                return (
                  <div key={h.title} className="reveal card-glow border border-white/10 bg-white/[0.03] rounded-2xl p-7">
                    <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-5">
                      <HIcon size={22} className="text-gold" />
                    </div>
                    <h3 className="text-cream font-bold text-xl mb-2">{h.title}</h3>
                    <p className="text-cream/55 text-sm leading-relaxed">{h.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section-cream py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div ref={ctaRef} className="reveal">
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-5">¿Trabajamos juntos?</h2>
              <p className="text-warm-gray text-lg mb-10">
                Cuéntame tu situación y te digo cómo puedo ayudarte. Sin compromiso, sin tecnicismos.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <a href={WA_URL} target="_blank" rel="noopener noreferrer"
                  className="btn-glow inline-flex items-center gap-3 bg-charcoal hover:bg-warm-brown text-cream font-bold px-10 py-4 rounded-full text-lg transition-colors">
                  <MessageCircle size={22} />
                  Hablamos por WhatsApp
                </a>
                <Link to="/contacto"
                  className="btn-glow inline-flex items-center gap-3 border-2 border-charcoal text-charcoal hover:bg-charcoal hover:text-cream font-bold px-10 py-4 rounded-full text-lg transition-colors">
                  Envíame un mensaje
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  )
}
