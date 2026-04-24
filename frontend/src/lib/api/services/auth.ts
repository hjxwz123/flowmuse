/**
 * 认证 API 服务
 * 基于 docs/api/02-auth.md
 */

import { apiClient } from '../client'
import '../interceptors' // 确保拦截器被加载
import type {
  RegisterDto,
  LoginDto,
  RegisterResponse,
  LoginResponse,
  RefreshTokenDto,
  RefreshTokenResponse,
  VerifyEmailDto,
  ForgotPasswordDto,
  ForgotPasswordResponse,
  ResetPasswordDto,
  OkResponse,
} from '../types'

export const authService = {
  /**
   * 注册
   * POST /auth/register
   */
  register: async (data: RegisterDto): Promise<RegisterResponse> => {
    return apiClient.post('/auth/register', data)
  },

  /**
   * 登录
   * POST /auth/login
   */
  login: async (data: LoginDto): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', data)
  },

  /**
   * 刷新 Token
   * POST /auth/refresh-token
   */
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    return apiClient.post('/auth/refresh-token', { refreshToken })
  },

  /**
   * 验证邮箱
   * POST /auth/verify-email
   */
  verifyEmail: async (token: string): Promise<OkResponse> => {
    return apiClient.post('/auth/verify-email', { token })
  },

  /**
   * 忘记密码（发送重置邮件）
   * POST /auth/forgot-password
   */
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    return apiClient.post('/auth/forgot-password', { email })
  },

  /**
   * 重置密码
   * POST /auth/reset-password
   */
  resetPassword: async (data: ResetPasswordDto): Promise<OkResponse> => {
    return apiClient.post('/auth/reset-password', data)
  },
}
