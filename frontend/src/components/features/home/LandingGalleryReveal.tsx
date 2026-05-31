'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import styles from './LandingHomePage.module.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type LandingGalleryRevealProps = {
  children: React.ReactNode
}

export function LandingGalleryReveal({ children }: LandingGalleryRevealProps) {
  const headerRef = useRef<HTMLDivElement | null>(null)

  useGSAP(
    () => {
      const header = headerRef.current
      if (!header) return

      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(header, { autoAlpha: 1, y: 0 })
      })

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to(header, {
          autoAlpha: 1,
          y: 0,
          duration: 0.95,
          ease: 'power3.out',
          scrollTrigger: { trigger: header, start: 'top 85%', once: true },
        })
      })
    },
    { scope: headerRef },
  )

  return (
    <div ref={headerRef} className={styles.galleryHeader}>
      {children}
    </div>
  )
}
