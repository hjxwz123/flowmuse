'use client'

type AdminPageLoadingProps = {
  text?: string
}

export function AdminPageLoading({ text = '加载中...' }: AdminPageLoadingProps) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-aurora-purple" />
        <p className="mt-3 text-sm text-stone-500">{text}</p>
      </div>
    </div>
  )
}
