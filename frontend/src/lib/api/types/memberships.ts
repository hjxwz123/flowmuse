export type MembershipPeriod = 'monthly' | 'yearly'

export interface MembershipLevel {
  id: string
  name: string
  nameEn?: string | null
  color: string
  monthlyPrice: string
  yearlyPrice: string
  dailyCredits: number
  bonusPermanentCredits: number
  benefits: string[] | null
  benefitsEn?: string[] | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserMembershipStatus {
  isActive: boolean
  levelId: string
  levelName: string
  levelNameEn?: string | null
  color: string
  dailyCredits?: number
  expireAt: string
  daysLeft: number
}
