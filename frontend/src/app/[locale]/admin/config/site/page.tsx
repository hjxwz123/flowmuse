'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { adminSiteService } from '@/lib/api/services/admin/site'
import { adminAiService, type ChatModerationAutoBanRule } from '@/lib/api/services/admin/ai'
import type { SiteSettings } from '@/lib/api/types/admin/site'
import { toast } from 'sonner'

const sectionTitleCls = 'mb-4 flex items-center gap-2 text-lg font-semibold text-stone-900'
const sectionAccentCls = 'inline-block h-5 w-1 rounded-full bg-aurora-purple'
const labelCls = 'mb-2 block text-sm font-medium text-stone-700'
const helpTextCls = 'mt-1 text-xs text-stone-500'
const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
const textareaCls = `${inputCls} resize-y`
const monoTextareaCls = `${textareaCls} font-mono`
const selectCls =
  'w-full appearance-none rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 transition-colors focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
const switchCardCls = 'flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4'
const DEFAULT_AUTO_BAN_RULE: ChatModerationAutoBanRule = {
  triggerCount: 3,
  banDays: 1,
}
const DEFAULT_SITE_FORM_DATA = {
  registrationEnabled: true,
  initialRegisterCredits: 10,
  inviteRegisterInviterCredits: 0,
  inviteRegisterInviteeCredits: 0,
  invitePaymentCreditsPerYuan: 1,
  siteTitle: '',
  siteIcon: '',
  siteFooter: '',
  homeTopMarqueeText: '',
  homeHeroImageUrls: '',
  homeHeroVideoUrl: '',
  startupPopupType: 'image' as 'image' | 'html',
  startupPopupImageUrl: '',
  startupPopupHtml: '',
  startupPopupTargetUrl: '',
  startupPopupWidthPx: 720,
  startupPopupHeightPx: 0,
  cardPurchaseUrl: '',
  aboutUs: '',
  privacyPolicy: '',
  termsOfService: '',
  themeColor: '',
  turnstileEnabled: false,
  turnstileSiteKey: '',
  turnstileSecretKey: '',
  wechatPayEnabled: false,
  creditBuyEnabled: false,
  creditBuyRatePerYuan: 100,
  creditBuyMinCredits: 100,
  creditBuyMaxCredits: 100000,
  chatFileUploadEnabled: true,
  chatFileMaxFilesPerMessage: 5,
  chatFileMaxFileSizeMb: 20,
  chatFileAllowedExtensions: 'txt,md,csv,json,html,pdf,docx,pptx,xlsx',
  chatFileMaxExtractChars: 120000,
  chatFileContextMode: 'retrieval' as 'full' | 'retrieval',
  chatFileRetrievalTopK: 6,
  chatFileChunkSize: 1200,
  chatFileChunkOverlap: 180,
  chatFileRetrievalMaxChars: 10000,
  webSearchEnabled: false,
  webSearchBaseUrl: '',
  webSearchMode: 'off' as 'off' | 'auto' | 'always',
  webSearchLanguage: 'zh-CN',
  webSearchCategories: 'general',
  webSearchSafeSearch: 1,
  webSearchTimeRange: '' as '' | 'day' | 'week' | 'month' | 'year',
  webSearchTopK: 5,
  webSearchTimeoutMs: 8000,
  webSearchBlockedDomains: '',
}

function normalizeSiteFormData(data?: Partial<SiteSettings> | null) {
  const definedValues = Object.fromEntries(
    Object.entries(data ?? {}).filter(([, value]) => value !== undefined && value !== null)
  )

  return {
    ...DEFAULT_SITE_FORM_DATA,
    ...definedValues,
  }
}

export default function AdminSiteSettingsPage() {
  const [, setSettings] = useState<SiteSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState(() => ({ ...DEFAULT_SITE_FORM_DATA }))
  const [moderationFormData, setModerationFormData] = useState({
    chatModerationEnabled: false,
    chatModerationApiBaseUrl: '',
    chatModerationApiKey: '',
    chatModerationModelName: '',
    chatModerationSystemPrompt: '',
    chatModerationAutoBanEnabled: false,
    chatModerationAutoBanRules: [] as ChatModerationAutoBanRule[],
  })
  const startupPopupImageUrl = formData.startupPopupImageUrl || ''
  const startupPopupHtml = formData.startupPopupHtml || ''

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const [siteData, aiData] = await Promise.all([
        adminSiteService.getSettings(),
        adminAiService.getSettings(),
      ])
      setSettings(siteData)
      setFormData(normalizeSiteFormData(siteData))
      setModerationFormData({
        chatModerationEnabled: aiData.chatModerationEnabled === true,
        chatModerationApiBaseUrl: aiData.chatModerationApiBaseUrl || '',
        chatModerationApiKey: aiData.chatModerationApiKey || '',
        chatModerationModelName: aiData.chatModerationModelName || '',
        chatModerationSystemPrompt: aiData.chatModerationSystemPrompt || '',
        chatModerationAutoBanEnabled: aiData.chatModerationAutoBanEnabled === true,
        chatModerationAutoBanRules: aiData.chatModerationAutoBanRules || [],
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('加载系统配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      const normalizedTurnstileSiteKey = formData.turnstileSiteKey.trim()
      const normalizedTurnstileSecretKey = formData.turnstileSecretKey.trim()
      const {
        turnstileSecretKey: _turnstileSecretKey,
        chatFileUploadEnabled: _chatFileUploadEnabled,
        chatFileMaxFilesPerMessage: _chatFileMaxFilesPerMessage,
        chatFileMaxFileSizeMb: _chatFileMaxFileSizeMb,
        chatFileAllowedExtensions: _chatFileAllowedExtensions,
        chatFileMaxExtractChars: _chatFileMaxExtractChars,
        chatFileContextMode: _chatFileContextMode,
        chatFileRetrievalTopK: _chatFileRetrievalTopK,
        chatFileChunkSize: _chatFileChunkSize,
        chatFileChunkOverlap: _chatFileChunkOverlap,
        chatFileRetrievalMaxChars: _chatFileRetrievalMaxChars,
        webSearchEnabled: _webSearchEnabled,
        webSearchBaseUrl: _webSearchBaseUrl,
        webSearchMode: _webSearchMode,
        webSearchLanguage: _webSearchLanguage,
        webSearchCategories: _webSearchCategories,
        webSearchSafeSearch: _webSearchSafeSearch,
        webSearchTimeRange: _webSearchTimeRange,
        webSearchTopK: _webSearchTopK,
        webSearchTimeoutMs: _webSearchTimeoutMs,
        webSearchBlockedDomains: _webSearchBlockedDomains,
        ...restSiteFormData
      } = formData
      const sitePayload = {
        ...restSiteFormData,
        turnstileSiteKey: normalizedTurnstileSiteKey,
        ...(normalizedTurnstileSecretKey && !normalizedTurnstileSecretKey.includes('****')
          ? { turnstileSecretKey: normalizedTurnstileSecretKey }
          : {}),
      }
      const moderationPayload = {
        chatModerationEnabled: moderationFormData.chatModerationEnabled,
        chatModerationApiBaseUrl: moderationFormData.chatModerationApiBaseUrl,
        chatModerationModelName: moderationFormData.chatModerationModelName,
        chatModerationSystemPrompt: moderationFormData.chatModerationSystemPrompt,
        chatModerationAutoBanEnabled: moderationFormData.chatModerationAutoBanEnabled,
        chatModerationAutoBanRules: moderationFormData.chatModerationAutoBanRules
          .map((rule) => ({
            triggerCount: Number.isFinite(rule.triggerCount) ? Math.max(1, Math.trunc(rule.triggerCount)) : 1,
            banDays: Number.isFinite(rule.banDays) ? Math.max(1, Math.trunc(rule.banDays)) : 1,
          }))
          .sort((a, b) => a.triggerCount - b.triggerCount),
      }

      const [updatedSettings, updatedAiSettings] = await Promise.all([
        adminSiteService.updateSettings(sitePayload),
        adminAiService.updateSettings({
          ...moderationPayload,
          ...(moderationFormData.chatModerationApiKey &&
          !moderationFormData.chatModerationApiKey.includes('****')
            ? { chatModerationApiKey: moderationFormData.chatModerationApiKey }
            : {}),
        }),
      ])
      setSettings(updatedSettings)
      setFormData(normalizeSiteFormData(updatedSettings))
      setModerationFormData({
        chatModerationEnabled: updatedAiSettings.chatModerationEnabled === true,
        chatModerationApiBaseUrl: updatedAiSettings.chatModerationApiBaseUrl || '',
        chatModerationApiKey: updatedAiSettings.chatModerationApiKey || '',
        chatModerationModelName: updatedAiSettings.chatModerationModelName || '',
        chatModerationSystemPrompt: updatedAiSettings.chatModerationSystemPrompt || '',
        chatModerationAutoBanEnabled: updatedAiSettings.chatModerationAutoBanEnabled === true,
        chatModerationAutoBanRules: updatedAiSettings.chatModerationAutoBanRules || [],
      })
      toast.success('系统配置已保存')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('保存系统配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  const updateAutoBanRule = (
    index: number,
    key: keyof ChatModerationAutoBanRule,
    value: number
  ) => {
    setModerationFormData((prev) => ({
      ...prev,
      chatModerationAutoBanRules: prev.chatModerationAutoBanRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [key]: value } : rule
      ),
    }))
  }

  const addAutoBanRule = () => {
    setModerationFormData((prev) => ({
      ...prev,
      chatModerationAutoBanRules: [...prev.chatModerationAutoBanRules, { ...DEFAULT_AUTO_BAN_RULE }],
    }))
  }

  const removeAutoBanRule = (index: number) => {
    setModerationFormData((prev) => ({
      ...prev,
      chatModerationAutoBanRules: prev.chatModerationAutoBanRules.filter((_, ruleIndex) => ruleIndex !== index),
    }))
  }

  if (isLoading) {
    return <AdminPageLoading text="加载系统配置中..." />
  }

  return (
    <AdminPageShell
      title="系统配置"
      description="管理站点基础能力、支付能力与统一审核配置"
      maxWidthClassName="max-w-5xl"
    >
      <form onSubmit={handleSubmit}>
        <Card className="space-y-6 border border-stone-200 !bg-white p-6 !shadow-sm">
          {/* 站点信息 */}
          <div>
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              站点信息
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>
                  站点标题
                </label>
                <input
                  type="text"
                  value={formData.siteTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, siteTitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="例如：AI创作平台"
                />
              </div>

              <div>
                <label className={labelCls}>
                  站点图标 URL
                </label>
                <input
                  type="text"
                  value={formData.siteIcon}
                  onChange={(e) =>
                    setFormData({ ...formData, siteIcon: e.target.value })
                  }
                  className={inputCls}
                  placeholder="https://example.com/icon.png"
                />
                <p className={helpTextCls}>
                  建议尺寸：40x40 像素，支持 PNG/JPG/SVG
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  主题色
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.themeColor || '#B794F6'}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-stone-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.themeColor}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="w-36 rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                    placeholder="#B794F6"
                    maxLength={7}
                  />
                  {formData.themeColor && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, themeColor: '' })}
                      className="text-xs text-stone-500 hover:text-red-500 transition-colors"
                    >
                      恢复默认
                    </button>
                  )}
                </div>
                <p className={helpTextCls}>
                  网站的主题强调色，影响按钮、标签页、交互元素颜色。留空使用默认紫色（#B794F6）。
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  页脚信息
                </label>
                <input
                  type="text"
                  value={formData.siteFooter}
                  onChange={(e) =>
                    setFormData({ ...formData, siteFooter: e.target.value })
                  }
                  className={inputCls}
                  placeholder="例如：© 2026 AI创作平台"
                />
              </div>

              <div>
                <label className={labelCls}>
                  卡密购买链接
                </label>
                <input
                  type="text"
                  value={formData.cardPurchaseUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, cardPurchaseUrl: e.target.value })
                  }
                  className={inputCls}
                  placeholder="https://example.com/purchase"
                />
                <p className={helpTextCls}>
                  配置后将在套餐页面显示购买卡密的链接
                </p>
              </div>
            </div>
          </div>

          {/* 注册设置 */}
          <div className="pt-6 border-t border-stone-200">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              注册设置
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="registrationEnabled"
                  checked={formData.registrationEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, registrationEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-stone-300 bg-white text-aurora-purple focus:ring-aurora-purple/20"
                />
                <label
                  htmlFor="registrationEnabled"
                  className="text-sm font-medium text-stone-700"
                >
                  开启用户注册
                </label>
              </div>

              <div>
                <label className={labelCls}>
                  初始注册赠送积分
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.initialRegisterCredits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initialRegisterCredits: parseInt(e.target.value) || 0,
                    })
                  }
                  className={inputCls}
                />
                <p className={helpTextCls}>
                  新用户注册时自动获得的永久积分数量
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    邀请人注册奖励积分
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.inviteRegisterInviterCredits}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inviteRegisterInviterCredits: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={inputCls}
                  />
                  <p className={helpTextCls}>
                    被邀请人通过邀请码完成注册后，邀请人获得的永久积分
                  </p>
                </div>

                <div>
                  <label className={labelCls}>
                    被邀请人注册奖励积分
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.inviteRegisterInviteeCredits}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inviteRegisterInviteeCredits: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={inputCls}
                  />
                  <p className={helpTextCls}>
                    用户使用邀请码注册时，额外获得的永久积分
                  </p>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  邀请消费返利比例
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.invitePaymentCreditsPerYuan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invitePaymentCreditsPerYuan: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputCls}
                />
                <p className={helpTextCls}>
                  被邀请人每实际支付 1 元，邀请人可获得多少积分。支持小数，例如 0.5 表示消费 1 元返 0.5 积分，最终按向上取整发放。填 0 表示仅保留注册奖励，不发放消费返利。
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-200">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              人机验证（Cloudflare Turnstile）
            </h2>
            <div className="space-y-4">
              <div className={switchCardCls}>
                <div>
                  <p className="font-semibold text-stone-800">启用登录 / 注册人机验证</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    开启后，登录和注册表单会显示 Turnstile，后端也会强制校验 token。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, turnstileEnabled: !formData.turnstileEnabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.turnstileEnabled ? 'bg-aurora-purple' : 'bg-stone-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${formData.turnstileEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className={labelCls}>Site Key</label>
                <input
                  type="text"
                  value={formData.turnstileSiteKey}
                  onChange={(e) =>
                    setFormData({ ...formData, turnstileSiteKey: e.target.value })
                  }
                  className={inputCls}
                  placeholder="0x4AAAA..."
                />
                <p className={helpTextCls}>
                  这是前端公开使用的 Key，会下发到登录和注册页面。
                </p>
              </div>

              <div>
                <label className={labelCls}>Secret Key</label>
                <input
                  type="password"
                  value={formData.turnstileSecretKey}
                  onChange={(e) =>
                    setFormData({ ...formData, turnstileSecretKey: e.target.value })
                  }
                  className={inputCls}
                  placeholder="0x4AAAA..."
                />
                <p className={helpTextCls}>
                  已保存的 Secret Key 会脱敏显示，重新输入即可更新；不会通过公开接口暴露给前端。
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs leading-6 text-stone-500">
                Turnstile 官方前端脚本会从 Cloudflare 加载。只有在后台开启并且配置了 Site Key / Secret Key 后，登录和注册页面才会真正启用验证。
              </div>
            </div>
          </div>

          {/* 积分购买配置 */}
          <div className="pt-6 border-t border-stone-200">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              积分购买配置
            </h2>
            <div className="space-y-4">
              <div className={switchCardCls}>
                <div>
                  <p className="font-semibold text-stone-800">启用自定义积分购买</p>
                  <p className="text-xs text-stone-500 mt-0.5">开启后用户可在商城页面自定义购买积分数量</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, creditBuyEnabled: !formData.creditBuyEnabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${formData.creditBuyEnabled ? 'bg-aurora-purple' : 'bg-stone-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${formData.creditBuyEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>每1元对应积分数</label>
                  <input
                    type="number" min={1}
                    value={formData.creditBuyRatePerYuan}
                    onChange={e => setFormData({ ...formData, creditBuyRatePerYuan: Math.max(1, Number(e.target.value)) })}
                    className={inputCls}
                  />
                  <p className={helpTextCls}>例如填100表示1元=100积分</p>
                </div>
                <div>
                  <label className={labelCls}>最少购买积分数</label>
                  <input
                    type="number" min={1}
                    value={formData.creditBuyMinCredits}
                    onChange={e => setFormData({ ...formData, creditBuyMinCredits: Math.max(1, Number(e.target.value)) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>最多购买积分数</label>
                  <input
                    type="number" min={1}
                    value={formData.creditBuyMaxCredits}
                    onChange={e => setFormData({ ...formData, creditBuyMaxCredits: Math.max(1, Number(e.target.value)) })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-200">
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              聊天文件配置与联网搜索配置（SearXNG）已迁移至「AI 能力 → AI 配置」页面统一管理。
            </div>
          </div>

          <div className="pt-6 border-t border-stone-200">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              内容审核配置
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={moderationFormData.chatModerationEnabled}
                  onChange={(e) =>
                    setModerationFormData({ ...moderationFormData, chatModerationEnabled: e.target.checked })
                  }
                />
                <div>
                  <p className="text-sm font-medium text-stone-800">启用统一输入审核</p>
                  <p className="mt-1 text-xs text-stone-500">
                    开启后聊天、绘图、提示词润色都会先审核用户输入；关闭后这三处都不审核。
                  </p>
                </div>
              </label>

              <div>
                <label className={labelCls}>审核 API 基地址</label>
                <input
                  type="text"
                  value={moderationFormData.chatModerationApiBaseUrl}
                  onChange={(e) =>
                    setModerationFormData({ ...moderationFormData, chatModerationApiBaseUrl: e.target.value })
                  }
                  className={inputCls}
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className={labelCls}>审核 API Key</label>
                <input
                  type="password"
                  value={moderationFormData.chatModerationApiKey}
                  onChange={(e) =>
                    setModerationFormData({ ...moderationFormData, chatModerationApiKey: e.target.value })
                  }
                  className={inputCls}
                  placeholder="sk-..."
                />
                <p className={helpTextCls}>已保存的 Key 会脱敏显示，重新输入即可更新</p>
              </div>

              <div>
                <label className={labelCls}>审核模型名称</label>
                <input
                  type="text"
                  value={moderationFormData.chatModerationModelName}
                  onChange={(e) =>
                    setModerationFormData({ ...moderationFormData, chatModerationModelName: e.target.value })
                  }
                  className={inputCls}
                  placeholder="gpt-4.1-mini"
                />
                <p className={helpTextCls}>该模型必须只返回 true 或 false。</p>
              </div>

              <div>
                <label className={labelCls}>审核系统提示词</label>
                <textarea
                  value={moderationFormData.chatModerationSystemPrompt}
                  rows={8}
                  onChange={(e) =>
                    setModerationFormData({ ...moderationFormData, chatModerationSystemPrompt: e.target.value })
                  }
                  className={textareaCls}
                  placeholder="输入统一审核系统提示词..."
                />
                <p className={helpTextCls}>建议明确要求模型只能输出 true / false，不要输出解释。</p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={moderationFormData.chatModerationAutoBanEnabled}
                    onChange={(e) =>
                      setModerationFormData({ ...moderationFormData, chatModerationAutoBanEnabled: e.target.checked })
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-stone-800">启用审核触发自动封禁</p>
                    <p className="mt-1 text-xs text-stone-500">
                      当前自动封禁仅作用于聊天消息审核拦截记录。按累计拦截次数匹配最高规则。
                    </p>
                  </div>
                </label>

                <div className="mt-4 space-y-3">
                  {moderationFormData.chatModerationAutoBanRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">
                      暂无规则。可以添加例如“拦截 3 次封禁 1 天”、“拦截 5 次封禁 7 天”。
                    </div>
                  ) : (
                    moderationFormData.chatModerationAutoBanRules.map((rule, index) => (
                      <div
                        key={`${index}-${rule.triggerCount}-${rule.banDays}`}
                        className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]"
                      >
                        <div>
                          <label className="mb-2 block text-xs font-medium text-stone-500">累计拦截次数</label>
                          <input
                            type="number"
                            min="1"
                            value={rule.triggerCount}
                            onChange={(e) =>
                              updateAutoBanRule(index, 'triggerCount', parseInt(e.target.value, 10) || 1)
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-medium text-stone-500">封禁天数</label>
                          <input
                            type="number"
                            min="1"
                            value={rule.banDays}
                            onChange={(e) =>
                              updateAutoBanRule(index, 'banDays', parseInt(e.target.value, 10) || 1)
                            }
                            className={inputCls}
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => removeAutoBanRule(index)}
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            删除规则
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={addAutoBanRule}
                      className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      添加规则
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 页面内容设置 */}
          <div className="pt-6 border-t border-stone-200">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              页面内容
            </h2>
            <p className="mb-4 text-sm text-stone-500">
              首页支持顶部滚动消息条，其余页面内容支持 Markdown 格式并显示在对应公开页面中
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>
                  首页顶端滚动消息条
                </label>
                <textarea
                  value={formData.homeTopMarqueeText}
                  onChange={(e) =>
                    setFormData({ ...formData, homeTopMarqueeText: e.target.value })
                  }
                  rows={3}
                  className={textareaCls}
                  placeholder="例如：新用户注册即送积分，会员限时优惠进行中，点击右上角进入商城查看。"
                />
                <p className={helpTextCls}>
                  仅在首页顶部展示，为滚动消息条样式；留空则不显示。
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <h3 className="text-sm font-semibold text-stone-900">首页背景轮播</h3>
                <p className="mt-1 text-xs leading-6 text-stone-500">
                  用于首页首屏背景。图片 URL 每行一个，也支持英文逗号分隔；留空时使用系统内置公开网络资源，不会使用私有 COS 地址。
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className={labelCls}>图片背景 URL 列表</label>
                    <textarea
                      value={formData.homeHeroImageUrls}
                      onChange={(e) =>
                        setFormData({ ...formData, homeHeroImageUrls: e.target.value })
                      }
                      rows={5}
                      className={textareaCls}
                      placeholder={'https://example.com/image-1.jpg\nhttps://example.com/image-2.jpg'}
                    />
                    <p className={helpTextCls}>
                      图片模式下自动轮播；建议使用可公开访问的 HTTPS 图片地址。
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>视频背景 URL</label>
                    <input
                      type="text"
                      value={formData.homeHeroVideoUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, homeHeroVideoUrl: e.target.value })
                      }
                      className={inputCls}
                      placeholder="https://example.com/background.mp4"
                    />
                    <p className={helpTextCls}>
                      视频模式下使用；留空时使用系统内置公开演示视频。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <h3 className="text-sm font-semibold text-stone-900">页面启动遮罩广告 / 消息弹层</h3>
                <p className="mt-1 text-xs leading-6 text-stone-500">
                  进入站点首次加载或刷新后弹出一次；同一次页面访问中切换到创作、对话等路由不会重复弹出。用户手动关闭后，30 分钟内不会再次弹出。
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className={labelCls}>
                      弹层内容类型
                    </label>
                    <select
                      value={formData.startupPopupType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startupPopupType: e.target.value as 'image' | 'html',
                        })
                      }
                      className={selectCls}
                    >
                      <option value="image">图片弹窗</option>
                      <option value="html">HTML 弹窗</option>
                    </select>
                    <p className={helpTextCls}>
                      图片模式适合海报广告；HTML 模式适合自定义活动卡片、消息面板、按钮布局等内容。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className={labelCls}>
                        弹层宽度（px）
                      </label>
                      <input
                        type="number"
                        min={240}
                        max={2000}
                        value={formData.startupPopupWidthPx}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startupPopupWidthPx: Math.max(240, Number(e.target.value) || 240),
                          })
                        }
                        className={inputCls}
                        placeholder="720"
                      />
                      <p className={helpTextCls}>
                        用于控制弹层最大宽度。前端仍会自动限制为不超过当前屏幕宽度。
                      </p>
                    </div>

                    <div>
                      <label className={labelCls}>
                        弹层高度（px）
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={2000}
                        value={formData.startupPopupHeightPx}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startupPopupHeightPx: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className={inputCls}
                        placeholder="0"
                      />
                      <p className={helpTextCls}>
                        填 0 表示高度自适应内容；填写正数后内容区域会按该高度展示，超出部分自动滚动。
                      </p>
                    </div>
                  </div>

                  {formData.startupPopupType === 'image' ? (
                    <>
                      <div>
                        <label className={labelCls}>
                          遮罩图片 URL
                        </label>
                        <input
                          type="text"
                          value={formData.startupPopupImageUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, startupPopupImageUrl: e.target.value })
                          }
                          className={inputCls}
                          placeholder="https://example.com/startup-popup.jpg"
                        />
                        <p className={helpTextCls}>
                          图片将按原始比例展示，并按上方宽高限制自动缩放。
                        </p>
                      </div>

                      <div>
                        <label className={labelCls}>
                          图片点击跳转 URL
                        </label>
                        <input
                          type="text"
                          value={formData.startupPopupTargetUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, startupPopupTargetUrl: e.target.value })
                          }
                          className={inputCls}
                          placeholder="/packages 或 https://example.com/activity"
                        />
                        <p className={helpTextCls}>
                          可填写站内相对路径或完整外链；留空则仅展示图片，不跳转。
                        </p>
                      </div>

                      {startupPopupImageUrl.trim() ? (
                        <div>
                          <p className="mb-2 text-xs font-medium text-stone-500">图片预览</p>
                          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                            <div
                              className="mx-auto flex items-center justify-center"
                              style={{
                                maxWidth: `${formData.startupPopupWidthPx}px`,
                                maxHeight:
                                  formData.startupPopupHeightPx > 0
                                    ? `${Math.min(formData.startupPopupHeightPx, 320)}px`
                                    : '320px',
                              }}
                            >
                              <img
                                src={startupPopupImageUrl}
                                alt="startup-popup-preview"
                                className="max-h-[320px] w-full object-contain"
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={labelCls}>
                          HTML 代码
                        </label>
                        <textarea
                          value={formData.startupPopupHtml}
                          onChange={(e) =>
                            setFormData({ ...formData, startupPopupHtml: e.target.value })
                          }
                          rows={12}
                          className={monoTextareaCls}
                          placeholder={`<div style="padding:24px;background:#fff;border-radius:24px">
  <h2>限时活动</h2>
  <p>这里可以写任意 HTML 内容。</p>
  <a href="/packages">立即查看</a>
</div>`}
                        />
                        <p className={helpTextCls}>
                          支持自定义结构和样式。HTML 模式下如果需要跳转链接，建议直接在代码内使用 a 标签或按钮。
                        </p>
                      </div>

                      {startupPopupHtml.trim() ? (
                        <div>
                          <p className="mb-2 text-xs font-medium text-stone-500">HTML 预览</p>
                          <div className="overflow-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
                            <div
                              className="mx-auto"
                              style={{
                                width: `min(100%, ${formData.startupPopupWidthPx}px)`,
                                height:
                                  formData.startupPopupHeightPx > 0
                                    ? `${Math.min(formData.startupPopupHeightPx, 320)}px`
                                    : 'auto',
                                maxHeight: '320px',
                              }}
                              dangerouslySetInnerHTML={{ __html: startupPopupHtml }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  关于我们
                </label>
                <textarea
                  value={formData.aboutUs}
                  onChange={(e) =>
                    setFormData({ ...formData, aboutUs: e.target.value })
                  }
                  rows={6}
                  className={monoTextareaCls}
                  placeholder="# 关于我们&#10;&#10;这里填写关于我们的内容..."
                />
                <p className={helpTextCls}>
                  访问地址: /about
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  隐私政策
                </label>
                <textarea
                  value={formData.privacyPolicy}
                  onChange={(e) =>
                    setFormData({ ...formData, privacyPolicy: e.target.value })
                  }
                  rows={6}
                  className={monoTextareaCls}
                  placeholder="# 隐私政策&#10;&#10;这里填写隐私政策内容..."
                />
                <p className={helpTextCls}>
                  访问地址: /privacy
                </p>
              </div>

              <div>
                <label className={labelCls}>
                  使用条款
                </label>
                <textarea
                  value={formData.termsOfService}
                  onChange={(e) =>
                    setFormData({ ...formData, termsOfService: e.target.value })
                  }
                  rows={6}
                  className={monoTextareaCls}
                  placeholder="# 使用条款&#10;&#10;这里填写使用条款内容..."
                />
                <p className={helpTextCls}>
                  访问地址: /terms
                </p>
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="pt-6 border-t border-stone-200">
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-aurora-purple px-6 py-2 text-white transition-colors hover:bg-aurora-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </Card>
      </form>
    </AdminPageShell>
  )
}
