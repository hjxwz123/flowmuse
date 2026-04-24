import Link from 'next/link'

import { LandingExploreGalleryButton } from './LandingExploreGalleryButton'
import { LandingGalleryReveal } from './LandingGalleryReveal'
import { LandingHeroForm } from './LandingHeroForm'
import { LandingHomePageShellClient } from './LandingHomePageShellClient'
import { LandingModelShowcase } from './LandingModelShowcase'
import { LandingPublicGalleryClient } from './LandingPublicGalleryClient'
import { LandingTopBarClient } from './LandingTopBarClient'
import {
  HOME_HERO_IMAGE_BACKGROUNDS,
  HOME_HERO_VIDEO_BACKGROUND,
  getLandingHomeCopy,
} from './landingHomePage.shared'
import styles from './LandingHomePage.module.css'
import type { ApiTask } from '@/lib/api/types'

export type LandingHomePageProps = {
  locale: string
  registrationEnabled: boolean
  siteTitle: string
  siteIcon: string
  siteFooter: string
  marqueeText?: string
  homeHeroImageUrls?: string
  homeHeroVideoUrl?: string
  initialGalleryItems: ApiTask[]
  initialGalleryPage: number
  initialGalleryHasMore: boolean
}

export function LandingHomePage({
  locale,
  registrationEnabled,
  siteTitle,
  siteIcon,
  siteFooter,
  homeHeroImageUrls,
  homeHeroVideoUrl,
  initialGalleryItems,
  initialGalleryPage,
  initialGalleryHasMore,
}: LandingHomePageProps) {
  const copy = getLandingHomeCopy(locale)
  const currentYear = new Date().getFullYear()
  const footerText = siteFooter.trim() || `© ${currentYear} ${siteTitle}`
  const configuredBackgroundImages = (homeHeroImageUrls || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
  const backgroundImages = configuredBackgroundImages.length > 0
    ? configuredBackgroundImages
    : HOME_HERO_IMAGE_BACKGROUNDS.filter((item) => item.trim().length > 0)
  const backgroundVideo = (homeHeroVideoUrl?.trim() || HOME_HERO_VIDEO_BACKGROUND).trim()

  return (
    <LandingHomePageShellClient
      backgroundImages={backgroundImages}
      backgroundVideo={backgroundVideo}
    >
      <LandingTopBarClient
        locale={locale}
        registrationEnabled={registrationEnabled}
        siteTitle={siteTitle}
        siteIcon={siteIcon}
        copy={copy}
      />

      <section className={styles.heroSection}>
        <div id="landing-hero-content" className={styles.heroContent}>
          <div className={styles.textContent}>
            <h1 className={styles.headline} data-text={copy.title}>
              {copy.title}
            </h1>
            <p className={styles.subHeadline}>{copy.subtitle}</p>
          </div>

          <LandingHeroForm locale={locale} copy={copy} />
        </div>

        <LandingExploreGalleryButton label={copy.exploreGallery} />
      </section>

      <LandingModelShowcase locale={locale} />

      <section id="landing-public-gallery" className={styles.gallerySection}>
        <LandingGalleryReveal>
          <h2 className={styles.galleryTitle}>{copy.galleryTitle}</h2>
        </LandingGalleryReveal>

        <LandingPublicGalleryClient
          locale={locale}
          initialGalleryItems={initialGalleryItems}
          initialGalleryPage={initialGalleryPage}
          initialGalleryHasMore={initialGalleryHasMore}
          copy={copy}
        />
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLinks}>
            <Link href={`/${locale}/about`}>{copy.about}</Link>
            <Link href={`/${locale}/privacy`}>{copy.privacy}</Link>
            <Link href={`/${locale}/terms`}>{copy.terms}</Link>
          </div>
          <p className={styles.footerCopy}>{footerText}</p>
        </div>
      </footer>
    </LandingHomePageShellClient>
  )
}
