/**
 * Prompts API 路由
 * 缓存外部 prompts 数据，提升加载速度
 */

import { NextResponse } from 'next/server'

const PROMPTS_URL =
  'https://raw.githubusercontent.com/glidea/banana-prompt-quicker/main/prompts.json'

// 缓存配置
let cachedData: unknown = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 60 * 1000 // 5天缓存

export async function GET() {
  try {
    const now = Date.now()

    // 如果缓存有效，直接返回
    if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
      console.log('[Prompts API] Returning cached data')
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      })
    }

    // 缓存失效，重新获取
    console.log('[Prompts API] Fetching fresh data from GitHub')
    const response = await fetch(PROMPTS_URL, {
      next: {
        revalidate: 300, // Next.js 缓存 5 分钟
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const data = await response.json()

    // 更新缓存
    cachedData = data
    cacheTimestamp = now

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[Prompts API] Error:', error)

    // 如果有缓存数据，即使过期也返回
    if (cachedData) {
      console.log('[Prompts API] Returning stale cached data due to error')
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'X-Cache-Status': 'stale',
        },
      })
    }

    // 没有缓存数据，返回错误
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
