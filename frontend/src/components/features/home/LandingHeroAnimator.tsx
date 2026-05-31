'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import styles from './LandingHomePage.module.css'

gsap.registerPlugin(useGSAP)

type LandingHeroAnimatorProps = {
  children: React.ReactNode
}

/**
 * Owns the hero section element and runs the coordinated entrance timeline.
 *
 * The hero's inner elements ([data-hero-reveal]) keep their hidden initial
 * state in CSS (opacity:0 + offset); we removed their CSS keyframe `animation`
 * so GSAP can reveal them with `.to({ autoAlpha: 1 })`. Using `.to()` (not
 * `.from()`) is deliberate: with CSS opacity:0 as the resting value, a
 * `gsap.from()` would treat 0 as the *end* state and leave elements invisible.
 *
 * Scroll parallax on `#landing-hero-content` is handled separately by the rAF
 * system in LandingHomePageShellClient — it writes to the parent container and
 * the background layers, never to these children, so the two compose cleanly.
 */
export function LandingHeroAnimator({ children }: LandingHeroAnimatorProps) {
  const containerRef = useRef<HTMLElement | null>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-hero-reveal]', {
          autoAlpha: 1,
          y: 0,
          filter: 'none',
          clearProps: 'filter',
        })
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } })

        tl.to('[data-hero-reveal="headline"]', {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          ease: 'power4.out',
        })
          .to('[data-hero-reveal="subtitle"]', { autoAlpha: 1, y: 0, duration: 0.9 }, '-=0.85')
          .to('[data-hero-reveal="form"]', { autoAlpha: 1, y: 0, duration: 0.9 }, '-=0.7')
          .to('[data-hero-reveal="scroll"]', { autoAlpha: 1, y: 0, duration: 0.8 }, '-=0.55')
      })
    },
    { scope: containerRef },
  )

  return (
    <section ref={containerRef} className={styles.heroSection}>
      {children}
    </section>
  )
}
