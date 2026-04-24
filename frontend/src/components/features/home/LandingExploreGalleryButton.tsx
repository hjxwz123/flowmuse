'use client'

import { useLandingHomePageShell } from './LandingHomePageShellClient'
import styles from './LandingHomePage.module.css'

type LandingExploreGalleryButtonProps = {
  label: string
}

export function LandingExploreGalleryButton({ label }: LandingExploreGalleryButtonProps) {
  const { scrollToGallery } = useLandingHomePageShell()

  return (
    <button type="button" className={styles.scrollIndicator} onClick={scrollToGallery}>
      <span>{label}</span>
      <span className={styles.scrollLine} />
    </button>
  )
}
