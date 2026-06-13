import { motion } from 'framer-motion'
import { MessageCircle, Instagram } from 'lucide-react'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

export default function Contact() {
  return (
    <section id="contacto" className="section-cream py-28 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-gold-dark text-sm font-medium tracking-[0.25em] uppercase mb-3">
            Hablemos
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-charcoal mb-5">
            ¿Listo para automatizar<br />tu negocio?
          </h2>
          <p className="text-warm-gray text-lg max-w-lg mx-auto mb-12">
            Cuéntame en qué punto está tu negocio y te digo exactamente cómo puedo ayudarte.
            Sin compromiso.
          </p>
        </motion.div>

        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-charcoal rounded-3xl p-10 md:p-14 mb-12 relative overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-gold/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-6">
              <MessageCircle size={32} className="text-gold" />
            </div>
            <h3 className="text-cream text-2xl md:text-3xl font-bold mb-3">
              Escríbeme por WhatsApp
            </h3>
            <p className="text-cream/50 mb-8 max-w-sm mx-auto">
              Respondo en menos de 24 horas. Cuéntame tu situación y analizamos juntos qué sistemas pueden ayudarte.
            </p>
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-glow inline-flex items-center gap-3 bg-gold hover:bg-gold-light text-charcoal font-bold px-10 py-4 rounded-full text-lg shadow-lg shadow-gold/20"
            >
              <MessageCircle size={22} />
              Escribir ahora
            </a>
          </div>
        </motion.div>

        {/* Secondary contacts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <a
            href="https://instagram.com/iriasystems"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-warm-gray hover:text-gold-dark transition-colors text-sm"
          >
            <Instagram size={16} />
            @iriasystems
          </a>
        </motion.div>
      </div>
    </section>
  )
}
