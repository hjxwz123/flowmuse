export interface AdminProjectItem {
  id: string
  name: string
  concept: string
  description: string
  assetCount: number
  inspirationCount: number
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    username: string | null
    avatar: string | null
  }
}

export interface AdminProjectListResponse {
  items: AdminProjectItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface AdminProjectListParams {
  userId?: string
  q?: string
  page?: number
  limit?: number
}

export interface AdminFreeProjectQuota {
  maxCount: number
}

export interface UpdateFreeProjectQuotaDto {
  maxCount?: number | null
}
