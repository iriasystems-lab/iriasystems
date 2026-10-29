import { Helmet } from 'react-helmet-async'
import { MessageCircle, Mail, Send, Clock } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import WhatsAppButton from '../components/WhatsAppButton'
import { useReveal, useRevealChildren } from '../hooks/useReveal'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

const channels = [
  { icon: MessageCircle, title: 'WhatsApp', desc: 'La forma más rápida de contactarme. Respondo en pocas horas.', cta: 'Escribir por WhatsApp', href: WA_URL, highlight: true },
  { icon: Mail,          title: 'Email',    desc: 'Para consultas más detalladas o enviar documentación.',        cta: 'Enviar email',          href: 'mailto:hola@iriasystems.com', highlight: false },
  { icon: Send,          title: 'Telegram', desc: 'También puedes encontrarme en Telegram para consultas rápidas.', cta: 'Ir a Telegram',       href: 'https://t.me/iriasystems', highlight: false },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  '@id': 'https://iriasystems.com/contacto',
  name: 'Contacto — IRIA Systems',
  url: 'https://iriasystems.com/contacto',
  description: 'Contacta con Iryna Lyovina de IRIA Systems para automatización, IA y consultoría.',
  mainEntity: {
    '@type': 'Organization',
    name: 'IRIA Systems',
    url: 'https://iriasystems.com',
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', availableLanguage: ['Spanish', 'English', 'Russian'] },
  },
}

export default function Contacto() {
  const heroRef     = useReveal()
  const badgeRef    = useReveal()
  const channelsRef = useRevealChildren(80)
  const faqHeaderRef = useReveal()
  const faqListRef  = useRevealChildren(80)

  return (
    <>
      <Helmet>
        <title>Contacto — IRIA Systems | Automatización e Inteligencia Artificial</title>
        <meta name="description" content="Contacta con Iryna Lyovina de IRIA Systems. Cuéntame tu proyecto y te digo cómo puedo ayudarte con automatización, agentes IA o consultoría. Sin compromiso." />
        <link rel="canonical" href="https://iriasystems.com/contacto" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://iriasystems.com/contacto" />
        <meta property="og:title" content="Contacto — IRIA Systems" />
        <meta property="og:description" content="Cuéntame tu proyecto y te digo cómo puedo ayudarte con automatización e IA." />
        <meta property="og:image" content="https://iriasystems.com/foto-iryna.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Navbar />

      <main className="section-dark min-h-screen">

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-32 pb-20 text-center">
          <div ref={heroRef} className="reveal">
            <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-4">Contacto</p>
            <h1 className="text-4xl md:text-6xl font-bold text-cream mb-6 leading-tight">
              Hablemos de tu <span className="gold-gradient">proyecto</span>
            </h1>
            <p className="text-cream/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Cuéntame qué necesitas y te digo exactamente cómo puedo ayudarte. Sin tecnicismos, sin compromiso.
            </p>
          </div>
        </section>

        {/* Badge */}
        <div ref={badgeRef} className="reveal max-w-xl mx-auto px-6 mb-16">
          <div className="flex items-center gap-3 justify-center bg-gold/10 border border-gold/20 rounded-full px-6 py-3">
            <Clock size={16} className="text-gold" />
            <span className="text-gold/80 text-sm">Respondo en menos de 24h en días laborables</span>
          </div>
        </div>

        {/* Channels */}
        <section className="max-w-5xl mx-auto px-6 pb-28">
          <div ref={channelsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {channels.map((ch) => {
              const CIcon = ch.icon
              return (
                <div key={ch.title} className={`reveal card-glow rounded-2xl border p-8 flex flex-col items-center text-center gap-5 ${ch.highlight ? 'border-gold/50 bg-gold/5' : 'border-white/10 bg-white/[0.03]'}`}>
                  {ch.highlight && (
                    <span className="inline-block bg-gold text-charcoal text-xs font-bold px-3 py-1 rounded-full">Recomendado</span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <CIcon size={26} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="text-cream font-bold text-xl mb-2">{ch.title}</h2>
                    <p className="text-cream/55 text-sm leading-relaxed">{ch.desc}</p>
                  </div>
                  <a href={ch.href} target="_blank" rel="noopener noreferrer"
                    className={`btn-glow mt-auto inline-flex items-center gap-2 font-bold px-7 py-3 rounded-full transition-colors ${ch.highlight ? 'bg-gold hover:bg-gold-light text-charcoal' : 'border border-gold/30 text-gold hover:bg-gold/10'}`}>
                    <CIcon size={16} />
                    {ch.cta}
                  </a>
                </div>
              )
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-charcoal/50 border-t border-gold/10 py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div ref={faqHeaderRef} className="reveal mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-cream">¿Qué pasa cuando me escribes?</h2>
            </div>
            <div ref={faqListRef} className="space-y-4 text-left">
              {[
                ['1. Me cuentas tu situación', 'Dime qué tareas te roban tiempo o qué quieres automatizar. No hace falta que sepas nada de tecnología.'],
                ['2. Te digo cómo puedo ayudarte', 'En 24h te respondo con una propuesta clara de qué podemos hacer y qué resultados puedes esperar.'],
                ['3. Empezamos si te encaja', 'Sin contratos complicados. Empezamos con un proyecto pequeño y escalamos si los resultados te convencen.'],
              ].map(([title, desc]) => (
                <div key={title} className="reveal card-glow border border-white/10 bg-white/[0.02] rounded-2xl p-6">
                  <p className="text-gold font-semibold mb-1">{title}</p>
                  <p className="text-cream/60 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <WhatsAppButton />
    </>
  )
}
