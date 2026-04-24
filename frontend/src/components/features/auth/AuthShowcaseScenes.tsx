'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

import styles from './AuthExperience.module.css'

export function AuthShowcaseScenes() {
  const [activeScene, setActiveScene] = useState(0)

  useEffect(() => {
    setActiveScene(Math.floor(Math.random() * 3))
  }, [])

  return (
    <div className={cn(styles.showcaseInner, styles.sceneShowcase)} aria-hidden="true">
      <div className={cn(styles.animScene, activeScene === 0 && styles.animSceneActive)}>
        <div className={styles.quantumCore}>
          <div className={styles.qcOrb} />
          <div className={cn(styles.qcRing, styles.qcRing1)}>
            <div className={cn(styles.qcParticle, styles.qcParticleOne)} />
          </div>
          <div className={cn(styles.qcRing, styles.qcRing2)}>
            <div className={cn(styles.qcParticle, styles.qcParticleTwo)} />
          </div>
          <div className={cn(styles.qcRing, styles.qcRing3)} />
        </div>
      </div>

      <div className={cn(styles.animScene, activeScene === 1 && styles.animSceneActive)}>
        <div className={styles.digitalIris}>
          <div className={styles.irisScanner} />
          <div className={cn(styles.irisRing, styles.irisRing1)} />
          <div className={cn(styles.irisRing, styles.irisRing2)} />
          <div className={cn(styles.irisRing, styles.irisRing3)} />
          <div className={styles.irisPupil} />
        </div>
      </div>

      <div className={cn(styles.animScene, activeScene === 2 && styles.animSceneActive)}>
        <div className={styles.neuralPortal}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className={styles.portalRing} />
          ))}
        </div>
      </div>
    </div>
  )
}
