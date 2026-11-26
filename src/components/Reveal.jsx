import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'

export function Reveal({ children, ...props }) {
  const reduceMotion = useReducedMotion()

  return (
    <m.section
      {...props}
      initial={reduceMotion ? false : { y: 12, opacity: 0.92 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 'some' }}
      transition={{ duration: reduceMotion ? 0 : 0.44, ease: 'easeOut' }}
    >
      {children}
    </m.section>
  )
}
