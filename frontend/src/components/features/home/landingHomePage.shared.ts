import type { ApiTask } from '@/lib/api/types'

export type LandingMode = 'image' | 'video'

export type LandingHomeCopy = {
  about: string
  enterCreate: string
  exploreGallery: string
  galleryEmpty: string
  galleryLoading: string
  galleryTitle: string
  imageMode: string
  imagePlaceholder: string
  loadingMore: string
  login: string
  noMore: string
  privacy: string
  projects: string
  publicImage: string
  publicVideo: string
  quick: string
  register: string
  subtitle: string
  tasks: string
  terms: string
  title: string
  untitled: string
  videoMode: string
  videoPlaceholder: string
  workflow: string
  workspace: string
}

export type DisplayTask = ApiTask & {
  preview: string
}

export const PAGE_SIZE = 12
export const HOME_NAV_TRANSITION_MS = 520
export const HOME_HERO_IMAGE_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?q=80&w=1920&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1920&auto=format&fit=crop',
  '/images/9.png',
]
export const HOME_HERO_VIDEO_BACKGROUND = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'


export function getLandingHomeCopy(locale: string): LandingHomeCopy {
  const isZh = locale.toLowerCase().startsWith('zh')

  if (isZh) {
    return {
      title: '重塑你的想象力',
      subtitle: '一键生成惊艳的超清图像与动态视频，在色彩秩序里保留作品本身的光感与节奏。',
      enterCreate: '进入创作',
      workspace: '工作台',
      quick: '快速',
      workflow: '工作流',
      tasks: '任务',
      projects: '项目',
      login: '登录',
      register: '注册',
      imageMode: '图片生成',
      videoMode: '视频生成',
      imagePlaceholder: '描述你想要生成的图像画面细节...',
      videoPlaceholder: '描述视频的动作轨迹、情绪推进与镜头语言...',
      exploreGallery: '探索画廊',
      galleryTitle: '灵感共创',
      galleryLoading: '正在加载公开作品...',
      galleryEmpty: '暂时还没有公开作品',
      loadingMore: '加载更多中...',
      noMore: '没有更多公开作品了',
      publicVideo: '公开视频',
      publicImage: '公开图片',
      untitled: '未命名作品',
      about: '关于我们',
      privacy: '隐私政策',
      terms: '使用条款',
    }
  }

  return {
    title: 'Reshape Your Imagination',
    subtitle: 'Generate cinematic images and motion-rich videos in one click, while the interface stays crisp in a visual system.',
    enterCreate: 'Create',
    workspace: 'Workspace',
    quick: 'Quick',
    workflow: 'Workflow',
    tasks: 'Tasks',
    projects: 'Projects',
    login: 'Login',
    register: 'Sign up',
    imageMode: 'Image',
    videoMode: 'Video',
    imagePlaceholder: 'Describe the image you want to create...',
    videoPlaceholder: 'Describe motion, emotion, and camera language for the video...',
    exploreGallery: 'Explore Gallery',
    galleryTitle: 'Shared Inspiration',
    galleryLoading: 'Loading public works...',
    galleryEmpty: 'No public works yet',
    loadingMore: 'Loading more...',
    noMore: 'No more public works',
    publicVideo: 'Public Video',
    publicImage: 'Public Image',
    untitled: 'Untitled work',
    about: 'About',
    privacy: 'Privacy',
    terms: 'Terms',
  }
}

export function mergeAndSortTasks(prev: ApiTask[], incoming: ApiTask[]) {
  const map = new Map<string, ApiTask>()

  for (const task of prev) {
    map.set(`${task.type}-${task.id}`, task)
  }

  for (const task of incoming) {
    map.set(`${task.type}-${task.id}`, task)
  }

  return Array.from(map.values()).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

export function getTaskAspectRatio(task: ApiTask): string {
  if (task.parameters) {
    const params = task.parameters as Record<string, unknown>

    if (params.width && params.height) {
      return `${params.width} / ${params.height}`
    }

    if (params.ar) {
      const arMap: Record<string, string> = {
        '16:9': '16 / 9',
        '9:16': '9 / 16',
        '3:2': '3 / 2',
        '2:3': '2 / 3',
        '4:3': '4 / 3',
        '3:4': '3 / 4',
        '1:1': '1 / 1',
      }

      if (typeof params.ar === 'string' && arMap[params.ar]) {
        return arMap[params.ar]
      }
    }
  }

  return task.type === 'video' ? '16 / 9' : '1 / 1'
}

export function getTaskAspectRatioValue(task: ApiTask): number {
  const ratio = getTaskAspectRatio(task)
  const [widthRaw, heightRaw] = ratio.split('/').map((item) => Number(item.trim()))

  if (!Number.isFinite(widthRaw) || !Number.isFinite(heightRaw) || widthRaw <= 0 || heightRaw <= 0) {
    return task.type === 'video' ? 16 / 9 : 1
  }

  return widthRaw / heightRaw
}

export function buildCreateHref(locale: string, mode: LandingMode, prompt: string) {
  const params = new URLSearchParams()
  params.set('mode', mode)

  const normalizedPrompt = prompt.trim()
  if (normalizedPrompt) {
    params.set('prompt', normalizedPrompt)
  }

  const query = params.toString()
  return `/${locale}/create${query ? `?${query}` : ''}`
}

export function toDisplayTasks(items: ApiTask[]): DisplayTask[] {
  return items.reduce<DisplayTask[]>((acc, item) => {
    const preview = item.thumbnailUrl || item.resultUrl
    if (!preview) return acc

    acc.push({ ...item, preview })
    return acc
  }, [])
}
