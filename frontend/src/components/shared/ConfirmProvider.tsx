'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocale } from 'next-intl'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils/cn'

type ConfirmOptions = {
  title?: ReactNode
  description: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const locale = useLocale()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const resolve = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setOptions(null)
  }, [])

  const value = useMemo(() => confirm, [confirm])
  const isDanger = options?.variant === 'danger'
  const isZh = locale.toLowerCase().startsWith('zh')

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        isOpen={Boolean(options)}
        onClose={() => resolve(false)}
        title={options?.title ?? (isZh ? '确认操作' : 'Confirm')}
        size="sm"
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
            {options?.description}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => resolve(false)}>
              {options?.cancelText ?? (isZh ? '取消' : 'Cancel')}
            </Button>
            <Button
              type="button"
              variant={isDanger ? 'secondary' : 'primary'}
              onClick={() => resolve(true)}
              className={cn(
                isDanger &&
                  'border-red-200 bg-red-600 text-white shadow-none hover:border-red-300 hover:bg-red-700 dark:border-red-900/70 dark:bg-red-600 dark:text-white dark:hover:bg-red-500'
              )}
            >
              {options?.confirmText ?? (isZh ? '确认' : 'Confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return confirm
}
