import { motion } from 'framer-motion'
import { Zap, Bot, Code2, Video, BarChart3, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const services = [
  {
    slug: 'automatizacion',
    icon: Zap,
    title: 'Automatización de procesos',
    description: 'Conecto tus herramientas digitales para que trabajen solas. Formularios, facturas, correos, gestión de clientes y flujos de trabajo — todo en piloto automático.',
    tags: ['Make', 'n8n', 'Power Automate', 'APIs'],
  },
  {
    slug: 'agentes-ia',
    icon: Bot,
    title: 'Agentes IA y chatbots',
    description: 'Diseño e implemento asistentes inteligentes y agentes IA para tu negocio: atención al cliente, gestión interna, automatización con lenguaje natural.',
    tags: ['Botpress', 'Assistant API', 'Copilot Studio', 'ChatGPT'],
  },
  {
    slug: 'vibe-coding',
    icon: Code2,
    title: 'Vibe Coding — apps con IA',
    description: 'Creo aplicaciones web funcionales usando inteligencia artificial como co-programadora, sin código tradicional. Tu idea, convertida en producto digital.',
    tags: ['Cursor', 'Claude Code', 'Replit', 'Google AI Studio'],
  },
  {
    slug: 'audiovisual',
    icon: Video,
    title: 'Producción audiovisual con IA',
    description: 'Avatares digitales con lip-sync, clonación de voz, generación de imágenes y vídeos con IA. Contenido profesional sin grabaciones constantes.',
    tags: ['Avatares IA', 'Clonación de voz', 'ComfyUI', 'Vídeo IA'],
  },
  {
    slug: 'marketing',
    icon: BarChart3,
    title: 'Marketing digital con IA',
    description: 'Estrategia y ejecución de SEO, SEM, email marketing y redes sociales con herramientas de inteligencia artificial para multiplicar resultados.',
    tags: ['SEO con IA', 'SEM', 'Email marketing', 'Redes sociales'],
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' },
  }),
}

export default function Services() {
  return (
    <section id="servicios" className="section-cream py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-gold-dark text-sm font-medium tracking-[0.25em] uppercase mb-3">
            Qué puedo hacer por ti
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-charcoal mb-5">Servicios</h2>
          <p className="text-warm-gray text-lg max-w-xl mx-auto">
            Haz clic en cualquier servicio para ver casos de uso reales, cómo funciona y cuánto tiempo puedes ahorrar.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => {
            const Icon = service.icon
            return (
              <motion.div
                key={service.slug}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={cardVariants}
              >
                <Link
                  to={`/servicios/${service.slug}`}
                  className="group relative bg-white rounded-2xl p-7 border border-champagne hover:border-gold/40 transition-all duration-300 hover:shadow-xl hover:shadow-gold/10 hover:-translate-y-1 flex flex-col h-full block"
                >
                  <div className="w-12 h-12 rounded-xl bg-champagne group-hover:bg-gold/10 transition-colors duration-300 flex items-center justify-center mb-5">
                    <Icon size={22} className="text-gold-dark" />
                  </div>
                  <h3 className="text-charcoal font-bold text-xl mb-3 leading-snug">{service.title}</h3>
                  <p className="text-warm-gray text-sm leading-relaxed mb-5 flex-1">{service.description}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {service.tags.map(tag => (
                      <span key={tag} className="text-xs bg-champagne text-warm-brown px-3 py-1 rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-gold-dark text-sm font-semibold group-hover:gap-3 transition-all duration-200">
                    Ver casos de uso
                    <ArrowRight size={16} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-gold-light rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-14"
        >
          <p className="text-warm-gray mb-5">¿No sabes por dónde empezar? Cuéntame tu caso y lo vemos juntos.</p>
          <a
            href="https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow inline-block bg-charcoal hover:bg-warm-brown text-cream font-semibold px-8 py-4 rounded-full text-sm transition-colors duration-200"
          >
            Cuéntame tu proyecto
          </a>
        </motion.div>
      </div>
    </section>
  )
}
