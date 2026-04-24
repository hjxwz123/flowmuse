export type PaymentOrderStatus = 'pending' | 'paid' | 'failed' | 'expired'

export interface CreateOrderResponse {
  orderNo: string
  codeUrl: string      // weixin://wxpay/bizpayurl?...
  amount: number       // 分
  expireAt: string
}

export interface PaymentOrderInfo {
  orderNo: string
  status: PaymentOrderStatus
  amount: number
  paidAt: string | null
  expireAt: string
}

export interface UserPaymentOrder {
  orderNo: string
  status: PaymentOrderStatus
  orderType: string
  amount: number
  credits: number | null
  packageName: string
  membershipPeriod: 'monthly' | 'yearly' | null
  paidAt: string | null
  expireAt: string
  createdAt: string
}

export interface PaymentOrdersPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface PaymentOrdersResponse {
  data: UserPaymentOrder[]
  pagination: PaymentOrdersPagination
}
