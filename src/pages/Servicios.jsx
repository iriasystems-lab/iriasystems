import { Helmet } from 'react-helmet-async'
import { Zap, Bot, Code2, Video, BarChart3, Lightbulb, ArrowRight, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import { useReveal, useRevealChildren } from '../hooks/useReveal'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

const services = [
  {
    slug: 'automatizacion',
    icon: Zap,
    title: 'Automatización de procesos',
    description: 'Conecto tus herramientas digitales para que trabajen solas. Formularios, facturas, correos, gestión de clientes y flujos de trabajo — todo en piloto automático.',
    tags: ['Make', 'n8n', 'Power Automate', 'APIs'],
    benefit: 'Ahorra hasta 20h/semana en tareas repetitivas',
  },
  {
    slug: 'agentes-ia',
    icon: Bot,
    title: 'Agentes IA y chatbots',
    description: 'Diseño e implemento asistentes inteligentes y agentes IA para tu negocio: atención al cliente, gestión interna, automatización con lenguaje natural.',
    tags: ['Botpress', 'Assistant API', 'Copilot Studio', 'ChatGPT'],
    benefit: 'Atención al cliente 24/7 sin coste adicional',
  },
  {
    slug: 'vibe-coding',
    icon: Code2,
    title: 'Vibe Coding — apps con IA',
    description: 'Creo aplicaciones web funcionales usando inteligencia artificial como co-programadora. Tu idea, convertida en producto digital funcional.',
    tags: ['Cursor', 'Claude Code', 'Replit', 'Google AI Studio'],
    benefit: 'Tu app en semanas, no meses',
  },
  {
    slug: 'audiovisual',
    icon: Video,
    title: 'Producción audiovisual con IA',
    description: 'Avatares digitales con lip-sync, clonación de voz, generación de imágenes y vídeos con IA. Contenido profesional sin grabaciones constantes.',
    tags: ['Avatares IA', 'Clonación de voz', 'ComfyUI', 'Vídeo IA'],
    benefit: 'Multiplica tu contenido sin multiplicar el tiempo',
  },
  {
    slug: 'marketing',
    icon: BarChart3,
    title: 'Marketing digital con IA',
    description: 'Estrategia y ejecución de SEO, SEM, email marketing y redes sociales con herramientas de inteligencia artificial para multiplicar resultados.',
    tags: ['SEO con IA', 'SEM', 'Email marketing', 'Redes sociales'],
    benefit: 'Más visibilidad con menos esfuerzo manual',
  },
  {
    slug: 'consultoria-ia',
    icon: Lightbulb,
    title: 'Consultoría IA para empresas',
    description: 'Identifico dónde la IA puede transformar tu negocio, diseño el plan de implementación y formo a tu equipo para que lo ejecute. Sin teoría, solo resultados.',
    tags: ['Auditoría IA', 'Formación equipos', 'Hoja de ruta', 'Implementación'],
    benefit: 'Hoja de ruta clara para implementar IA',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': 'https://iriasystems.com/servicios',
  name: 'Servicios de Automatización e IA — IRIA Systems',
  url: 'https://iriasystems.com/servicios',
  description: 'Catálogo completo de servicios de automatización de procesos, agentes IA, desarrollo de apps, producción audiovisual con IA, marketing digital y consultoría IA para empresas.',
  provider: { '@type': 'Organization', name: 'IRIA Systems', url: 'https://iriasystems.com' },
  hasPart: services.map(s => ({
    '@type': 'Service',
    name: s.title,
    url: `https://iriasystems.com/servicios/${s.slug}`,
    description: s.description,
  })),
}

export default function Servicios() {
  const heroRef = useReveal()
  const gridRef = useRevealChildren(80)
  const ctaRef  = useReveal()

  return (
    <>
      <Helmet>
        <title>Servicios de Automatización e IA — IRIA Systems</title>
        <meta name="description" content="Automatización con Make/n8n, agentes IA, chatbots, vibe coding, producción audiovisual con IA, marketing digital y consultoría IA para empresas. Iryna Lyovina — IRIA Systems." />
        <link rel="canonical" href="https://iriasystems.com/servicios" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://iriasystems.com/servicios" />
        <meta property="og:title" content="Servicios de Automatización e IA — IRIA Systems" />
        <meta property="og:description" content="Automatización, agentes IA, apps, audiovisual, marketing y consultoría IA para empresas. Sin tecnicismos, resultados reales." />
        <meta property="og:image" content="https://iriasystems.com/foto-iryna.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navbar />

      <main className="section-dark min-h-screen">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-32 pb-16 text-center">
          <div ref={heroRef} className="reveal">
            <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-4">Servicios</p>
            <h1 className="text-4xl md:text-6xl font-bold text-cream mb-6 leading-tight">
              Todo lo que puedo<br /><span className="gold-gradient">hacer por ti</span>
            </h1>
            <p className="text-cream/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Desde automatizar tareas repetitivas hasta crear aplicaciones con IA. Elige el servicio que necesitas o cuéntame tu caso y lo vemos juntos.
            </p>
          </div>
        </section>

        {/* Grid */}
        <section className="max-w-6xl mx-auto px-6 pb-28">
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <div key={service.slug} className="reveal">
                  <Link
                    to={`/servicios/${service.slug}`}
                    className="card-glow group relative border border-white/10 bg-white/[0.03] rounded-2xl p-7 flex flex-col h-full hover:border-gold/40 transition-all duration-300 block"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 group-hover:bg-gold/15 transition-colors duration-300 flex items-center justify-center mb-5">
                      <Icon size={22} className="text-gold" />
                    </div>
                    <h2 className="text-cream font-bold text-xl mb-3 leading-snug">{service.title}</h2>
                    <p className="text-cream/55 text-sm leading-relaxed mb-5 flex-1">{service.description}</p>
                    <div className="bg-gold/10 border border-gold/20 rounded-full px-4 py-2 mb-5 w-fit">
                      <span className="text-gold text-xs font-semibold">{service.benefit}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {service.tags.map(tag => (
                        <span key={tag} className="text-xs bg-white/5 border border-white/10 text-cream/50 px-3 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-gold text-sm font-semibold group-hover:gap-3 transition-all duration-200 mt-auto">
                      Ver casos de uso
                      <ArrowRight size={16} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-gold-light rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                </div>
              )
            })}
          </div>

          <div ref={ctaRef} className="reveal text-center mt-16">
            <p className="text-cream/50 mb-6 text-lg">¿No sabes por dónde empezar? Cuéntame tu caso y lo vemos juntos.</p>
            <a href={WA_URL} target="_blank" rel="noopener noreferrer"
              className="btn-glow inline-flex items-center gap-3 bg-gold hover:bg-gold-light text-charcoal font-bold px-10 py-4 rounded-full text-lg">
              <MessageCircle size={22} />
              Cuéntame tu proyecto
            </a>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  )
}
