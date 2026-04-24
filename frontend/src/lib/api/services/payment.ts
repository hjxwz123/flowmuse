import { apiClient } from '../client'
import '../interceptors'
import type {
  CreateOrderResponse,
  PaymentOrderInfo,
  PaymentOrdersResponse,
  UserPaymentOrder,
} from '../types/payment'

function isPaymentOrdersResponse(value: unknown): value is PaymentOrdersResponse {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return Array.isArray(obj.data) && !!obj.pagination && typeof obj.pagination === 'object'
}

function normalizeListOrdersResponse(value: unknown): PaymentOrdersResponse {
  const withDefaultPagination = (orders: UserPaymentOrder[]): PaymentOrdersResponse => ({
    data: orders,
    pagination: {
      page: 1,
      limit: orders.length,
      total: orders.length,
      totalPages: orders.length > 0 ? 1 : 0,
      hasMore: false,
    },
  })

  // 1) 已被拦截器解包：{ data: [...], pagination: {...} }
  if (isPaymentOrdersResponse(value)) return value

  // 2) AxiosResponse 但 data 是已解包结构：{ data: { data: [...], pagination: {...} } }
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    isPaymentOrdersResponse((value as { data?: unknown }).data)
  ) {
    return (value as { data: PaymentOrdersResponse }).data
  }

  // 3) AxiosResponse + 统一包裹：{ data: { code, msg, data: { data: [...], pagination: {...} } } }
  const level1 = value && typeof value === 'object' && 'data' in value
    ? (value as { data?: unknown }).data
    : undefined
  const level2 = level1 && typeof level1 === 'object' && 'data' in (level1 as Record<string, unknown>)
    ? (level1 as { data?: unknown }).data
    : undefined
  if (isPaymentOrdersResponse(level2)) return level2

  // 4) 兼容后端直接返回数组
  if (Array.isArray(value)) return withDefaultPagination(value as UserPaymentOrder[])
  if (Array.isArray(level1)) return withDefaultPagination(level1 as UserPaymentOrder[])
  if (Array.isArray(level2)) return withDefaultPagination(level2 as UserPaymentOrder[])

  // 5) 兼容常见分页字段：items/list/records
  const candidate = (level2 ?? level1 ?? value) as Record<string, unknown> | undefined
  if (candidate && typeof candidate === 'object') {
    const listValue = (
      candidate.items ??
      candidate.list ??
      candidate.records
    )

    if (Array.isArray(listValue)) {
      const page = typeof candidate.page === 'number' ? candidate.page : 1
      const limit = typeof candidate.limit === 'number' ? candidate.limit : listValue.length
      const total = typeof candidate.total === 'number' ? candidate.total : listValue.length
      const totalPages = typeof candidate.totalPages === 'number'
        ? candidate.totalPages
        : Math.ceil(total / Math.max(limit, 1))

      return {
        data: listValue as UserPaymentOrder[],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      }
    }
  }

  throw new Error('Invalid payment orders response shape')
}

export const paymentService = {
  createOrder: async (packageId: string): Promise<CreateOrderResponse> => {
    return apiClient.post('/pay/orders', { packageId })
  },
  createCreditsOrder: async (credits: number): Promise<CreateOrderResponse> => {
    return apiClient.post('/pay/orders/credits', { credits })
  },
  createMembershipOrder: async (
    levelId: string,
    period: 'monthly' | 'yearly'
  ): Promise<CreateOrderResponse> => {
    return apiClient.post('/pay/orders/membership', { levelId, period })
  },
  getOrder: async (orderNo: string): Promise<PaymentOrderInfo> => {
    return apiClient.get(`/pay/orders/${orderNo}`)
  },
  listOrders: async (
    params?: { page?: number; limit?: number }
  ): Promise<PaymentOrdersResponse> => {
    const response = await apiClient.get('/pay/orders', { params })
    return normalizeListOrdersResponse(response)
  },
}
