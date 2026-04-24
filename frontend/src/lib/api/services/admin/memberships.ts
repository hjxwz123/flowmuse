import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminMembershipChatModelQuotaConfig,
  AdminMembershipLevel,
  AdminMembershipProjectQuota,
  CreateMembershipLevelDto,
  UpdateMembershipChatModelQuotasDto,
  UpdateMembershipLevelDto,
  UpdateMembershipProjectQuotaDto,
} from '@/lib/api/types/admin/memberships'

export const adminMembershipService = {
  getMembershipLevels: async (): Promise<AdminMembershipLevel[]> => {
    return adminApiClient.get('/memberships')
  },

  getMembershipLevel: async (id: string): Promise<AdminMembershipLevel> => {
    return adminApiClient.get(`/memberships/${id}`)
  },

  createMembershipLevel: async (dto: CreateMembershipLevelDto): Promise<AdminMembershipLevel> => {
    return adminApiClient.post('/memberships', dto)
  },

  updateMembershipLevel: async (id: string, dto: UpdateMembershipLevelDto): Promise<AdminMembershipLevel> => {
    return adminApiClient.put(`/memberships/${id}`, dto)
  },

  getMembershipChatModelQuotas: async (id: string): Promise<AdminMembershipChatModelQuotaConfig> => {
    return adminApiClient.get(`/memberships/${id}/chat-model-quotas`)
  },

  updateMembershipChatModelQuotas: async (
    id: string,
    dto: UpdateMembershipChatModelQuotasDto,
  ): Promise<AdminMembershipChatModelQuotaConfig> => {
    return adminApiClient.put(`/memberships/${id}/chat-model-quotas`, dto)
  },

  getMembershipProjectQuota: async (id: string): Promise<AdminMembershipProjectQuota> => {
    return adminApiClient.get(`/memberships/${id}/project-quota`)
  },

  updateMembershipProjectQuota: async (
    id: string,
    dto: UpdateMembershipProjectQuotaDto,
  ): Promise<AdminMembershipProjectQuota> => {
    return adminApiClient.put(`/memberships/${id}/project-quota`, dto)
  },

  deleteMembershipLevel: async (id: string): Promise<{ ok: boolean }> => {
    return adminApiClient.delete(`/memberships/${id}`)
  },
}

