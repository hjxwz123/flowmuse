import { apiClient } from '../client'
import '../interceptors'
import type { PaginatedResult, PaginationParams } from '../types/pagination'
import type { ApiResearchTask, CreateResearchTaskDto } from '../types/research'
import type { TaskStatus } from '../types/common'

export const researchService = {
  async createTask(data: CreateResearchTaskDto): Promise<ApiResearchTask> {
    return apiClient.post('/research/tasks', data)
  },

  async getTasks(
    params?: PaginationParams & { status?: TaskStatus }
  ): Promise<PaginatedResult<ApiResearchTask>> {
    return apiClient.get('/research/tasks', { params })
  },

  async getTask(id: string): Promise<ApiResearchTask> {
    return apiClient.get(`/research/tasks/${id}`)
  },

  async deleteTask(id: string): Promise<{ ok: boolean }> {
    return apiClient.delete(`/research/tasks/${id}`)
  },
}
