/**
 * 管理员 - 任务管理 API 服务
 * 使用统一任务 API（路径：/api/tasks，需要 admin 权限）
 */

import { apiClient } from '@/lib/api/client'
import type {
  ApiTask,
  TaskListResponse,
  TaskFilterParams,
  TaskStats,
  TaskDetailResponse,
  RetryTaskDto,
  CancelTaskDto,
  BatchUpdateTaskStatusDto,
  BatchDeleteTaskDto,
  BatchOperationResponse,
} from '@/lib/api/types/admin/tasks'

export const adminTaskService = {
  /**
   * 获取任务列表（支持分页和筛选）
   */
  getTasks: async (params?: TaskFilterParams): Promise<TaskListResponse> => {
    return apiClient.get('/tasks', { params })
  },

  /**
   * 获取任务统计（支持筛选）
   */
  getTaskStats: async (params?: TaskFilterParams): Promise<TaskStats> => {
    return apiClient.get('/tasks/stats', { params })
  },

  /**
   * 获取任务详情（包含用户、模型、渠道信息）
   */
  getTaskDetail: async (id: string, type?: 'image' | 'video' | 'research'): Promise<TaskDetailResponse> => {
    return apiClient.get(`/tasks/${id}`, { params: type ? { type } : undefined })
  },

  /**
   * 重试任务
   */
  retryTask: async (id: string, dto?: RetryTaskDto): Promise<ApiTask> => {
    return apiClient.post(`/tasks/${id}/retry`, dto || {})
  },

  /**
   * 取消任务（会自动退还点数）
   */
  cancelTask: async (id: string, dto?: CancelTaskDto): Promise<ApiTask> => {
    return apiClient.post(`/tasks/${id}/cancel`, dto || {})
  },

  /**
   * 删除任务（仅允许删除非运行中任务）
   */
  deleteTask: async (id: string, type?: 'image' | 'video' | 'research'): Promise<{ ok: boolean }> => {
    return apiClient.delete(`/tasks/${id}`, { params: type ? { type } : undefined })
  },

  /**
   * 批量更新任务状态
   */
  batchUpdateStatus: async (dto: BatchUpdateTaskStatusDto): Promise<BatchOperationResponse> => {
    return apiClient.post('/tasks/batch/status', dto)
  },

  /**
   * 批量删除任务
   */
  batchDelete: async (dto: BatchDeleteTaskDto): Promise<BatchOperationResponse> => {
    return apiClient.post('/tasks/batch/delete', dto)
  },
}
