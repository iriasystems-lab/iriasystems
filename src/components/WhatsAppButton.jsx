import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

const WA_URL = 'https://wa.me/34643380805?text=Hola%20Iryna%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20tus%20servicios'

export default function WhatsAppButton() {
  return (
    <motion.a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2, duration: 0.4, type: 'spring' }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold shadow-lg shadow-gold/30 flex items-center justify-center group"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={26} className="text-charcoal" />

      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-gold animate-ping opacity-20" />

      {/* Tooltip */}
      <span className="absolute right-16 bg-charcoal text-cream text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        ¿Hablamos?
      </span>
    </motion.a>
  )
}
