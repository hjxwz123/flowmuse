'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { ChatModelManagerSection } from '@/components/admin/settings/ChatModelManagerSection'
import { adminAiService, type AiSettings } from '@/lib/api/services/admin/ai'
import { adminSiteService } from '@/lib/api/services/admin/site'
import type { SiteSettings } from '@/lib/api/types/admin/site'
import { toast } from 'sonner'

type AiCapabilitySiteSettings = Pick<
  SiteSettings,
  | 'chatFileUploadEnabled'
  | 'chatFileMaxFilesPerMessage'
  | 'chatFileMaxFileSizeMb'
  | 'chatFileAllowedExtensions'
  | 'chatFileMaxExtractChars'
  | 'chatFileContextMode'
  | 'chatFileRetrievalTopK'
  | 'chatFileChunkSize'
  | 'chatFileChunkOverlap'
  | 'chatFileRetrievalMaxChars'
  | 'webSearchEnabled'
  | 'webSearchBaseUrl'
  | 'webSearchMode'
  | 'webSearchLanguage'
  | 'webSearchCategories'
  | 'webSearchSafeSearch'
  | 'webSearchTimeRange'
  | 'webSearchTopK'
  | 'webSearchTimeoutMs'
  | 'webSearchBlockedDomains'
>

const sectionTitleCls = 'mb-4 flex items-center gap-2 text-xl font-semibold text-stone-900'
const sectionAccentCls = 'inline-block h-5 w-1 rounded-full bg-aurora-purple'
const labelCls = 'mb-2 block text-sm font-medium text-stone-700'
const helpTextCls = 'mt-1 text-xs text-stone-500'
const inputCls =
  'w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 transition-colors placeholder:text-stone-400 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
const textareaCls = `${inputCls} resize-y`
const selectCls =
  'w-full appearance-none rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 transition-colors focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20'
const switchCardCls = 'flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-4'

const DEFAULT_AI_FORM_DATA = {
  apiBaseUrl: '',
  apiKey: '',
  modelName: '',
  webSearchTaskModelName: '',
  systemPrompt: '',
  creditsCost: 1,
}

const DEFAULT_AI_CAPABILITY_SITE_FORM_DATA: AiCapabilitySiteSettings = {
  chatFileUploadEnabled: true,
  chatFileMaxFilesPerMessage: 5,
  chatFileMaxFileSizeMb: 20,
  chatFileAllowedExtensions: 'txt,md,csv,json,html,pdf,docx,pptx,xlsx',
  chatFileMaxExtractChars: 120000,
  chatFileContextMode: 'retrieval',
  chatFileRetrievalTopK: 6,
  chatFileChunkSize: 1200,
  chatFileChunkOverlap: 180,
  chatFileRetrievalMaxChars: 10000,
  webSearchEnabled: false,
  webSearchBaseUrl: '',
  webSearchMode: 'off',
  webSearchLanguage: 'zh-CN',
  webSearchCategories: 'general',
  webSearchSafeSearch: 1,
  webSearchTimeRange: '',
  webSearchTopK: 5,
  webSearchTimeoutMs: 8000,
  webSearchBlockedDomains: '',
}

function normalizeAiCapabilitySiteFormData(data?: Partial<SiteSettings> | null): AiCapabilitySiteSettings {
  return {
    chatFileUploadEnabled:
      data?.chatFileUploadEnabled ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileUploadEnabled,
    chatFileMaxFilesPerMessage:
      data?.chatFileMaxFilesPerMessage ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileMaxFilesPerMessage,
    chatFileMaxFileSizeMb:
      data?.chatFileMaxFileSizeMb ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileMaxFileSizeMb,
    chatFileAllowedExtensions:
      data?.chatFileAllowedExtensions ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileAllowedExtensions,
    chatFileMaxExtractChars:
      data?.chatFileMaxExtractChars ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileMaxExtractChars,
    chatFileContextMode:
      data?.chatFileContextMode ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileContextMode,
    chatFileRetrievalTopK:
      data?.chatFileRetrievalTopK ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileRetrievalTopK,
    chatFileChunkSize:
      data?.chatFileChunkSize ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileChunkSize,
    chatFileChunkOverlap:
      data?.chatFileChunkOverlap ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileChunkOverlap,
    chatFileRetrievalMaxChars:
      data?.chatFileRetrievalMaxChars ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.chatFileRetrievalMaxChars,
    webSearchEnabled:
      data?.webSearchEnabled ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchEnabled,
    webSearchBaseUrl:
      data?.webSearchBaseUrl ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchBaseUrl,
    webSearchMode:
      data?.webSearchMode ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchMode,
    webSearchLanguage:
      data?.webSearchLanguage ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchLanguage,
    webSearchCategories:
      data?.webSearchCategories ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchCategories,
    webSearchSafeSearch:
      data?.webSearchSafeSearch ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchSafeSearch,
    webSearchTimeRange:
      data?.webSearchTimeRange ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchTimeRange,
    webSearchTopK:
      data?.webSearchTopK ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchTopK,
    webSearchTimeoutMs:
      data?.webSearchTimeoutMs ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchTimeoutMs,
    webSearchBlockedDomains:
      data?.webSearchBlockedDomains ?? DEFAULT_AI_CAPABILITY_SITE_FORM_DATA.webSearchBlockedDomains,
  }
}

export default function AdminAiSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState(() => ({ ...DEFAULT_AI_FORM_DATA }))
  const [siteFormData, setSiteFormData] = useState(() => ({ ...DEFAULT_AI_CAPABILITY_SITE_FORM_DATA }))

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const [data, siteSettings] = await Promise.all([
        adminAiService.getSettings(),
        adminSiteService.getSettings(),
      ])
      setFormData({
        apiBaseUrl: data.apiBaseUrl || '',
        apiKey: data.apiKey || '',
        modelName: data.modelName || '',
        webSearchTaskModelName: data.webSearchTaskModelName || '',
        systemPrompt: data.systemPrompt || '',
        creditsCost: data.creditsCost ?? 1,
      })
      setSiteFormData(normalizeAiCapabilitySiteFormData(siteSettings))
    } catch (error) {
      toast.error('加载 AI 配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      const payload: Partial<AiSettings> = {
        apiBaseUrl: formData.apiBaseUrl,
        modelName: formData.modelName,
        webSearchTaskModelName: formData.webSearchTaskModelName,
        systemPrompt: formData.systemPrompt,
        creditsCost: formData.creditsCost,
      }
      if (formData.apiKey && !formData.apiKey.includes('****')) {
        payload.apiKey = formData.apiKey
      }
      const [updated, updatedSiteSettings] = await Promise.all([
        adminAiService.updateSettings(payload),
        adminSiteService.updateSettings(siteFormData),
      ])
      setFormData({
        apiBaseUrl: updated.apiBaseUrl || '',
        apiKey: updated.apiKey || '',
        modelName: updated.modelName || '',
        webSearchTaskModelName: updated.webSearchTaskModelName || '',
        systemPrompt: updated.systemPrompt || '',
        creditsCost: updated.creditsCost ?? 1,
      })
      setSiteFormData(normalizeAiCapabilitySiteFormData(updatedSiteSettings))
      toast.success('AI 配置已保存')
    } catch (error) {
      toast.error('保存 AI 配置失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <AdminPageLoading text="加载 AI 配置中..." />
  }

  const apiConfigured = Boolean(formData.apiBaseUrl.trim()) && Boolean(formData.apiKey.trim())

  return (
    <AdminPageShell
      title="AI 配置中心"
      description="管理全局 AI 参数、提示词优化、聊天文件上传与 SearXNG 联网搜索能力"
      maxWidthClassName="max-w-5xl"
    >
      <form onSubmit={handleSubmit}>
        <Card className="space-y-6 border border-stone-200 !bg-white p-6 !shadow-sm">
          <div>
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              API 配置
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>API 基地址</label>
                <input type="text" value={formData.apiBaseUrl}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, apiBaseUrl: e.target.value })}
                  className={inputCls} placeholder="https://api.openai.com/v1" />
                <p className={helpTextCls}>OpenAI 兼容的 API 地址</p>
              </div>
              <div>
                <label className={labelCls}>API Key</label>
                <input type="password" value={formData.apiKey}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, apiKey: e.target.value })}
                  className={inputCls} placeholder="sk-..." />
                <p className={helpTextCls}>已保存的 Key 会脱敏显示，重新输入即可更新</p>
              </div>
              <div>
                <label className={labelCls}>提示词优化模型名称</label>
                <input type="text" value={formData.modelName}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, modelName: e.target.value })}
                  className={inputCls} placeholder="gpt-4o-mini" />
                <p className={helpTextCls}>用于绘画/视频提示词优化。</p>
              </div>
              <div>
                <label className={labelCls}>联网搜索任务模型名称</label>
                <input
                  type="text"
                  value={formData.webSearchTaskModelName}
                  onChange={(e: { target: { value: string } }) =>
                    setFormData({ ...formData, webSearchTaskModelName: e.target.value })
                  }
                  className={inputCls}
                  placeholder="gpt-4o-mini"
                />
                <p className={helpTextCls}>
                  任务规划。留空则跳过任务模型规划。
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-stone-200 pt-6">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              提示词配置
            </h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>系统提示词</label>
                <textarea value={formData.systemPrompt} rows={8}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  className={textareaCls} placeholder="输入系统提示词..." />
                <p className={helpTextCls}>指导 AI 如何优化用户的提示词，要求输出 3 个版本并用分隔符分开</p>
              </div>
              <div>
                <label className={labelCls}>每次优化扣除积分</label>
                <input type="number" min="0" value={formData.creditsCost}
                  onChange={(e: { target: { value: string } }) => setFormData({ ...formData, creditsCost: parseInt(e.target.value) || 0 })}
                  className={inputCls} />
                <p className={helpTextCls}>用户每次使用 AI 优化提示词扣除的积分数量</p>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              聊天文件配置
            </h2>
            <div className="space-y-4">
              <div className={switchCardCls}>
                <div>
                  <p className="font-semibold text-stone-800">启用聊天文件上传</p>
                  <p className="mt-0.5 text-xs text-stone-500">开启后聊天页面允许上传文档并注入上下文</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSiteFormData({ ...siteFormData, chatFileUploadEnabled: !siteFormData.chatFileUploadEnabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${siteFormData.chatFileUploadEnabled ? 'bg-aurora-purple' : 'bg-stone-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${siteFormData.chatFileUploadEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>单条消息最大文件数</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={siteFormData.chatFileMaxFilesPerMessage}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileMaxFilesPerMessage: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>单文件大小上限（MB）</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={siteFormData.chatFileMaxFileSizeMb}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileMaxFileSizeMb: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>单文件提取字符上限</label>
                  <input
                    type="number"
                    min={1000}
                    value={siteFormData.chatFileMaxExtractChars}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileMaxExtractChars: Math.max(1000, Number(e.target.value) || 1000) })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>允许扩展名（逗号分隔）</label>
                <input
                  type="text"
                  value={siteFormData.chatFileAllowedExtensions}
                  onChange={(e) => setSiteFormData({ ...siteFormData, chatFileAllowedExtensions: e.target.value })}
                  placeholder="txt,md,csv,json,html,pdf,docx,pptx,xlsx"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>上下文注入方式</label>
                  <select
                    value={siteFormData.chatFileContextMode}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileContextMode: e.target.value as 'full' | 'retrieval' })}
                    className={selectCls}
                  >
                    <option value="retrieval">分块匹配召回注入</option>
                    <option value="full">全量注入</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>分块召回数量 TopK</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={siteFormData.chatFileRetrievalTopK}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileRetrievalTopK: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>分块大小（字符）</label>
                  <input
                    type="number"
                    min={200}
                    value={siteFormData.chatFileChunkSize}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileChunkSize: Math.max(200, Number(e.target.value) || 200) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>分块重叠（字符）</label>
                  <input
                    type="number"
                    min={0}
                    value={siteFormData.chatFileChunkOverlap}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileChunkOverlap: Math.max(0, Number(e.target.value) || 0) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>单次注入字符上限</label>
                  <input
                    type="number"
                    min={1000}
                    value={siteFormData.chatFileRetrievalMaxChars}
                    onChange={(e) => setSiteFormData({ ...siteFormData, chatFileRetrievalMaxChars: Math.max(1000, Number(e.target.value) || 1000) })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6">
            <h2 className={sectionTitleCls}>
              <span className={sectionAccentCls} />
              联网搜索配置（SearXNG）
            </h2>
            <div className="space-y-4">
              <div className={switchCardCls}>
                <div>
                  <p className="font-semibold text-stone-800">启用联网搜索</p>
                  <p className="mt-0.5 text-xs text-stone-500">聊天可按模式调用 SearXNG 搜索最新信息并注入上下文</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSiteFormData({ ...siteFormData, webSearchEnabled: !siteFormData.webSearchEnabled })}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${siteFormData.webSearchEnabled ? 'bg-aurora-purple' : 'bg-stone-300'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${siteFormData.webSearchEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className={labelCls}>SearXNG 地址</label>
                <input
                  type="text"
                  value={siteFormData.webSearchBaseUrl}
                  onChange={(e) => setSiteFormData({ ...siteFormData, webSearchBaseUrl: e.target.value })}
                  placeholder="例如: https://searx.example.com"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>触发模式</label>
                  <select
                    value={siteFormData.webSearchMode}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchMode: e.target.value as 'off' | 'auto' | 'always' })}
                    className={selectCls}
                  >
                    <option value="off">关闭</option>
                    <option value="auto">手动开启（仅用户开关触发）</option>
                    <option value="always">自动触发（可手动开启）</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>搜索语言</label>
                  <input
                    type="text"
                    value={siteFormData.webSearchLanguage}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchLanguage: e.target.value })}
                    placeholder="zh-CN"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>搜索分类</label>
                  <input
                    type="text"
                    value={siteFormData.webSearchCategories}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchCategories: e.target.value })}
                    placeholder="general"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={labelCls}>安全过滤</label>
                  <select
                    value={siteFormData.webSearchSafeSearch}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchSafeSearch: Number(e.target.value) || 0 })}
                    className={selectCls}
                  >
                    <option value={0}>0（关闭）</option>
                    <option value={1}>1（中）</option>
                    <option value={2}>2（高）</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>时间范围</label>
                  <select
                    value={siteFormData.webSearchTimeRange}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchTimeRange: e.target.value as '' | 'day' | 'week' | 'month' | 'year' })}
                    className={selectCls}
                  >
                    <option value="">不限</option>
                    <option value="day">近一天</option>
                    <option value="week">近一周</option>
                    <option value="month">近一月</option>
                    <option value="year">近一年</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>注入条数 TopK</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={siteFormData.webSearchTopK}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchTopK: Math.max(1, Number(e.target.value) || 1) })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>超时（ms）</label>
                  <input
                    type="number"
                    min={1000}
                    max={30000}
                    value={siteFormData.webSearchTimeoutMs}
                    onChange={(e) => setSiteFormData({ ...siteFormData, webSearchTimeoutMs: Math.max(1000, Number(e.target.value) || 1000) })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>屏蔽网站域名（逗号/换行分隔）</label>
                <textarea
                  value={siteFormData.webSearchBlockedDomains}
                  onChange={(e) => setSiteFormData({ ...siteFormData, webSearchBlockedDomains: e.target.value })}
                  rows={2}
                  placeholder="example.com, news.example.org"
                  className={textareaCls}
                />
                <p className={helpTextCls}>
                  命中这些域名的搜索结果会被忽略，并自动继续补足非屏蔽结果数量。
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-stone-200 pt-6">
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

      <ChatModelManagerSection apiConfigured={apiConfigured} />
    </AdminPageShell>
  )
}
