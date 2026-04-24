import { apiClient } from '../client'
import '../interceptors'
import type { MembershipLevel, UserMembershipStatus } from '../types/memberships'

export const membershipService = {
  getLevels: async (): Promise<MembershipLevel[]> => {
    return apiClient.get('/memberships/levels')
  },

  getMyMembership: async (): Promise<UserMembershipStatus | null> => {
    return apiClient.get('/memberships/me')
  },
}

