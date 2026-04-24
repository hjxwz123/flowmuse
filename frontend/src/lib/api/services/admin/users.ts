/**
 * 管理员 - 用户管理 API 服务
 */

import { adminApiClient } from '@/lib/api/adminClient'
import type {
  AdminUserListResponse,
  AdminUserDetail,
  UserFilterParams,
  UpdateUserStatusDto,
  AdjustCreditsDto,
  GrantMembershipDto,
  GrantMembershipResult,
  SendUserMessageDto,
  UserCreationListResponse,
  PaginatedResponse,
  CreditTransaction,
  DeleteAdminUserResult,
} from '@/lib/api/types/admin/users'

export const adminUserService = {
  /**
   * 获取用户列表
   */
  getUsers: async (
    params?: UserFilterParams
  ): Promise<AdminUserListResponse> => {
    return adminApiClient.get('/users', { params })
  },

  /**
   * 获取用户详情
   */
  getUserDetail: async (id: string): Promise<AdminUserDetail> => {
    return adminApiClient.get(`/users/${id}`)
  },

  /**
   * 更新用户状态（启用/禁用）
   */
  updateUserStatus: async (
    id: string,
    dto: UpdateUserStatusDto
  ): Promise<void> => {
    return adminApiClient.put(`/users/${id}/status`, dto)
  },

  /**
   * 调整用户点数
   */
  adjustCredits: async (id: string, dto: AdjustCreditsDto): Promise<void> => {
    return adminApiClient.post(`/users/${id}/credits`, dto)
  },

  /**
   * 管理员手动开通会员
   */
  grantMembership: async (
    id: string,
    dto: GrantMembershipDto
  ): Promise<GrantMembershipResult> => {
    return adminApiClient.post(`/users/${id}/membership`, dto)
  },

  /**
   * 给指定用户发送站内消息（支持 HTML）
   */
  sendCustomMessage: async (id: string, dto: SendUserMessageDto): Promise<{ ok: boolean }> => {
    return adminApiClient.post(`/users/${id}/messages`, dto)
  },

  /**
   * 永久删除用户及其关联内容
   */
  deleteUser: async (id: string): Promise<DeleteAdminUserResult> => {
    return adminApiClient.delete(`/users/${id}`)
  },

  /**
   * 获取用户点数交易记录
   */
  getCreditTransactions: async (
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<CreditTransaction>> => {
    return adminApiClient.get(`/users/${userId}/credits/transactions`, {
      params: { page, pageSize },
    })
  },

  /**
   * 获取用户创作历史
   */
  getUserCreations: async (
    userId: string,
    page = 1,
    pageSize = 20
  ): Promise<UserCreationListResponse> => {
    return adminApiClient.get(`/users/${userId}/creations`, {
      params: { page, pageSize },
    })
  },

  /**
   * 批量更新用户状态
   */
  batchUpdateStatus: async (
    userIds: string[],
    status: 'active' | 'banned'
  ): Promise<void> => {
    return adminApiClient.post('/users/batch/status', { userIds, status })
  },

  /**
   * 导出用户列表
   */
  exportUsers: async (params?: UserFilterParams): Promise<Blob> => {
    const response = await adminApiClient.get('/users/export', {
      params,
      responseType: 'blob',
    })
    return response as unknown as Blob
  },
}
