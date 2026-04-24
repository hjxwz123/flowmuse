/**
 * 站点配置状态管理 (Zustand)
 * 管理站点全局配置
 */

import { create } from 'zustand'
import type { SiteSettings } from '../api/types/site'
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings } from '../utils/siteSettings'

interface SiteState {
  // 状态
  settings: SiteSettings | null
  isLoading: boolean

  // 操作
  setSettings: (settings: Partial<SiteSettings> | null | undefined) => void
  updateSettings: (settings: Partial<SiteSettings> | null | undefined) => void
  setLoading: (loading: boolean) => void
}

export const useSiteStore = create<SiteState>((set) => ({
  // 初始状态
  settings: DEFAULT_SITE_SETTINGS,
  isLoading: false,

  // 设置站点配置
  setSettings: (settings) => {
    set({ settings: normalizeSiteSettings(settings) })
  },

  // 更新站点配置
  updateSettings: (settingsUpdate) => {
    set((state) => ({
      settings: normalizeSiteSettings({
        ...(state.settings || DEFAULT_SITE_SETTINGS),
        ...(settingsUpdate || {}),
      }),
    }))
  },

  // 设置加载状态
  setLoading: (loading) => {
    set({ isLoading: loading })
  },
}))
