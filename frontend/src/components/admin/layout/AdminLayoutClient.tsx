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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100">
        <Loading />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <main className="flex-1 bg-gradient-to-br from-stone-50 via-white to-stone-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
