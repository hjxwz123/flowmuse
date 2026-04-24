'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AdminPageShell } from '@/components/admin/layout/AdminPageShell'
import { AdminPageLoading } from '@/components/admin/layout/AdminPageLoading'
import { toast } from 'sonner'
import { adminApiClient } from '@/lib/api/adminClient'

interface WechatPayConfig {
  enabled: boolean
  appId: string
  mchId: string
  apiV3Key: string
  privateKey: string
  serialNo: string
  notifyUrl: string
}

const EMPTY: WechatPayConfig = {
  enabled: false, appId: '', mchId: '', apiV3Key: '', privateKey: '', serialNo: '', notifyUrl: '',
}

const inputCls = 'w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-aurora-purple/30 focus:border-aurora-purple bg-white text-stone-900 text-sm font-mono transition-colors'
const labelCls = 'block text-sm font-medium text-stone-700 mb-1.5'

export default function AdminPaymentConfigPage() {
  const [form, setForm] = useState<WechatPayConfig>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      setIsLoading(true)
      const data: WechatPayConfig = await adminApiClient.get('/site/wechat-pay')
      setForm(data)
    } catch {
      toast.error('加载支付配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      await adminApiClient.put('/site/wechat-pay', form)
      toast.success('支付配置已保存')
    } catch {
      toast.error('保存失败，请检查配置')
    } finally {
      setIsSaving(false)
    }
  }

  const set = (key: keyof WechatPayConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  if (isLoading) {
    return <AdminPageLoading text="加载支付配置中..." />
  }

  return (
    <AdminPageShell
      title="支付配置"
      description="配置微信 Native 扫码支付（微信支付 V3 API）"
      maxWidthClassName="max-w-4xl"
    >
      <form onSubmit={handleSubmit}>
        <Card className="space-y-6 border border-stone-200 !bg-white p-6 !shadow-sm">
          {/* 启用开关 */}
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200">
            <div>
              <p className="font-semibold text-stone-800">启用微信支付</p>
              <p className="text-xs text-stone-500 mt-0.5">关闭后用户无法使用微信扫码购买套餐</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${form.enabled ? 'bg-aurora-purple' : 'bg-stone-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* 商户信息 */}
          <div>
            <h2 className="text-base font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-aurora-purple rounded-full inline-block" />
              商户基本信息
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>AppID <span className="text-stone-400 font-normal">(公众号/小程序)</span></label>
                <input type="text" value={form.appId} onChange={set('appId')} className={inputCls} placeholder="wx1234567890abcdef" />
              </div>
              <div>
                <label className={labelCls}>商户号 (mchid)</label>
                <input type="text" value={form.mchId} onChange={set('mchId')} className={inputCls} placeholder="1234567890" />
              </div>
              <div>
                <label className={labelCls}>证书序列号 (serial_no)</label>
                <input type="text" value={form.serialNo} onChange={set('serialNo')} className={inputCls} placeholder="商户API证书序列号（40位十六进制）" />
              </div>
              <div>
                <label className={labelCls}>APIv3 密钥</label>
                <input type="password" value={form.apiV3Key} onChange={set('apiV3Key')} className={inputCls} placeholder="32字节 APIv3 密钥" />
              </div>
            </div>
          </div>

          {/* 回调配置 */}
          <div>
            <h2 className="text-base font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-aurora-purple rounded-full inline-block" />
              回调配置
            </h2>
            <div>
              <label className={labelCls}>支付结果回调 URL</label>
              <input type="url" value={form.notifyUrl} onChange={set('notifyUrl')} className={inputCls} placeholder="https://yourdomain.com/api/pay/notify/wechat" />
              <p className="text-xs text-stone-500 mt-1">必须是 HTTPS 地址，微信支付服务器将向此地址发送支付结果通知</p>
            </div>
          </div>

          {/* 私钥 */}
          <div>
            <h2 className="text-base font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-aurora-purple rounded-full inline-block" />
              API 证书私钥
            </h2>
            <div>
              <label className={labelCls}>商户 API 证书私钥 <span className="text-stone-400 font-normal">(apiclient_key.pem 文件内容)</span></label>
              <textarea
                value={form.privateKey}
                onChange={set('privateKey')}
                rows={8}
                className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
                placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
              />
              <p className="text-xs text-stone-500 mt-1">
                将 apiclient_key.pem 文件的完整内容粘贴到此处（包含 BEGIN/END 行）
              </p>
            </div>
          </div>

          {/* 操作提示 */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">⚠️ 安全提示</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-700">
              <li>私钥和 APIv3 密钥属于高度敏感信息，请勿泄露</li>
              <li>回调 URL 必须能被微信服务器访问（公网 HTTPS）</li>
              <li>保存后请在微信支付商户后台验证配置是否正确</li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </Card>
      </form>
    </AdminPageShell>
  )
}
