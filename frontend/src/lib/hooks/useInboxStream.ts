'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import type { InboxStreamEvent } from '@/lib/api/types/inbox'
import { useAuthStore, useInboxStore } from '@/lib/store'

const STREAM_RETRY_BASE_MS = 2000
const STREAM_RETRY_MAX_MS = 15000

function getStreamUrl() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api'
  return `${base.replace(/\/+$/, '')}/inbox/stream`
}

export function useInboxStream(enabled = true) {
  const { isAuthenticated, _hasHydrated, accessToken } = useAuthStore()
  const { setUnreadCount, setLatestEvent } = useInboxStore()
  const lastUnreadCountRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!_hasHydrated) return
    if (!enabled || !isAuthenticated || !accessToken) {
      setUnreadCount(0)
      setLatestEvent(null)
      lastUnreadCountRef.current = 0
      return
    }

    let cancelled = false
    let reconnectAttempts = 0
    let abortController: AbortController | null = null

    const scheduleReconnect = () => {
      if (cancelled) return
      const delay = Math.min(
        STREAM_RETRY_BASE_MS * Math.max(1, 2 ** reconnectAttempts),
        STREAM_RETRY_MAX_MS
      )
      reconnectAttempts += 1
      retryTimerRef.current = window.setTimeout(connect, delay)
    }

    const handleEvent = (event: InboxStreamEvent) => {
      setLatestEvent(event)
      const unreadCount = 'unreadCount' in event ? event.unreadCount : null
      if (typeof unreadCount === 'number') {
        setUnreadCount(unreadCount)
      }

      if (event.type === 'snapshot') {
        lastUnreadCountRef.current = event.unreadCount
        return
      }

      if (event.type === 'message_created') {
        const prev = lastUnreadCountRef.current
        if (event.unreadCount > prev) {
          const delta = event.unreadCount - prev
          toast.success(
            delta === 1 ? '收件箱有 1 条新消息' : `收件箱有 ${delta} 条新消息`
          )
        }
      }

      if (typeof unreadCount === 'number') {
        lastUnreadCountRef.current = unreadCount
      }
    }

    const processChunk = (chunk: string, bufferRef: { current: string }) => {
      bufferRef.current += chunk.replace(/\r\n/g, '\n')

      while (true) {
        const boundary = bufferRef.current.indexOf('\n\n')
        if (boundary < 0) break

        const rawEvent = bufferRef.current.slice(0, boundary)
        bufferRef.current = bufferRef.current.slice(boundary + 2)

        const dataLines = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())

        if (dataLines.length === 0) continue

        const rawData = dataLines.join('\n')
        if (!rawData || rawData === '[DONE]') continue

        try {
          handleEvent(JSON.parse(rawData) as InboxStreamEvent)
        } catch {
          // Ignore malformed events and keep stream alive.
        }
      }
    }

    const connect = async () => {
      if (cancelled) return

      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }

      abortController = new AbortController()

      try {
        const response = await fetch(getStreamUrl(), {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            Authorization: `Bearer ${accessToken}`,
          },
          signal: abortController.signal,
          cache: 'no-store',
        })

        if (!response.ok || !response.body) {
          scheduleReconnect()
          return
        }

        reconnectAttempts = 0

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        const bufferRef = { current: '' }

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          processChunk(decoder.decode(value, { stream: true }), bufferRef)
        }

        const tail = decoder.decode()
        if (tail) processChunk(tail, bufferRef)

        if (!cancelled) scheduleReconnect()
      } catch (error) {
        if (cancelled) return
        if ((error as Error).name === 'AbortError') return
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      abortController?.abort()
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [_hasHydrated, accessToken, enabled, isAuthenticated, setLatestEvent, setUnreadCount])
}
