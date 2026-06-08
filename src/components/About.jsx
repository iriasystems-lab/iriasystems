import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

const pillars = [
  'Más de 2 años trabajando con automatización y herramientas digitales',
  'Especializada en IA aplicada a pequeños negocios y emprendedores',
  'Enfoque práctico: nada de tecnología por tecnología, solo lo que funciona',
  'Formación y acompañamiento para que seas independiente',
]

export default function About() {
  return (
    <section id="sobre-mi" className="section-dark py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Photo */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative flex justify-center lg:justify-start"
          >
            <div className="relative">
              {/* Gold frame accent */}
              <div className="absolute -inset-3 rounded-3xl border border-gold/20" />
              <div className="absolute -inset-6 rounded-3xl border border-gold/10" />

              <img
                src="/foto-iryna.jpg"
                alt="Iryna Lyovina — IRIA Systems"
                className="relative w-80 h-96 object-cover object-top rounded-2xl"
              />

              {/* Gold dot accent */}
              <div className="absolute -bottom-4 -right-4 w-8 h-8 rounded-full bg-gold opacity-80" />
              <div className="absolute -top-4 -left-4 w-4 h-4 rounded-full border-2 border-gold/50" />
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <p className="text-gold text-sm font-medium tracking-[0.25em] uppercase mb-4">
              Sobre mí
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-cream mb-6 leading-tight">
              Hola, soy Iryna.<br />
              <span className="gold-gradient">Diseño sistemas</span><br />
              que trabajan por ti.
            </h2>
            <p className="text-cream/60 text-base leading-relaxed mb-6">
              Soy una emprendedora especializada en automatización e inteligencia artificial aplicada a negocios.
              Llevo años viendo cómo pequeñas empresas y profesionales pierden horas preciosas en tareas
              repetitivas que pueden resolverse con tecnología bien diseñada.
            </p>
            <p className="text-cream/60 text-base leading-relaxed mb-8">
              Mi misión es simple: que tu negocio funcione mejor, con menos esfuerzo manual.
              No se trata de hacer más cosas — se trata de tener mejores sistemas.
            </p>

            <ul className="space-y-3 mb-10">
              {pillars.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-3 text-cream/70 text-sm"
                >
                  <CheckCircle size={18} className="text-gold mt-0.5 flex-shrink-0" />
                  {item}
                </motion.li>
              ))}
            </ul>

            <a
              href="https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gold hover:bg-gold-light text-charcoal font-bold px-8 py-4 rounded-full transition-all duration-200 hover:scale-105"
            >
              Hablamos por WhatsApp
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
