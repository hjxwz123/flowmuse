'use client'

import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { PageTransition } from '@/components/shared/PageTransition'
import { FadeIn } from '@/components/shared/FadeIn'
import { cn } from '@/lib/utils/cn'

interface ImmersiveDocumentPageProps {
  title: string
  content: string
  empty: string
  icon: LucideIcon
}

function normalizeMarkdownContent(raw: string) {
  let text = raw.replace(/\r\n/g, '\n')

  if (text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n')
  }

  return text.trim()
}

export function ImmersiveDocumentPage({
  title,
  content,
  empty,
  icon: Icon,
}: ImmersiveDocumentPageProps) {
  const normalizedContent = normalizeMarkdownContent(content)
  const hasContent = normalizedContent.length > 0

  return (
    <PageTransition className="relative min-h-screen overflow-hidden bg-canvas px-3 py-4 pb-24 text-stone-900 dark:bg-canvas-dark dark:text-stone-100 md:px-4 md:py-6 md:pb-8 xl:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-white/60 via-white/15 to-transparent dark:from-white/[0.05] dark:via-white/[0.015]" />
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-aurora-purple/10 blur-3xl dark:bg-aurora-purple/14" />
        <div className="absolute left-16 top-[34%] h-64 w-64 rounded-full bg-aurora-blue/10 blur-3xl dark:bg-aurora-blue/12" />
        <div className="absolute right-[-6rem] top-8 h-80 w-80 rounded-full bg-aurora-pink/10 blur-3xl dark:bg-aurora-pink/12" />
        <div className="absolute bottom-[-5rem] left-[32%] h-72 w-72 rounded-full bg-aurora-green/10 blur-3xl dark:bg-aurora-green/10" />
      </div>

      <div className="relative mx-auto w-full max-w-[1500px]">
        <FadeIn variant="slide">
          <section className="relative overflow-hidden rounded-[32px] border border-stone-200/70 bg-white/60 shadow-[0_30px_100px_rgba(28,25,23,0.08)] backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#101114]/80 dark:shadow-[0_36px_120px_rgba(0,0,0,0.42)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aurora-purple/40 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 top-0 w-px bg-gradient-to-b from-transparent via-aurora-blue/35 to-transparent" aria-hidden="true" />

            <div className="grid min-h-[calc(100vh-2.5rem)] gap-0 lg:grid-cols-[minmax(250px,0.78fr)_minmax(0,1.42fr)]">
              <div className="relative border-b border-stone-200/70 px-6 py-8 dark:border-white/[0.08] sm:px-8 lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
                <div className="lg:sticky lg:top-10">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] border border-stone-200/80 bg-white/80 text-stone-900 shadow-[0_12px_30px_rgba(28,25,23,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-stone-50 dark:shadow-[0_18px_36px_rgba(0,0,0,0.35)]">
                    <Icon className="h-7 w-7" />
                  </div>

                  <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-50 sm:text-5xl">
                    {title}
                  </h1>

                  <div className="mt-8 h-px w-20 bg-gradient-to-r from-aurora-purple/60 via-aurora-blue/50 to-transparent" />
                </div>
              </div>

              <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10">
                <FadeIn variant="fade" delay={0.08}>
                  <div
                    className={cn(
                      'relative overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                      !hasContent && 'flex min-h-[420px] items-center justify-center sm:min-h-[520px]'
                    )}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.14]" aria-hidden="true" />

                    {hasContent ? (
                      <div
                        className={cn(
                          'prose prose-stone max-w-none text-[15px] leading-7 dark:prose-invert',
                          'prose-headings:font-display prose-headings:tracking-tight prose-headings:text-stone-950 dark:prose-headings:text-stone-50',
                          'prose-h1:mt-0 prose-h1:text-4xl prose-h2:mt-10 prose-h2:border-t prose-h2:border-stone-200/80 prose-h2:pt-8 dark:prose-h2:border-white/10',
                          'prose-h3:mt-8 prose-h3:text-2xl prose-h4:mt-6 prose-h4:text-xl',
                          'prose-p:text-stone-700 dark:prose-p:text-stone-300',
                          'prose-strong:text-stone-950 dark:prose-strong:text-stone-100',
                          'prose-a:font-medium prose-a:text-stone-950 prose-a:decoration-aurora-purple/45 prose-a:underline-offset-4 hover:prose-a:text-aurora-purple dark:prose-a:text-stone-100 dark:hover:prose-a:text-aurora-blue',
                          'prose-ul:pl-5 prose-ol:pl-5',
                          'prose-li:text-stone-700 dark:prose-li:text-stone-300',
                          'prose-hr:my-10 prose-hr:border-stone-200/80 dark:prose-hr:border-white/10',
                          'prose-blockquote:rounded-2xl prose-blockquote:border-l-4 prose-blockquote:border-aurora-purple prose-blockquote:bg-stone-950/[0.035] prose-blockquote:px-6 prose-blockquote:py-4 prose-blockquote:text-stone-700 dark:prose-blockquote:bg-white/[0.04] dark:prose-blockquote:text-stone-200',
                          'prose-code:rounded-md prose-code:bg-stone-950/[0.06] prose-code:px-1.5 prose-code:py-1 prose-code:text-[0.9em] prose-code:font-medium prose-code:text-stone-900 prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-white/[0.08] dark:prose-code:text-stone-100',
                          'prose-pre:overflow-x-auto prose-pre:rounded-[1.35rem] prose-pre:border prose-pre:border-stone-200/80 prose-pre:bg-stone-950 prose-pre:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:prose-pre:border-white/10 dark:prose-pre:bg-[#0b0b0d]',
                          '[&_li::marker]:text-aurora-purple',
                          '[&_table]:my-8 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden',
                          '[&_thead]:border-b [&_thead]:border-stone-200/80 [&_thead]:bg-stone-950/[0.03] dark:[&_thead]:border-white/10 dark:[&_thead]:bg-white/[0.04]',
                          '[&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.18em] [&_th]:text-stone-500 dark:[&_th]:text-stone-400',
                          '[&_td]:border-t [&_td]:border-stone-200/80 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top dark:[&_td]:border-white/10'
                        )}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex w-full max-w-md flex-col items-center justify-center text-center">
                        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full border border-stone-200/80 bg-white/90 text-stone-700 shadow-[0_10px_24px_rgba(28,25,23,0.06)] dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-stone-200">
                          <Icon className="h-6 w-6" />
                        </div>
                        <p className="text-base text-stone-500 dark:text-stone-400">{empty}</p>
                      </div>
                    )}
                  </div>
                </FadeIn>
              </div>
            </div>
          </section>
        </FadeIn>
      </div>
    </PageTransition>
  )
}
