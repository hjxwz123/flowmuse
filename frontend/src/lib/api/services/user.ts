/**
 * 用户 API 服务
 * 基于 docs/api/03-user.md
 */

import { apiClient } from '../client'
import '../interceptors'
import type {
  UserProfile,
  InviteInfo,
  UpdateProfileDto,
  UpdatePasswordDto,
  OkResponse,
} from '../types'

export const userService = {
  /**
   * 获取当前用户资料
   * GET /user/profile
   */
  getProfile: async (): Promise<UserProfile> => {
    return apiClient.get('/user/profile')
  },

  /**
   * 获取邀请码信息
   * GET /user/invite
   */
  getInviteInfo: async (): Promise<InviteInfo> => {
    return apiClient.get('/user/invite')
  },

  /**
   * 更新用户资料
   * PUT /user/profile
   */
  updateProfile: async (data: UpdateProfileDto): Promise<UserProfile> => {
    return apiClient.put('/user/profile', data)
  },

  /**
   * 上传头像
   * POST /user/avatar
   * Content-Type: multipart/form-data
   */
  uploadAvatar: async (file: File): Promise<{ id: string; avatar: string }> => {
    const formData = new FormData()
    formData.append('file', file)

    return apiClient.post('/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * 修改密码
   * PUT /user/password
   */
  updatePassword: async (data: UpdatePasswordDto): Promise<OkResponse> => {
    return apiClient.put('/user/password', data)
  },
}
