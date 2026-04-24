import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminFreeProjectQuota,
  AdminProjectListParams,
  AdminProjectListResponse,
  UpdateFreeProjectQuotaDto,
} from '@/lib/api/types/admin/projects'

export const adminProjectService = {
  getProjects: async (params: AdminProjectListParams): Promise<AdminProjectListResponse> => {
    return adminApiClient.get('/projects', { params })
  },

  getFreeProjectQuota: async (): Promise<AdminFreeProjectQuota> => {
    return adminApiClient.get('/projects/free-quota')
  },

  updateFreeProjectQuota: async (dto: UpdateFreeProjectQuotaDto): Promise<AdminFreeProjectQuota> => {
    return adminApiClient.put('/projects/free-quota', dto)
  },
}
