/**
 * 管理后台 - 套餐管理类型定义
 */

export interface AdminPackage {
  id: string
  name: string
  nameEn?: string | null
  packageType: 'subscription' | 'credits'
  durationDays: number
  creditsPerDay: number
  totalCredits: number
  price: string // Decimal as string
  originalPrice: string | null
  description: string | null
  descriptionEn?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreatePackageDto {
  name: string
  nameEn?: string | null
  packageType?: 'subscription' | 'credits'
  durationDays: number
  creditsPerDay: number
  totalCredits: number
  price: number
  originalPrice?: number | null
  description?: string | null
  descriptionEn?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface UpdatePackageDto {
  name?: string
  nameEn?: string | null
  packageType?: 'subscription' | 'credits'
  durationDays?: number
  creditsPerDay?: number
  totalCredits?: number
  price?: number
  originalPrice?: number | null
  description?: string | null
  descriptionEn?: string | null
  sortOrder?: number
  isActive?: boolean
}
