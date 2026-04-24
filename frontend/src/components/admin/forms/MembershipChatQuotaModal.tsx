'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { adminMembershipService } from '@/lib/api/services/admin/memberships'
import type {
  AdminMembershipChatModelQuotaConfig,
  AdminMembershipLevel,
} from '@/lib/api/types/admin/memberships'
import { cn } from '@/lib/utils/cn'

interface MembershipChatQuotaModalProps {
  isOpen: boolean
  level?: AdminMembershipLevel
  onClose: () => void
}

function renderIcon(icon: string | null, label: string) {
  if (!icon) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400">
        AI
      </div>
    )
  }

  if (icon.startsWith('http') || icon.startsWith('data:image')) {
    return (
      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt={label} className="h-full w-full object-contain" />
      </div>
    )
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-base leading-none text-stone-700">
      {icon}
    </div>
  )
}

export function MembershipChatQuotaModal({
  isOpen,
  level,
  onClose,
}: MembershipChatQuotaModalProps) {
  const [config, setConfig] = useState<AdminMembershipChatModelQuotaConfig | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [projectMaxCount, setProjectMaxCount] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !level) return

    const load = async () => {
      try {
        setLoading(true)
        setConfig(null)
        setDrafts({})
        setProjectMaxCount('')
        const [result, projectQuota] = await Promise.all([
          adminMembershipService.getMembershipChatModelQuotas(level.id),
          adminMembershipService.getMembershipProjectQuota(level.id),
        ])
        setConfig(result)
        setDrafts(
          result.items.reduce<Record<string, string>>((accumulator, item) => {
            accumulator[item.modelId] =
              item.dailyLimit === null || item.dailyLimit === undefined ? '' : String(item.dailyLimit)
            return accumulator
          }, {}),
        )
        setProjectMaxCount(
          projectQuota.maxCount === null || projectQuota.maxCount === undefined
            ? ''
            : String(projectQuota.maxCount),
        )
      } catch (error) {
        console.error('Failed to load membership chat model quotas:', error)
        toast.error('加载会员模型额度失败')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [isOpen, level])

  const items = useMemo(() => config?.items ?? [], [config])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSave = async () => {
    if (!level) return

    const payloadItems = items.map((item) => {
      const raw = (drafts[item.modelId] ?? '').trim()
      if (!raw) {
        return {
          modelId: item.modelId,
          dailyLimit: null,
        }
      }

      const parsed = Number(raw)
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`模型「${item.modelName}」的每日额度必须是非负整数`)
      }

      return {
        modelId: item.modelId,
        dailyLimit: parsed,
      }
    })

    try {
      setSaving(true)

      // Save project quota
      const projectMaxRaw = projectMaxCount.trim()
      await adminMembershipService.updateMembershipProjectQuota(level.id, {
        maxCount: projectMaxRaw ? Number(projectMaxRaw) : null,
      })

      // Save chat model quotas
      const updated = await adminMembershipService.updateMembershipChatModelQuotas(level.id, {
        items: payloadItems,
      })
      setConfig(updated)
      setDrafts(
        updated.items.reduce<Record<string, string>>((accumulator, item) => {
          accumulator[item.modelId] =
            item.dailyLimit === null || item.dailyLimit === undefined ? '' : String(item.dailyLimit)
          return accumulator
        }, {}),
      )
      toast.success('会员模型额度已保存')
      onClose()
    } catch (error) {
      const maybeMessage = (
        error as { response?: { data?: { message?: string | string[] } } }
      )?.response?.data?.message
      const message = Array.isArray(maybeMessage) ? maybeMessage.join('；') : maybeMessage
      toast.error(message || (error instanceof Error ? error.message : '保存会员模型额度失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={level ? `${level.name} 模型权限` : '模型权限'}
      size="xl"
    >
      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-aurora-purple" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-600">
            留空表示不限制。
          </div>

          {/* Project Quota */}
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-base leading-none text-stone-700">
                  📁
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-stone-900">可创建项目数量</p>
                  <p className="text-sm leading-6 text-stone-600">限制该会员等级可创建的最大项目数量</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">上限</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={projectMaxCount}
                  onChange={(event) => setProjectMaxCount(event.target.value)}
                  className={cn(
                    'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900',
                    'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                  )}
                  placeholder="不限"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-600">
            以下为模型每日使用额度配置，留空表示不限制。
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.modelId}
                className="grid gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4 md:grid-cols-[minmax(0,1fr)_160px]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  {renderIcon(item.icon, item.modelName)}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-stone-900">{item.modelName}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-stone-100 text-stone-500'
                        )}
                      >
                        {item.isActive ? '启用' : '禁用'}
                      </span>
                    </div>
                    <p className="truncate font-mono text-xs text-stone-500">{item.modelKey}</p>
                    {item.description ? (
                      <p className="text-sm leading-6 text-stone-600">{item.description}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-stone-700">每日额度</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={drafts[item.modelId] ?? ''}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.modelId]: event.target.value,
                      }))
                    }
                    className={cn(
                      'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900',
                      'focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
                    )}
                    placeholder="不限"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleSave()} isLoading={saving}>
              保存权限
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
