/**
 * 认证相关类型定义
 * 基于 docs/api/02-auth.md
 */

import type { UserProfile } from './user'

// 注册 DTO
export interface RegisterDto {
  email: string
  password: string
  username?: string
  inviteCode?: string
  turnstileToken?: string
}

// 登录 DTO
export interface LoginDto {
  email: string
  password: string
  turnstileToken?: string
}

// 认证响应（注册/登录）
export interface LoginResponse {
  user: UserProfile
  accessToken: string
  refreshToken: string
}

export interface RegisterResponse {
  user: UserProfile
  requireEmailVerification: boolean
  verifyEmailToken?: string // 仅注册时可能返回
}

// 刷新 Token DTO
export interface RefreshTokenDto {
  refreshToken: string
}

// 刷新 Token 响应
export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

// 验证邮箱 DTO
export interface VerifyEmailDto {
  token: string
}

// 忘记密码 DTO
export interface ForgotPasswordDto {
  email: string
}

// 忘记密码响应
export interface ForgotPasswordResponse {
  ok: boolean
  resetToken?: string // 开发环境可能返回
}

// 重置密码 DTO
export interface ResetPasswordDto {
  token: string
  newPassword: string
}

// 通用成功响应
export interface OkResponse {
  ok: boolean
}
