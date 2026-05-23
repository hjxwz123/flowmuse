'use client'

import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { Loading } from '@/components/ui/Loading'

import { AdminHeader } from './AdminHeader'

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthorized } = useAdminAuth()

  if (!isAuthorized) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-950 dark:to-stone-900">
        <Loading />
      </div>
    )
  }

  return (
    <div className="admin-theme flex min-h-screen flex-col">
      <AdminHeader />
      <main className="flex-1 bg-gradient-to-br from-stone-50 via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-950 dark:to-stone-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
