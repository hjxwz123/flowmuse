'use client'

import dynamic from 'next/dynamic'

import type { LandingTopBarProps } from './LandingTopBar'

const LandingTopBar = dynamic<LandingTopBarProps>(
  () => import('./LandingTopBar').then((mod) => mod.LandingTopBar),
  { ssr: false }
)

export function LandingTopBarClient(props: LandingTopBarProps) {
  return <LandingTopBar {...props} />
}
