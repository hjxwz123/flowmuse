export type MembershipPeriod = 'monthly' | 'yearly'

export interface AdminMembershipLevel {
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

export interface CreateMembershipLevelDto {
  name: string
  nameEn?: string | null
  color: string
  monthlyPrice: number
  yearlyPrice: number
  dailyCredits?: number
  bonusPermanentCredits?: number
  benefits?: string[]
  benefitsEn?: string[]
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateMembershipLevelDto {
  name?: string
  nameEn?: string | null
  color?: string
  monthlyPrice?: number
  yearlyPrice?: number
  dailyCredits?: number
  bonusPermanentCredits?: number
  benefits?: string[]
  benefitsEn?: string[]
  sortOrder?: number
  isActive?: boolean
}

export interface AdminMembershipChatModelQuotaLevel {
  id: string
  name: string
  color: string
  isActive: boolean
}

export interface AdminMembershipChatModelQuotaItem {
  modelId: string
  modelName: string
  modelKey: string
  icon: string | null
  description: string | null
  isActive: boolean
  dailyLimit: number | null
}

export interface AdminMembershipChatModelQuotaConfig {
  level: AdminMembershipChatModelQuotaLevel
  items: AdminMembershipChatModelQuotaItem[]
}

export interface UpdateMembershipChatModelQuotasDto {
  items: Array<{
    modelId: string
    dailyLimit?: number | null
  }>
}

export interface AdminMembershipProjectQuota {
  level: {
    id: string
    name: string
    color: string
  }
  maxCount: number | null
}

export interface UpdateMembershipProjectQuotaDto {
  maxCount?: number | null
}
