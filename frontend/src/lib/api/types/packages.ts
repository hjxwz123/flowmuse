/**
 * 套餐 Packages 类型定义
 * 基于 docs/api/04-packages.md
 */

export interface Package {
  id: string
  name: string
  nameEn?: string | null
  packageType: 'subscription' | 'credits'
  durationDays: number
  creditsPerDay: number
  totalCredits: number
  price: string
  originalPrice: string | null
  description: string | null
  descriptionEn?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PackagesQuery {
  activeOnly?: boolean
  sort?: 'price' | 'sort'
}
