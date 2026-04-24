export interface Tool {
  id: string
  title: string
  description?: string
  notes?: string
  coverUrl?: string
  prompt: string
  type: 'image' | 'video'
  modelId: string
  modelName: string
  modelProvider: string
  modelKey: string
  creditsPerUse: number
  imageCount: number
  imageLabels?: string[]
  parameters?: Record<string, unknown>
  category?: string
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export interface CreateToolRequest {
  title: string
  description?: string
  notes?: string
  coverUrl?: string
  prompt: string
  type: 'image' | 'video'
  modelId: string
  imageCount?: number
  imageLabels?: string[]
  parameters?: Record<string, unknown>
  category?: string
  isActive?: boolean
  sortOrder?: number
}

export interface ToolQueryParams {
  type?: 'image' | 'video'
  category?: string
}
