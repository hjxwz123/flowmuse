'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { adminSiteService } from '@/lib/api/services/admin/site'
import type { EmailWhitelistSettings } from '@/lib/api/types/admin/site'
import { toast } from 'sonner'
import { Plus, X, Mail, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminEmailWhitelistPage() {
  const [settings, setSettings] = useState<EmailWhitelistSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [enabled, setEnabled] = useState(false)
  const [domains, setDomains] = useState<string[]>([])
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await adminSiteService.getEmailWhitelist()
      setSettings(data)
      setEnabled(data.enabled)
      setDomains(data.domains)
    } catch (error) {
      console.error('Failed to load email whitelist settings:', error)
      toast.error('加载邮箱白名单设置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) {
      toast.error('请输入域名')
      return
    }
    // 验证域名格式
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i
    if (!domainRegex.test(domain)) {
      toast.error('请输入有效的域名格式，如 example.com')
      return
    }
    if (domains.includes(domain)) {
      toast.error('该域名已存在')
      return
    }
    setDomains([...domains, domain])
    setNewDomain('')
  }

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      const updatedSettings = await adminSiteService.updateEmailWhitelist({
        enabled,
        domains,
      })
      setSettings(updatedSettings)
      toast.success('邮箱白名单设置已保存')
    } catch (error) {
      console.error('Failed to save email whitelist settings:', error)
      toast.error('保存邮箱白名单设置失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <AdminPageLoading text="加载邮箱白名单中..." />
  }

  return (
    <AdminPageShell
      title="邮箱域名白名单"
      description="限制只有特定邮箱域名的用户才能注册"
      maxWidthClassName="max-w-5xl"
    >
      <form onSubmit={handleSubmit}>
        <Card className="space-y-6 border border-stone-200 !bg-white p-6 !shadow-sm">
          {/* 启用开关 */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-stone-50 border border-stone-200">
            <div className="p-2 rounded-lg bg-aurora-purple/10">
              <Shield className="w-6 h-6 text-aurora-purple" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-stone-900">启用邮箱域名白名单</h3>
                  <p className="text-sm text-stone-600 mt-1">
                    开启后，只有邮箱后缀在白名单中的用户才能注册
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 rounded-full transition-colors",
                    "peer-focus:ring-4 peer-focus:ring-aurora-purple/20",
                    enabled ? "bg-aurora-purple" : "bg-stone-300"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                      enabled ? "translate-x-5" : "translate-x-0"
                    )} />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 域名列表 */}
          <div className={cn(!enabled && "opacity-50 pointer-events-none")}>
            <h2 className="text-lg font-semibold text-stone-900 mb-4">
              <Mail className="w-5 h-5 inline-block mr-2 text-stone-500" />
              允许的邮箱域名
            </h2>

            {/* 添加域名 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddDomain()
                  }
                }}
                placeholder="输入域名，如 gmail.com"
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-aurora-purple focus:border-transparent"
              />
              <Button
                type="button"
                onClick={handleAddDomain}
                className="px-4 py-2 bg-aurora-purple text-white rounded-lg hover:bg-aurora-purple/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>

            {/* 域名列表 */}
            {domains.length === 0 ? (
              <div className="text-center py-8 text-stone-500 border border-dashed border-stone-300 rounded-lg">
                <Mail className="w-12 h-12 mx-auto mb-2 text-stone-300" />
                <p>暂无白名单域名</p>
                <p className="text-sm mt-1">
                  {enabled ? '添加域名后，只有这些域名的邮箱才能注册' : '启用白名单后可添加域名'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {domains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-aurora-purple/10 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-aurora-purple" />
                      </div>
                      <span className="font-mono text-stone-900">@{domain}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(domain)}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 提示信息 */}
            {enabled && domains.length > 0 && (
              <p className="text-sm text-stone-500 mt-4">
                当前允许 {domains.length} 个域名注册，例如：user@{domains[0]}
              </p>
            )}
          </div>

          {/* 保存按钮 */}
          <div className="pt-6 border-t border-stone-200">
            <Button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-aurora-purple text-white rounded-lg hover:bg-aurora-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </Card>
      </form>
    </AdminPageShell>
  )
}
