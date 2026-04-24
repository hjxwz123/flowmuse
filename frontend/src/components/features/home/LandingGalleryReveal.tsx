'use client'

import { useEffect, useRef } from 'react'

import styles from './LandingHomePage.module.css'

type LandingGalleryRevealProps = {
  children: React.ReactNode
}

export function LandingGalleryReveal({ children }: LandingGalleryRevealProps) {
  const headerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            header.dataset.visible = 'true'
            observer.unobserve(header)
          }
        }
      },
      { root: null, rootMargin: '0px 0px -80px 0px', threshold: 0.01 },
    )

    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={headerRef} className={styles.galleryHeader}>
      {children}
    </div>
  )
}
