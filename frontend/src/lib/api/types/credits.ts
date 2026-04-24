/**
 * 点数 Credits 类型定义
 */

export interface CreditBalance {
  permanentCredits: number
  membershipCredits: {
    remaining: number
    dailyLimit: number
    date: string | null
  }
  total: number
}

export interface CreditLog {
  id: string
  userId: string
  type: 'redeem' | 'consume' | 'refund' | 'admin_adjust' | 'expire'
  source: 'permanent' | 'membership'
  amount: number
  balanceAfter?: number
  balance?: number
  description: string | null
  relatedId: string | null
  createdAt: string
}

export interface CreditLogsQuery {
  type?: CreditLog['type']
  source?: CreditLog['source']
  from?: string
  to?: string
  page?: number
  pageSize?: number
}
