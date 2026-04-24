/**
 * next-intl 配置
 * 支持中文（zh-CN）和英文（en-US）
 */

import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, locales, type Locale } from './locales'

export default getRequestConfig(async ({ requestLocale }) => {
  // 使用 requestLocale 代替已废弃的 locale 参数
  let locale = await requestLocale

  // 验证locale是否有效，无效时使用默认locale
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale
  }

  return {
    locale,
    messages: {
      common: (await import(`./locales/${locale}/common.json`)).default,
      auth: (await import(`./locales/${locale}/auth.json`)).default,
      errors: (await import(`./locales/${locale}/errors.json`)).default,
      gallery: (await import(`./locales/${locale}/gallery.json`)).default,
      nav: (await import(`./locales/${locale}/nav.json`)).default,
      create: (await import(`./locales/${locale}/create.json`)).default,
      projects: (await import(`./locales/${locale}/projects.json`)).default,
      prompts: (await import(`./locales/${locale}/prompts.json`)).default,
      tasks: (await import(`./locales/${locale}/tasks.json`)).default,
      inbox: (await import(`./locales/${locale}/inbox.json`)).default,
      dashboard: (await import(`./locales/${locale}/dashboard.json`)).default,
      packages: (await import(`./locales/${locale}/packages.json`)).default,
      admin: (await import(`./locales/${locale}/admin.json`)).default,
      pages: (await import(`./locales/${locale}/pages.json`)).default,
      templates: (await import(`./locales/${locale}/templates.json`)).default,
      tools: (await import(`./locales/${locale}/tools.json`)).default,
      chat: (await import(`./locales/${locale}/chat.json`)).default,
      canvas: (await import(`./locales/${locale}/canvas.json`)).default,
    },
  }
})
