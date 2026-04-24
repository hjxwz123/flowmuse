'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Crown, Sparkles } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { PurchaseGuideReason } from '@/lib/utils/purchaseGuide'

interface PurchaseGuideModalProps {
  isOpen: boolean
  reason: PurchaseGuideReason | null
  locale: string
  onClose: () => void
  onAfterNavigate?: () => void
}

export function PurchaseGuideModal({
  isOpen,
  reason,
  locale,
  onClose,
  onAfterNavigate,
}: PurchaseGuideModalProps) {
  const router = useRouter()
  const isZh = locale.toLowerCase().startsWith('zh')

  const content = useMemo(() => {
    if (reason === 'membership') {
      return {
        title: isZh ? '当前功能需要会员' : 'Membership Required',
        description: isZh
          ? '你当前还不是会员，开通会员后可继续使用该功能。'
          : 'This feature requires an active membership.',
        primaryLabel: isZh ? '去开通会员' : 'Upgrade Membership',
        badgeLabel: isZh ? '会员功能' : 'Membership Feature',
        icon: Crown,
      }
    }

    return {
      title: isZh ? '积分不足' : 'Insufficient Credits',
      description: isZh
        ? '当前积分不足，充值后即可继续生成。'
        : 'You do not have enough credits to continue.',
      primaryLabel: isZh ? '去充值购买' : 'Buy Credits',
      badgeLabel: isZh ? '积分不足' : 'Low Credits',
      icon: CreditCard,
    }
  }, [isZh, reason])

  const Icon = content.icon

  const handleGoPackages = () => {
    onClose()
    onAfterNavigate?.()
    router.push(`/${locale}/packages`)
  }

  return (
    <Modal
      isOpen={isOpen && Boolean(reason)}
      onClose={onClose}
      size="sm"
      className="max-w-lg"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              'border-aurora-purple/20 bg-aurora-purple/10 text-aurora-purple'
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="font-ui text-xs font-semibold uppercase tracking-wide text-aurora-purple">
              {content.badgeLabel}
            </p>
            <h3 className="font-display text-2xl font-semibold text-stone-900 dark:text-stone-100">
              {content.title}
            </h3>
            <p className="font-ui text-sm text-stone-600 dark:text-stone-300">
              {content.description}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-700 dark:bg-stone-900/60">
          <div className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
            <Sparkles className="h-4 w-4 text-aurora-purple" />
            <span>
              {isZh ? '前往商城后可购买积分包或会员方案。' : 'Go to the store to buy credits or a membership plan.'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {isZh ? '稍后再说' : 'Later'}
          </Button>
          <Button variant="primary" onClick={handleGoPackages}>
            {content.primaryLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
