export type AdminNavKey =
  | 'dashboard'
  | 'users'
  | 'tasks'
  | 'projects'
  | 'chat'
  | 'chatModeration'
  | 'gallery'
  | 'models'
  | 'templates'
  | 'tools'
  | 'announcements'
  | 'packages'
  | 'memberships'
  | 'redeemCodes'
  | 'payments'
  | 'site'
  | 'paymentConfig'
  | 'emailWhitelist'
  | 'aiConfig'
  | 'chatModelConfig'

export type AdminNavGroupId = 'operations' | 'ai' | 'content' | 'commerce' | 'settings'

export interface AdminNavItem {
  key: AdminNavKey
  href: string
}

export interface AdminNavGroup {
  id: AdminNavGroupId
  items: AdminNavItem[]
}

const ADMIN_NAV_GROUP_SEGMENTS: Array<{ id: AdminNavGroupId; items: Array<{ key: AdminNavKey; segment: string }> }> = [
  {
    id: 'operations',
    items: [
      { key: 'dashboard', segment: '/admin/dashboard' },
      { key: 'users', segment: '/admin/users' },
      { key: 'tasks', segment: '/admin/tasks' },
      { key: 'projects', segment: '/admin/projects' },
      { key: 'gallery', segment: '/admin/chat-moderation?tab=content' },
      { key: 'chat', segment: '/admin/chat' },
    ],
  },
  {
    id: 'ai',
    items: [
      { key: 'models', segment: '/admin/models' },
      { key: 'aiConfig', segment: '/admin/config/ai' },
    ],
  },
  {
    id: 'content',
    items: [
      { key: 'templates', segment: '/admin/templates' },
      { key: 'tools', segment: '/admin/tools' },
      { key: 'announcements', segment: '/admin/config/announcements' },
    ],
  },
  {
    id: 'commerce',
    items: [
      { key: 'packages', segment: '/admin/packages' },
      { key: 'memberships', segment: '/admin/memberships' },
      { key: 'redeemCodes', segment: '/admin/redeem-codes' },
      { key: 'payments', segment: '/admin/payments' },
    ],
  },
  {
    id: 'settings',
    items: [
      { key: 'site', segment: '/admin/config/site' },
      { key: 'paymentConfig', segment: '/admin/config/payment' },
      { key: 'emailWhitelist', segment: '/admin/config/email-whitelist' },
    ],
  },
]

export function buildAdminNavGroups(locale: string): AdminNavGroup[] {
  return ADMIN_NAV_GROUP_SEGMENTS.map((group) => ({
    id: group.id,
    items: group.items.map((item) => ({
      key: item.key,
      href: `/${locale}${item.segment}`,
    })),
  }))
}

export function buildAdminNavItems(locale: string): AdminNavItem[] {
  return buildAdminNavGroups(locale).flatMap((group) => group.items)
}
