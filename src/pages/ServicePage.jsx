import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, Zap, Bot, Code2, Video, BarChart3, MessageCircle } from 'lucide-react'
import { getServiceBySlug } from '../data/services'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

const iconMap = { Zap, Bot, Code2, Video, BarChart3 }

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
}

export default function ServicePage() {
  const { slug } = useParams()
  const service = getServiceBySlug(slug)

  if (!service) {
    return (
      <div className="min-h-screen section-dark flex flex-col items-center justify-center gap-6">
        <p className="text-cream/60 text-xl">Servicio no encontrado.</p>
        <Link to="/" className="text-gold underline">Volver al inicio</Link>
      </div>
    )
  }

  const Icon = iconMap[service.icon]

  return (
    <div className="section-dark min-h-screen">
      {/* Top nav */}
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-4">
        <Link
          to="/#servicios"
          className="inline-flex items-center gap-2 text-cream/50 hover:text-gold transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Volver a servicios
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <div className="inline-flex items-center gap-3 bg-gold/10 border border-gold/20 rounded-full px-5 py-2 mb-8">
            <Icon size={18} className="text-gold" />
            <span className="text-gold text-sm font-medium">{service.title}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-cream mb-6 leading-tight max-w-3xl">
            {service.tagline}
          </h1>
          <p className="text-cream/60 text-lg max-w-2xl mb-10 leading-relaxed">
            {service.description}
          </p>
          <div className="flex flex-wrap gap-3 mb-10">
            {service.tags.map(tag => (
              <span key={tag} className="bg-gold/10 border border-gold/20 text-gold/80 text-sm px-4 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow inline-flex items-center gap-2 bg-gold hover:bg-gold-light text-charcoal font-bold px-8 py-4 rounded-full"
          >
            <MessageCircle size={20} />
            Quiero este servicio
          </a>
        </motion.div>
      </section>

      {/* Problem */}
      <section className="bg-charcoal/50 border-y border-gold/10 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-2xl md:text-3xl font-bold text-cream mb-5">{service.problemTitle}</h2>
            <p className="text-cream/60 text-lg leading-relaxed">{service.problemText}</p>
          </motion.div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-14"
          >
            <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-3">Casos de uso</p>
            <h2 className="text-3xl md:text-4xl font-bold text-cream">
              Así cambia el día a día con este servicio
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {service.useCases.map((uc, i) => (
              <motion.div
                key={uc.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className={`card-glow rounded-2xl border p-7 ${uc.isProject ? 'border-gold/50 bg-gold/5' : 'border-white/10 bg-white/[0.03]'}`}
              >
                {uc.isProject && (
                  <span className="inline-block bg-gold text-charcoal text-xs font-bold px-3 py-1 rounded-full mb-4">
                    ✦ Proyecto real
                  </span>
                )}
                <div className="flex items-start gap-4 mb-5">
                  <span className="text-3xl">{uc.icon}</span>
                  <h3 className="text-cream font-bold text-xl leading-snug">{uc.title}</h3>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-4">
                    <p className="text-red-300/70 text-xs font-semibold uppercase tracking-wider mb-2">Antes</p>
                    <p className="text-cream/60 text-sm leading-relaxed">{uc.before}</p>
                  </div>
                  <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-xl p-4">
                    <p className="text-emerald-400/70 text-xs font-semibold uppercase tracking-wider mb-2">Después</p>
                    <p className="text-cream/80 text-sm leading-relaxed">{uc.after}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-gold/10 rounded-full px-4 py-2 w-fit">
                  <Clock size={14} className="text-gold" />
                  <span className="text-gold text-sm font-semibold">{uc.timeSaved}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Project case studies */}
      {service.projects && service.projects.length > 0 && (
        <section className="py-20 px-6 bg-charcoal/40 border-y border-gold/10">
          <div className="max-w-5xl mx-auto">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-14 text-center">
              <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-3">Casos reales</p>
              <h2 className="text-3xl md:text-4xl font-bold text-cream">Proyectos realizados</h2>
            </motion.div>

            <div className="space-y-20">
              {service.projects.map((project, pi) => (
                <motion.div
                  key={pi}
                  initial="hidden" whileInView="visible" viewport={{ once: true }} custom={pi} variants={fadeUp}
                  className="border border-gold/20 rounded-3xl p-8 md:p-10 bg-white/[0.02]"
                >
                  {/* Project header */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8 pb-8 border-b border-white/10">
                    <div>
                      <span className="inline-block bg-gold text-charcoal text-xs font-bold px-3 py-1 rounded-full mb-3">
                        ✦ Proyecto real
                      </span>
                      <h3 className="text-cream font-bold text-2xl md:text-3xl mb-2">{project.title}</h3>
                      <p className="text-cream/40 text-sm">{project.client}</p>
                    </div>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border border-gold/30 text-gold text-sm px-4 py-2 rounded-full hover:bg-gold/10 transition-colors whitespace-nowrap"
                      >
                        Ver demo en vivo →
                      </a>
                    )}
                  </div>

                  <p className="text-cream/60 italic mb-8 text-base">{project.subtitle}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
                    <div>
                      <h4 className="text-gold font-semibold mb-3 text-xs uppercase tracking-wider">El problema</h4>
                      <p className="text-cream/70 leading-relaxed mb-6 text-sm">{project.problem}</p>
                      <h4 className="text-gold font-semibold mb-3 text-xs uppercase tracking-wider">La solución</h4>
                      <p className="text-cream/70 leading-relaxed text-sm">{project.solution}</p>
                    </div>
                    <div>
                      <h4 className="text-gold font-semibold mb-4 text-xs uppercase tracking-wider">Funcionalidades</h4>
                      <ul className="space-y-2.5">
                        {project.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-3 text-cream/70 text-sm">
                            <CheckCircle size={15} className="text-gold mt-0.5 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Results */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {project.results.map((r, i) => (
                      <div key={i} className="card-glow bg-gold/5 border border-gold/20 rounded-2xl p-4 text-center">
                        <p className="text-gold font-bold text-2xl mb-1">{r.metric}</p>
                        <p className="text-cream/50 text-xs leading-snug">{r.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="border-l-2 border-gold pl-5 italic text-cream/50 text-sm leading-relaxed mb-7">
                    {project.quote}
                  </blockquote>

                  {/* Stack */}
                  <div>
                    <p className="text-cream/30 text-xs uppercase tracking-wider mb-3">Stack tecnológico</p>
                    <div className="flex flex-wrap gap-2">
                      {project.stack.map(t => (
                        <span key={t} className="card-glow bg-white/5 border border-white/10 text-cream/60 text-xs px-3 py-1.5 rounded-full cursor-default">{t}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-14">
            <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-3">El proceso</p>
            <h2 className="text-3xl md:text-4xl font-bold text-cream">Cómo trabajamos juntos</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {service.howItWorks.map((step, i) => (
              <motion.div
                key={step.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative card-glow border border-white/5 bg-white/[0.02] rounded-2xl p-6"
              >
                <div className="text-gold/20 font-bold text-5xl mb-4 leading-none">{step.step}</div>
                <h3 className="text-cream font-bold mb-2">{step.title}</h3>
                <p className="text-cream/50 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-cream py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-5">
              ¿Listo para empezar?
            </h2>
            <p className="text-warm-gray text-lg mb-10">
              Cuéntame tu situación y te digo exactamente cómo puedo ayudarte con este servicio. Sin compromiso.
            </p>
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-glow inline-flex items-center gap-3 bg-charcoal hover:bg-warm-brown text-cream font-bold px-10 py-4 rounded-full text-lg"
            >
              <MessageCircle size={22} />
              Hablamos por WhatsApp
            </a>
          </motion.div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </div>
  )
}
