/**
 * 套餐商城内容组件
 * 显示套餐列表和兑换码输入
 */

'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Card, Button, MagicInput } from '@/components/ui'
import { membershipService, packageService, redeemService } from '@/lib/api/services'
import { useAuthStore } from '@/lib/store/authStore'
import { useSiteStore } from '@/lib/store'
import type { Package } from '@/lib/api/types/packages'
import type { MembershipLevel, MembershipPeriod, UserMembershipStatus } from '@/lib/api/types/memberships'
import { cn } from '@/lib/utils/cn'
import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { WechatPayDialog } from './WechatPayDialog'

// FAQ 数据
const faqItems = [
  {
    key: 'membershipRules',
    questionKey: 'faq.membershipRules.question',
    answerKey: 'faq.membershipRules.answer',
  },
  {
    key: 'howConsume',
    questionKey: 'faq.howConsume.question',
    answerKey: 'faq.howConsume.answer',
  },
  {
    key: 'dailyLimitReached',
    questionKey: 'faq.dailyLimitReached.question',
    answerKey: 'faq.dailyLimitReached.answer',
  },
]

export function PackagesContent() {
  const t = useTranslations('packages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const isZh = locale.toLowerCase().startsWith('zh')
  const { isAuthenticated, user } = useAuthStore()
  const { settings } = useSiteStore()

  const [packages, setPackages] = useState<Package[]>([])
  const [membershipLevels, setMembershipLevels] = useState<MembershipLevel[]>([])
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [membershipPeriod, setMembershipPeriod] = useState<MembershipPeriod>('monthly')
  const [myMembership, setMyMembership] = useState<UserMembershipStatus | null>(user?.membership ?? null)
  const [isLoading, setIsLoading] = useState(true)
  const [redeemCode, setRedeemCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  // 支付弹窗
  const [payDialog, setPayDialog] = useState<
    | { type: 'package'; pkg: Package }
    | { type: 'credits'; credits: number }
    | { type: 'membership'; level: MembershipLevel; period: MembershipPeriod }
    | null
  >(null)

  // 自定义积分购买
  const [customCredits, setCustomCredits] = useState<number>(settings?.creditBuyMinCredits ?? 100)

  const wechatPayEnabled = settings?.wechatPayEnabled === true
  const creditBuyEnabled = settings?.creditBuyEnabled === true
  const ratePerYuan = settings?.creditBuyRatePerYuan ?? 100
  const minCredits = settings?.creditBuyMinCredits ?? 100
  const maxCredits = settings?.creditBuyMaxCredits ?? 100000
  const formatDateTime = (value: string | Date) => new Date(value).toLocaleString(locale)
  const formatNumber = (value: number) => value.toLocaleString(locale)
  const containsHan = (value: string) => /[\u3400-\u9fff]/u.test(value)
  const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''
  const toEnglishTitle = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase())
  const autoTranslateText = (value: string | null | undefined) => {
    const source = normalizeText(value)
    if (!source) return ''

    let text = source
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/，/g, ', ')
      .replace(/。/g, '. ')
      .replace(/：/g, ': ')
      .replace(/；/g, '; ')
      .replace(/、/g, ', ')
      .replace(/×/g, ' x ')
      .replace(/\//g, ' / ')
      .replace(/(\d+)\s*(积分|点数)/g, '$1 credits')
      .replace(/(\d+)\s*天/g, '$1 days')
      .replace(/(\d+)\s*个月/g, '$1 months')
      .replace(/(\d+)\s*月/g, '$1 months')
      .replace(/(\d+)\s*年/g, '$1 years')

    const replacements: Array<[RegExp, string]> = [
      [/永久积分包/g, 'permanent credits package'],
      [/永久点数包/g, 'permanent credits package'],
      [/积分包/g, 'credits package'],
      [/点数包/g, 'credits package'],
      [/积分套餐/g, 'credits package'],
      [/点数套餐/g, 'credits package'],
      [/基础套餐/g, 'basic package'],
      [/标准套餐/g, 'standard package'],
      [/高级套餐/g, 'advanced package'],
      [/专业套餐/g, 'pro package'],
      [/旗舰套餐/g, 'premium package'],
      [/基础会员/g, 'basic membership'],
      [/标准会员/g, 'standard membership'],
      [/高级会员/g, 'advanced membership'],
      [/专业会员/g, 'pro membership'],
      [/旗舰会员/g, 'premium membership'],
      [/至尊会员/g, 'ultimate membership'],
      [/会员等级/g, 'membership tier'],
      [/会员中心/g, 'membership'],
      [/永久/g, 'permanent'],
      [/会员/g, 'membership'],
      [/套餐/g, 'package'],
      [/积分/g, 'credits'],
      [/点数/g, 'credits'],
      [/每日赠送/g, 'includes daily'],
      [/每日/g, 'daily'],
      [/赠送/g, 'includes'],
      [/加赠/g, 'bonus'],
      [/不限/g, 'unlimited'],
      [/无限/g, 'unlimited'],
      [/年付/g, 'yearly'],
      [/月付/g, 'monthly'],
      [/年卡/g, 'yearly plan'],
      [/月卡/g, 'monthly plan'],
      [/基础/g, 'basic'],
      [/标准/g, 'standard'],
      [/高级/g, 'advanced'],
      [/专业/g, 'pro'],
      [/旗舰/g, 'premium'],
      [/至尊/g, 'ultimate'],
      [/入门/g, 'starter'],
      [/推荐/g, 'recommended'],
      [/限时/g, 'limited-time'],
      [/优惠/g, 'discount'],
      [/说明/g, 'details'],
      [/描述/g, 'description'],
      [/有效期/g, 'valid for'],
      [/当日有效/g, 'valid for today'],
      [/立即购买/g, 'buy now'],
      [/开通/g, 'subscribe'],
      [/续费/g, 'renew'],
      [/可用/g, 'available'],
    ]

    replacements.forEach(([pattern, replacement]) => {
      text = text.replace(pattern, replacement)
    })

    text = normalizeText(
      text
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .replace(/\s+,/g, ',')
        .replace(/\s+\./g, '.')
        .replace(/\s+;/g, ';')
        .replace(/\s+:/g, ':')
    )

    return containsHan(text) ? '' : toEnglishTitle(text)
  }
  const getPackageName = (pkg: Package) => {
    if (isZh) return pkg.name
    if (pkg.nameEn?.trim()) return pkg.nameEn.trim()
    const translatedName = autoTranslateText(pkg.name)
    return translatedName || `${formatNumber(pkg.totalCredits)} ${t('packageCard.credits')}`
  }
  const getPackageDescription = (pkg: Package) => {
    if (isZh) return pkg.description
    if (pkg.descriptionEn?.trim()) return pkg.descriptionEn.trim()
    const translatedDescription = autoTranslateText(pkg.description)
    return translatedDescription || t('creditPackages.subtitle')
  }
  const getMembershipLevelName = (level: MembershipLevel, fallbackIndex?: number) => {
    if (isZh) return level.name
    if (level.nameEn?.trim()) return level.nameEn.trim()
    const translatedName = autoTranslateText(level.name)
    return translatedName || `${t('membership.title')} ${fallbackIndex ?? Math.max(1, level.sortOrder || 1)}`
  }
  const getActiveMembershipName = (membership: UserMembershipStatus) => {
    if (isZh) return membership.levelName
    if (membership.levelNameEn?.trim()) return membership.levelNameEn.trim()
    const matchedLevel = membershipLevels.find((level) => level.id === membership.levelId)
    if (matchedLevel) {
      const matchedIndex = membershipLevels.findIndex((level) => level.id === membership.levelId)
      return getMembershipLevelName(matchedLevel, matchedIndex + 1)
    }
    return autoTranslateText(membership.levelName) || t('membership.title')
  }
  const getMembershipBenefits = (level: MembershipLevel) => {
    if (!isZh && Array.isArray(level.benefitsEn) && level.benefitsEn.length > 0) {
      return level.benefitsEn
    }

    if (isZh) {
      return Array.isArray(level.benefits) ? level.benefits : []
    }

    const translatedBenefits = (Array.isArray(level.benefits) ? level.benefits : [])
      .map((benefit) => autoTranslateText(benefit))
      .filter(Boolean)

    const fallbackBenefits: string[] = []
    const bonusPermanentCredits = Math.max(0, Number(level.bonusPermanentCredits || 0))
    const dailyCredits = Math.max(0, Number(level.dailyCredits || 0))

    if (bonusPermanentCredits > 0) {
      fallbackBenefits.push(
        t('membership.bonusPermanentCredits', { credits: formatNumber(bonusPermanentCredits) })
      )
    }
    if (dailyCredits > 0) {
      fallbackBenefits.push(
        t('membership.dailyCredits', { credits: formatNumber(dailyCredits) })
      )
    }

    return Array.from(new Set([...translatedBenefits, ...fallbackBenefits]))
  }

  const creditPackages = packages.filter(p => p.packageType === 'credits')

  // 加载套餐列表
  useEffect(() => {
    const loadPackages = async () => {
      setIsLoading(true)
      try {
        const data = await packageService.getPackages({ activeOnly: true })
        setPackages(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to load packages:', err)
        setPackages([])
      } finally {
        setIsLoading(false)
      }
    }

    loadPackages()
  }, [])

  // 加载会员等级
  useEffect(() => {
    const loadMembershipLevels = async () => {
      setMembershipLoading(true)
      try {
        const data = await membershipService.getLevels()
        setMembershipLevels(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Failed to load membership levels:', error)
        setMembershipLevels([])
      } finally {
        setMembershipLoading(false)
      }
    }

    loadMembershipLevels()
  }, [])

  useEffect(() => {
    setMyMembership(user?.membership ?? null)
  }, [user?.membership])

  useEffect(() => {
    if (!isAuthenticated) {
      setMyMembership(null)
      return
    }

    let active = true
    const loadMyMembership = async () => {
      try {
        const data = await membershipService.getMyMembership()
        if (!active) return
        setMyMembership(data)
      } catch {
        if (!active) return
        setMyMembership(null)
      }
    }

    loadMyMembership()

    return () => {
      active = false
    }
  }, [isAuthenticated])

  // 处理兑换
  const handleRedeem = async () => {
    if (!redeemCode.trim()) return
    if (!isAuthenticated) {
      setRedeemMessage({ type: 'error', text: t('redeem.error.failed') })
      return
    }

    setIsRedeeming(true)
    setRedeemMessage(null)

    try {
      const result = await redeemService.redeem({ code: redeemCode })

      if (result.ok) {
        if (result.type === 'credits') {
          setRedeemMessage({
            type: 'success',
            text: t('redeem.success.credits', { credits: result.credits }),
          })
        } else {
          setRedeemMessage({
            type: 'success',
            text: t('redeem.success.membership', {
              name: isZh
                ? result.membershipLevelName
                : result.membershipLevelNameEn?.trim() || autoTranslateText(result.membershipLevelName) || t('membership.title'),
              period: t(`period.${result.membershipPeriod}`),
              cycles: result.membershipCycles,
            }),
          })
        }
        setRedeemCode('')
      }
    } catch (err: unknown) {
      console.error('Failed to redeem:', err)
      setRedeemMessage({ type: 'error', text: t('redeem.error.failed') })
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <>
      <PageTransition className="relative min-h-screen overflow-hidden bg-canvas px-3 py-6 dark:bg-canvas-dark md:px-4 md:py-8">
        {/* 背景光晕装饰 */}
        <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 opacity-30 dark:opacity-0">
          <div className="absolute inset-0 animate-aurora rounded-full bg-gradient-aurora blur-[100px]" />
        </div>
        <div className="pointer-events-none absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 opacity-20 dark:opacity-0">
          <div className="absolute inset-0 animate-blob rounded-full bg-aurora-purple blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[90rem]">
          <FadeIn variant="slide">
            <section className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h1 className="bg-gradient-aurora bg-clip-text text-3xl font-display font-bold tracking-tight text-transparent md:text-5xl">
                  {t('title')}
                </h1>
              </div>

              <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
                <a
                  href="#packages-redeem"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
                >
                  {t('redeem.title')}
                </a>
                {settings?.cardPurchaseUrl ? (
                  <button
                    type="button"
                    onClick={() => window.open(settings.cardPurchaseUrl, '_blank')}
                    className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                  >
                    {t('actions.buyCode')}
                  </button>
                ) : null}
              </div>
            </section>
          </FadeIn>

          {/* 兑换码区域 */}
          <FadeIn variant="scale" delay={0.1}>
            <Card id="packages-redeem" variant="glass" className="mb-6 border-white/40 bg-white/60 p-4 shadow-canvas-lg backdrop-blur-xl dark:border-stone-800/50 dark:bg-stone-900/60 md:mb-12 md:p-8">
              <div className="mx-auto max-w-2xl">
                <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
                  {t('redeem.title')}
                </h2>
                <p className="font-ui text-sm text-stone-600 dark:text-stone-400 mb-4">
                  {t('redeem.subtitle')}
                </p>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <MagicInput
                      type="text"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value)}
                      placeholder={t('redeem.placeholder')}
                      disabled={isRedeeming}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRedeem()
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleRedeem}
                    disabled={isRedeeming || !redeemCode.trim()}
                    className="px-8"
                  >
                    {isRedeeming ? tCommon('loading') : t('redeem.button')}
                  </Button>
                </div>

                {/* 兑换消息 */}
                {redeemMessage && (
                  <div
                    className={cn(
                      'mt-4 p-4 rounded-xl font-ui text-sm',
                      redeemMessage.type === 'success'
                        ? 'border border-green-200 bg-green-50 text-green-800 dark:border-green-700/60 dark:bg-green-900/20 dark:text-green-300'
                        : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-700/60 dark:bg-red-900/20 dark:text-red-300'
                    )}
                  >
                    {redeemMessage.text}
                  </div>
                )}
              </div>
            </Card>
          </FadeIn>

        {/* ─── 套餐列表 ─── */}
        {isLoading ? (
          <div className="py-12 text-center text-stone-500 dark:text-stone-400">{t('loading')}</div>
        ) : (
          <>
            {/* 积分充值套餐 */}
            {creditPackages.length > 0 && (
              <FadeIn variant="fade" delay={0.25}>
                <div className="mb-2">
                  <h2 className="font-display text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 mb-1">{t('creditPackages.title')}</h2>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">{t('creditPackages.subtitle')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {creditPackages.map((pkg, index) => (
                      <FadeIn key={pkg.id} variant="scale" delay={0.1 + index * 0.05}>
                        <Card variant="glass" className="relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-float dark:hover:shadow-canvas-dark-lg">
                          <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm">
                            {t('creditPackages.permanentBadge')}
                          </div>
                          <div className="p-4 md:p-6 relative z-10">
                            <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100 mb-3">{getPackageName(pkg)}</h3>
                            <div className="mb-4 flex items-baseline gap-2">
                              <span className="font-display text-4xl font-bold text-aurora-purple dark:text-aurora-pink">¥{pkg.price}</span>
                              {pkg.originalPrice && <span className="font-ui text-lg text-stone-400 line-through">¥{pkg.originalPrice}</span>}
                            </div>
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm mb-5">
                              <div className="flex justify-between">
                                <span className="text-stone-700 dark:text-stone-300">{t('packageCard.totalCredits')}</span>
                                <span className="font-bold text-amber-600 dark:text-amber-300">{formatNumber(pkg.totalCredits)} {t('packageCard.credits')}</span>
                              </div>
                            </div>
                            {getPackageDescription(pkg) && <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">{getPackageDescription(pkg)}</p>}
                            {wechatPayEnabled ? (
                              <Button variant="primary" className="w-full" onClick={() => { if (!isAuthenticated) { router.push(`/${locale}/auth/login`); return } setPayDialog({ type: 'package', pkg }) }}>{t('packageCard.buy')}</Button>
                            ) : (
                              <Button variant="secondary" className="w-full" disabled>{t('packageCard.comingSoon')}</Button>
                            )}
                          </div>
                        </Card>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              </FadeIn>
            )}

            {/* 自定义积分购买 */}
            {creditBuyEnabled && wechatPayEnabled && (
              <FadeIn variant="fade" delay={0.3}>
                <Card variant="glass" className="p-4 md:p-6 transition-all duration-300 hover:shadow-canvas-lg dark:hover:shadow-canvas-dark-lg">
                  <h2 className="font-display text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100 mb-1">{t('customBuy.title')}</h2>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">{t('customBuy.subtitle')}</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="flex-1 w-full">
                      <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">{t('customBuy.inputLabel')}</label>
                      <input
                        type="number"
                        min={minCredits}
                        max={maxCredits}
                        step={minCredits}
                        value={customCredits}
                        onChange={e => setCustomCredits(Math.max(minCredits, Math.min(maxCredits, Number(e.target.value))))}
                        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-lg font-bold text-stone-900 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-aurora-purple/50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                      />
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{t('customBuy.limitHint', { min: formatNumber(minCredits), max: formatNumber(maxCredits) })}</p>
                    </div>
                    <div className="flex-shrink-0 text-right sm:text-left">
                      <p className="text-xs text-stone-500 dark:text-stone-400 mb-0.5">{t('customBuy.priceDisplay')}</p>
                      <p className="bg-gradient-aurora bg-clip-text text-3xl font-bold text-transparent mb-3">¥{(customCredits / ratePerYuan).toFixed(2)}</p>
                      <Button variant="primary" onClick={() => { if (!isAuthenticated) { router.push(`/${locale}/auth/login`); return } setPayDialog({ type: 'credits', credits: customCredits }) }}>
                        {t('customBuy.buyButton')}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">{t('customBuy.rateHint', { rate: ratePerYuan })}</p>
                </Card>
              </FadeIn>
            )}

            {/* 会员购买 */}
            <FadeIn variant="fade" delay={0.33}>
              <Card variant="glass" className="p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="font-display text-xl md:text-2xl font-bold text-stone-900 dark:text-stone-100">
                      {t('membership.title')}
                    </h2>
                    <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {t('membership.subtitle')}
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1 shadow-inner dark:border-stone-700 dark:bg-stone-900">
                    <button
                      type="button"
                      onClick={() => setMembershipPeriod('monthly')}
                      className={cn(
                        'rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                        membershipPeriod === 'monthly'
                          ? 'bg-white shadow-sm text-aurora-purple dark:bg-stone-800 dark:text-aurora-pink ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50 dark:text-stone-400 dark:hover:text-stone-200'
                      )}
                    >
                      {t('membership.monthly')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMembershipPeriod('yearly')}
                      className={cn(
                        'rounded-lg px-4 py-1.5 text-sm font-bold transition-all',
                        membershipPeriod === 'yearly'
                          ? 'bg-white shadow-sm text-aurora-purple dark:bg-stone-800 dark:text-aurora-pink ring-1 ring-black/5 dark:ring-white/10'
                          : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50 dark:text-stone-400 dark:hover:text-stone-200'
                      )}
                    >
                      {t('membership.yearly')}
                    </button>
                  </div>
                </div>

                {myMembership?.isActive && (
                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-800/80">
                    <p className="text-sm text-stone-600 dark:text-stone-300">
                      {t('membership.currentLabel')}
                      <span
                        className="ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: myMembership.color }}
                      >
                        {getActiveMembershipName(myMembership)}
                      </span>
                      <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">
                        {t('membership.expireAt', { time: formatDateTime(myMembership.expireAt) })}
                      </span>
                    </p>
                  </div>
                )}

                {membershipLoading ? (
                  <div className="py-8 text-center text-stone-500 dark:text-stone-400">{t('membership.loading')}</div>
                ) : membershipLevels.length === 0 ? (
                  <div className="py-8 text-center text-stone-500 dark:text-stone-400">{t('membership.empty')}</div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {membershipLevels.map((level, index) => {
                      const currentPrice = membershipPeriod === 'yearly'
                        ? Number(level.yearlyPrice)
                        : Number(level.monthlyPrice)
                      const baseBonusPermanentCredits = Math.max(0, Number(level.bonusPermanentCredits || 0))
                      const bonusPermanentCredits = membershipPeriod === 'yearly'
                        ? baseBonusPermanentCredits * 12
                        : baseBonusPermanentCredits
                      const dailyCredits = Math.max(0, Number(level.dailyCredits || 0))
                      const benefits = getMembershipBenefits(level)
                      const isCurrentLevel = myMembership?.isActive && myMembership.levelId === level.id

                      return (
                        <div
                          key={level.id}
                          style={{ borderTopColor: level.color, borderTopWidth: 4 }}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-float dark:border-stone-700 dark:bg-stone-900/90 dark:hover:shadow-canvas-dark-lg"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                              {getMembershipLevelName(level, index + 1)}
                            </h3>
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              style={{ backgroundColor: level.color }}
                            >
                              {isCurrentLevel ? t('membership.currentLevel') : t('membership.available')}
                            </span>
                          </div>

                          <div className="mt-3">
                            <p className="text-3xl font-bold text-stone-900 dark:text-stone-100">
                              ¥{currentPrice.toFixed(2)}
                            </p>
                            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                              {membershipPeriod === 'yearly' ? t('membership.billedYearly') : t('membership.billedMonthly')}
                            </p>
                            {bonusPermanentCredits > 0 && (
                              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-300">
                                {t('membership.bonusPermanentCredits', { credits: formatNumber(bonusPermanentCredits) })}
                              </p>
                            )}
                            {dailyCredits > 0 && (
                              <p className="mt-1.5 text-xs text-violet-600 dark:text-violet-300">
                                {t('membership.dailyCredits', { credits: formatNumber(dailyCredits) })}
                              </p>
                            )}
                          </div>

                          <ul className="mt-4 min-h-[84px] space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
                            {benefits.length > 0 ? (
                              benefits.map((benefit, idx) => (
                                <li key={`${level.id}-benefit-${idx}`} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-aurora-purple" />
                                  <span>{benefit}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-stone-400 dark:text-stone-500">{t('membership.noBenefits')}</li>
                            )}
                          </ul>

                          <Button
                            variant="primary"
                            className="mt-4 w-full"
                            disabled={!wechatPayEnabled}
                            onClick={() => {
                              if (!isAuthenticated) {
                                router.push(`/${locale}/auth/login`)
                                return
                              }
                              setPayDialog({ type: 'membership', level, period: membershipPeriod })
                            }}
                          >
                            {isCurrentLevel ? t('membership.renew') : t('membership.subscribe')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </FadeIn>

            {creditPackages.length === 0 &&
              !creditBuyEnabled &&
              !membershipLoading &&
              membershipLevels.length === 0 && (
              <div className="py-12 text-center text-stone-500 dark:text-stone-400">{t('empty')}</div>
            )}
          </>
        )}

        {/* FAQ 常见问题 */}
        <FadeIn variant="slide" delay={0.4}>
          <Card variant="glass" className="mt-6 md:mt-12 p-4 md:p-6 dark:bg-stone-900/60 dark:backdrop-blur-xl">
            <h2 className="mb-4 font-display text-xl font-bold text-stone-900 dark:text-stone-100 md:mb-6 md:text-2xl">
              {t('faq.title')}
            </h2>
            <div className="space-y-3">
              {faqItems.map((item) => (
                <div
                  key={item.key}
                  className="overflow-hidden rounded-xl border border-stone-200 transition-all duration-300 hover:border-aurora-purple/30 hover:shadow-sm dark:border-stone-700 dark:hover:border-aurora-purple/50"
                >
                  <button
                    onClick={() =>
                      setExpandedFaq(expandedFaq === item.key ? null : item.key)
                    }
                    className={cn(
                      'w-full flex items-center justify-between p-4 text-left',
                      'bg-white transition-colors duration-200 hover:bg-stone-50 dark:bg-stone-900 dark:hover:bg-stone-800/90',
                      expandedFaq === item.key && 'bg-stone-50 dark:bg-stone-800/80'
                    )}
                  >
                    <span className="font-ui font-medium text-stone-900 dark:text-stone-100">
                      {t(item.questionKey)}
                    </span>
                    {expandedFaq === item.key ? (
                      <ChevronUp className="h-5 w-5 flex-shrink-0 text-stone-500 dark:text-stone-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 flex-shrink-0 text-stone-500 dark:text-stone-400" />
                    )}
                  </button>
                  {expandedFaq === item.key && (
                    <div className="bg-stone-50 px-4 pb-4 dark:bg-stone-800/80">
                      <p className="font-ui text-sm leading-relaxed whitespace-pre-line text-stone-600 dark:text-stone-300">
                        {t(item.answerKey)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>

    {/* 微信支付弹窗 */}
    {payDialog && (
      payDialog.type === 'package' ? (
        <WechatPayDialog
          title={getPackageName(payDialog.pkg)}
          packageId={payDialog.pkg.id}
          price={Number(payDialog.pkg.price)}
          onClose={() => setPayDialog(null)}
          onSuccess={() => { setPayDialog(null); router.push(`/${locale}/dashboard/credits`) }}
        />
      ) : payDialog.type === 'credits' ? (
        <WechatPayDialog
          title={t('payDialog.orderTitle.credits', { credits: formatNumber(payDialog.credits) })}
          credits={payDialog.credits}
          price={payDialog.credits / ratePerYuan}
          onClose={() => setPayDialog(null)}
          onSuccess={() => { setPayDialog(null); router.push(`/${locale}/dashboard/credits`) }}
        />
      ) : payDialog.type === 'membership' ? (
        <WechatPayDialog
          title={t('payDialog.orderTitle.membership', {
            name: getMembershipLevelName(
              payDialog.level,
              membershipLevels.findIndex((level) => level.id === payDialog.level.id) + 1 || undefined
            ),
            period: t(`period.${payDialog.period}`),
          })}
          membershipLevelId={payDialog.level.id}
          membershipPeriod={payDialog.period}
          price={payDialog.period === 'yearly' ? Number(payDialog.level.yearlyPrice) : Number(payDialog.level.monthlyPrice)}
          onClose={() => setPayDialog(null)}
          onSuccess={() => { setPayDialog(null); router.push(`/${locale}/dashboard/profile`) }}
        />
      ) : null
    )}
    </>
  )
}
