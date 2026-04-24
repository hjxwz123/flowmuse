'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import styles from './LandingHomePage.module.css'

type LandingModelShowcaseProps = {
  locale: string
}

type PrimaryModelIconName = 'nano-banana' | 'seedance-2'
type MatrixModelIconName = 'midjourney' | 'wan' | 'qwen' | 'seedream' | 'kling' | 'gpt-image'
type ShowcaseIconName = PrimaryModelIconName | MatrixModelIconName | 'matrix'

type PrimaryModelCard = {
  id: string
  title: string
  iconName: PrimaryModelIconName
  accent: string
  company: string
  description: string
  features: string[]
  showcaseImage: string
  showcaseBadge: string
}

type MatrixModel = {
  id: string
  label: string
  iconName: MatrixModelIconName
  accent: string
  accentSoft: string
}

function getPrimaryModelCards(isZh: boolean): PrimaryModelCard[] {
  return [
    {
      id: 'nano-banana',
      title: 'Nano Banana',
      iconName: 'nano-banana',
      accent: '#F59E0B',
      company: isZh ? 'Google Gemini 架构' : 'Google Gemini Architecture',
      description: isZh
        ? '通过自然语言重写画面结构，适合复杂重绘、局部替换、多图融合和高一致性角色微调。'
        : 'Rewrites visual structure from natural language, designed for complex repainting, local edits, multi-image fusion, and consistent character refinements.',
      features: isZh
        ? ['自然语言修图', '多图透视融合', '角色特征锁定', '4K 电影级输出']
        : ['Natural-language editing', 'Multi-image perspective fusion', 'Character consistency', '4K cinematic output'],
      showcaseImage: 'https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1974&auto=format&fit=crop',
      showcaseBadge: isZh ? 'Nano Banana 生成案例' : 'Nano Banana Showcase',
    },
    {
      id: 'seedance-2',
      title: 'Seedance 2.0',
      iconName: 'seedance-2',
      accent: '#38BDF8',
      company: isZh ? '字节跳动 核心模型' : 'ByteDance Core Model',
      description: isZh
        ? '面向镜头语言、动作节奏和多模态叙事优化的视频生成引擎，适合更稳定的长镜头运动与画面推进。'
        : 'A video generation engine tuned for camera language, motion rhythm, and multimodal storytelling, ideal for steadier long-take motion and cinematic progression.',
      features: isZh
        ? ['原生音画同步', '物理运动模拟', '高燃运镜控制', '超长镜头生成']
        : ['Native audio-sync', 'Physical motion simulation', 'Cinematic camera control', 'Extended-shot generation'],
      showcaseImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
      showcaseBadge: isZh ? '15s 超长连贯渲染' : '15s Continuous Render',
    },
  ]
}

function getMatrixModels(): MatrixModel[] {
  return [
    { id: 'midjourney', label: 'Midjourney', iconName: 'midjourney', accent: '#67E8F9', accentSoft: 'rgba(103, 232, 249, 0.24)' },
    { id: 'wan', label: 'Wan', iconName: 'wan', accent: '#C084FC', accentSoft: 'rgba(192, 132, 252, 0.24)' },
    { id: 'qwen', label: 'Qwen', iconName: 'qwen', accent: '#F97316', accentSoft: 'rgba(249, 115, 22, 0.24)' },
    { id: 'seedream', label: 'SeeDream', iconName: 'seedream', accent: '#FACC15', accentSoft: 'rgba(250, 204, 21, 0.22)' },
    { id: 'kling', label: 'Kling', iconName: 'kling', accent: '#4ADE80', accentSoft: 'rgba(74, 222, 128, 0.24)' },
    { id: 'gpt-image', label: 'GPT Image', iconName: 'gpt-image', accent: '#A78BFA', accentSoft: 'rgba(167, 139, 250, 0.24)' },
  ]
}

function renderShowcaseIcon(iconName: ShowcaseIconName, className: string) {
  switch (iconName) {
    case 'nano-banana':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M1.5 19.824c0-.548.444-.992.991-.992h.744a.991.991 0 010 1.983H2.49a.991.991 0 01-.991-.991z" fill="#F3AD61"/>
          <path d="M14.837 13.5h7.076c.522 0 .784-.657.413-1.044l-1.634-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044zM3.587 13.5h7.076c.521 0 .784-.659.414-1.044l-1.635-1.704a3.183 3.183 0 00-4.636 0l-1.633 1.704c-.37.385-.107 1.044.414 1.044z" fill="#F9C23C"/>
          <path d="M12.525 1.521c3.69-.53 5.97 8.923 4.309 12.744-1.662 3.82-5.248 4.657-9.053 6.152a3.49 3.49 0 01-1.279.244c-1.443 0-2.227 1.187-2.774-.282-.707-1.9.22-4.031 2.069-4.757 2.014-.79 3.084-2.308 3.89-4.364.82-2.096.877-2.956.873-5.241-.003-1.827-.123-4.195 1.965-4.496z" fill="#FEEFC2"/>
          <path d="M16.834 14.264l-7.095-3.257c-.815 1.873-2.29 3.308-4.156 4.043-2.16.848-3.605 3.171-2.422 5.54 2.364 4.727 13.673-.05 13.673-6.325z" fill="#FCD53F"/>
          <path clipRule="evenodd" d="M13.68 12.362c.296.094.46.41.365.707-1.486 4.65-5.818 6.798-9.689 6.997a.562.562 0 11-.057-1.124c3.553-.182 7.372-2.138 8.674-6.216a.562.562 0 01.707-.364z" fill="#F9C23C" fillRule="evenodd"/>
          <path d="M17.43 19.85l-7.648-8.835h6.753c1.595.08 2.846 1.433 2.846 3.073v5.664c0 .997-.898 1.302-1.95.098z" fill="#FFF478"/>
        </svg>
      )
    case 'seedance-2':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
          <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
          <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
          <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
        </svg>
      )
    case 'matrix':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <path d="M8 7.5h8M8 16.5h8M12 7.5v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          <circle cx="6.5" cy="7.5" r="2" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="17.5" cy="7.5" r="2" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="16.5" r="2.2" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      )
    case 'midjourney':
      return (
        <svg className={className} fill="currentColor" fillRule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.369 17.676c-1.387 1.259-3.17 2.378-5.332 3.417.044.03.086.057.13.083l.018.01.019.012c.216.123.42.184.641.184.222 0 .426-.061.642-.184l.018-.011.019-.011c.14-.084.266-.178.492-.366l.178-.148c.279-.232.426-.342.625-.456.304-.174.612-.266.949-.266.337 0 .645.092.949.266l.023.014c.188.109.334.219.602.442l.178.148c.221.184.346.278.483.36l.028.017.018.01c.21.12.407.181.62.185h.022a.31.31 0 110 .618c-.337 0-.645-.092-.95-.266a3.137 3.137 0 01-.09-.054l-.022-.014-.022-.013-.02-.014a5.356 5.356 0 01-.49-.377l-.159-.132a3.836 3.836 0 00-.483-.36l-.027-.017-.019-.01a1.256 1.256 0 00-.641-.185c-.222 0-.426.061-.641.184l-.02.011-.018.011c-.14.084-.266.178-.492.366l-.158.132a5.125 5.125 0 01-.51.39l-.022.014-.022.014-.09.054a1.868 1.868 0 01-.95.266c-.337 0-.644-.092-.949-.266a3.137 3.137 0 01-.09-.054l-.022-.014-.022-.013-.026-.017a4.881 4.881 0 01-.425-.325.308.308 0 01-.12-.1l-.098-.081a3.836 3.836 0 00-.483-.36l-.027-.017-.019-.01a1.256 1.256 0 00-.641-.185c-.222 0-.426.061-.642.184l-.018.011-.019.011c-.14.084-.266.178-.492.366l-.158.132a5.125 5.125 0 01-.51.39l-.023.014-.022.014-.09.054A1.868 1.868 0 0112 22c-.337 0-.645-.092-.949-.266a3.137 3.137 0 01-.09-.054l-.022-.014-.022-.013-.021-.014a5.356 5.356 0 01-.49-.377l-.158-.132a3.836 3.836 0 00-.483-.36l-.028-.017-.018-.01a1.256 1.256 0 00-.642-.185c-.221 0-.425.061-.641.184l-.019.011-.018.011c-.141.084-.266.178-.492.366l-.158.132a5.125 5.125 0 01-.511.39l-.022.014-.022.014-.09.054a1.868 1.868 0 01-.986.264c-.746-.09-1.319-.38-1.89-.866l-.035-.03c-.047-.041-.118-.106-.192-.174l-.196-.181-.107-.1-.011-.01a1.531 1.531 0 00-.336-.253.313.313 0 00-.095-.03h-.005c-.119.022-.238.059-.361.11a.308.308 0 01-.077.061l-.008.005a.309.309 0 01-.126.034 5.66 5.66 0 00-.774.518l-.416.324-.055.043a6.542 6.542 0 01-.324.236c-.305.207-.552.315-.8.315a.31.31 0 01-.01-.618h.01c.09 0 .235-.062.438-.198l.04-.027c.077-.054.163-.117.27-.199l.385-.301.06-.047c.268-.206.506-.373.73-.505l-.633-1.21a.309.309 0 01.254-.451l20.287-1.305a.309.309 0 01.228.537zm-1.118.14L2.369 19.03l.423.809c.128-.045.256-.078.388-.1a.31.31 0 01.052-.005c.132 0 .26.032.386.093.153.073.294.179.483.35l.016.015.092.086.144.134.097.089c.065.06.125.114.16.144.485.418.948.658 1.554.736h.011a1.25 1.25 0 00.6-.172l.021-.011.019-.011.018-.011c.141-.084.266-.178.492-.366l.178-.148c.279-.232.426-.342.625-.456.305-.174.612-.266.95-.266.336 0 .644.092.948.266l.023.014c.188.109.335.219.603.442l.177.148c.222.184.346.278.484.36l.027.017.019.01c.215.124.42.185.641.185.222 0 .426-.061.641-.184l.019-.011.018-.011c.141-.084.267-.178.493-.366l.177-.148c.28-.232.427-.342.626-.456.304-.174.612-.266.949-.266.337 0 .644.092.949.266l.025.015c.187.109.334.22.603.443 1.867-.878 3.448-1.811 4.73-2.832l.02-.016zM3.653 2.026C6.073 3.06 8.69 4.941 10.8 7.258c2.46 2.7 4.109 5.828 4.637 9.149a.31.31 0 01-.421.335c-2.348-.945-4.54-1.258-6.59-1.02-1.739.2-3.337.792-4.816 1.703-.294.182-.62-.182-.405-.454 1.856-2.355 2.581-4.99 2.343-7.794-.195-2.292-1.031-4.61-2.284-6.709a.31.31 0 01.388-.442zM10.04 4.45c1.778.543 3.892 2.102 5.782 4.243 1.984 2.248 3.552 4.934 4.347 7.582a.31.31 0 01-.401.38l-.022-.01-.386-.154a10.594 10.594 0 00-.291-.112l-.016-.006c-.68-.247-1.199-.291-1.944-.101a.31.31 0 01-.375-.218C15.378 11.123 13.073 7.276 9.775 5c-.291-.201-.072-.653.266-.55zM4.273 2.996l.008.015c1.028 1.94 1.708 4.031 1.885 6.113.213 2.513-.31 4.906-1.673 7.092l-.02.031.003-.001c1.198-.581 2.47-.969 3.825-1.132l.055-.006c1.981-.23 4.083.029 6.309.837l.066.025-.007-.039c-.593-2.95-2.108-5.737-4.31-8.179l-.07-.078c-1.785-1.96-3.944-3.6-6.014-4.65l-.057-.028zm7.92 3.238l.048.048c2.237 2.295 3.885 5.431 4.974 9.191l.038.132.022-.004c.71-.133 1.284-.063 1.963.18l.027.01.066.024.046.018-.025-.073c-.811-2.307-2.208-4.62-3.936-6.594l-.058-.065c-1.02-1.155-2.103-2.132-3.15-2.856l-.015-.011z"/>
        </svg>
      )
    case 'wan':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fillRule="nonzero" fill="currentColor"/>
        </svg>
      )
    case 'qwen':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 00.157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 00-.081.05 575.097 575.097 0 01-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 01-.465-.271l-1.335-2.323a.09.09 0 00-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 01-.002-.54l1.207-2.12a.198.198 0 000-.197 550.951 550.951 0 01-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 012.589-.001.124.124 0 00.107-.063l2.806-4.895a.488.488 0 01.422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34zm-3.432.403a.06.06 0 00-.052.03L6.254 6.788a.157.157 0 01-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 00-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 01.096 0l1.424 2.53a.122.122 0 00.107.062l2.763-.02a.04.04 0 00.035-.02.041.041 0 000-.04l-2.9-5.086a.108.108 0 010-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 000-.114L9.225 1.774a.06.06 0 00-.053-.031zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 01-.05.029.058.058 0 01-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012z" fillRule="nonzero" fill="currentColor"/>
        </svg>
      )
    case 'seedream':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M5.31 15.756c.172-3.75 1.883-5.999 2.549-6.739-3.26 2.058-5.425 5.658-6.358 8.308v1.12C1.501 21.513 4.226 24 7.59 24a6.59 6.59 0 002.2-.375c.353-.12.7-.248 1.039-.378.913-.899 1.65-1.91 2.243-2.992-4.877 2.431-7.974.072-7.763-4.5l.002.001z" fill="#1E37FC"/>
          <path d="M22.57 10.283c-1.212-.901-4.109-2.404-7.397-2.8.295 3.792.093 8.766-2.1 12.773a12.782 12.782 0 01-2.244 2.992c3.764-1.448 6.746-3.457 8.596-5.219 2.82-2.683 3.353-5.178 3.361-6.66a2.737 2.737 0 00-.216-1.084v-.002z" fill="#37E1BE"/>
          <path d="M14.303 1.867C12.955.7 11.248 0 9.39 0 7.532 0 5.883.677 4.545 1.807 2.791 3.29 1.627 5.557 1.5 8.125v9.201c.932-2.65 3.097-6.25 6.357-8.307.5-.318 1.025-.595 1.569-.829 1.883-.801 3.878-.932 5.746-.706-.222-2.83-.718-5.002-.87-5.617h.001z" fill="#A569FF"/>
          <path d="M17.305 4.961a199.47 199.47 0 01-1.08-1.094c-.202-.213-.398-.419-.586-.622l-1.333-1.378c.151.615.648 2.786.869 5.617 3.288.395 6.185 1.898 7.396 2.8-1.306-1.275-3.475-3.487-5.266-5.323z" fill="#1E37FC"/>
        </svg>
      )
    case 'kling':
      return (
        <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
          <path d="M5.412 13.775A23.193 23.193 0 017.41 9.32c3.17-5.492 7.795-8.757 10.33-7.294C12.038-1.266 4.598.944 1.122 6.964A13.378 13.378 0 00.085 9.22c-.259.739.092 1.534.77 1.926l4.557 2.63z" fill="currentColor"/>
          <path d="M18.588 10.164a23.188 23.188 0 01-1.999 4.455c-3.17 5.492-7.795 8.758-10.33 7.294 5.703 3.293 13.143 1.082 16.619-4.938a13.392 13.392 0 001.037-2.255c.259-.738-.092-1.534-.77-1.925l-4.557-2.63z" fill="currentColor"/>
          <path d="M16.59 14.62c3.17-5.492 3.686-11.13 1.15-12.594C15.207.563 10.582 3.83 7.41 9.32c2.074-3.59 5.809-5.315 8.344-3.852 2.534 1.464 2.908 5.56.835 9.151z" fill="currentColor"/>
          <path d="M7.41 9.32c-3.17 5.492-3.686 11.13-1.15 12.593 2.534 1.464 7.159-1.802 10.33-7.294-2.074 3.591-5.809 5.316-8.344 3.852-2.534-1.463-2.908-5.56-.835-9.15z" fill="currentColor"/>
        </svg>
      )
    case 'gpt-image':
      return (
        <svg viewBox="0 0 1024 1024" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M470.196706 60.235294c58.127059 0.843294 112.579765 22.889412 157.214118 66.981647 6.625882 6.445176 12.348235 8.011294 21.142588 6.746353 128.120471-17.829647 240.519529 62.042353 264.071529 187.512471 6.144 32.948706 4.216471 65.837176-5.360941 98.002823-2.409412 7.830588-0.843294 12.830118 4.336941 19.034353 106.014118 128.301176 42.586353 322.258824-119.386353 364.483765-9.276235 2.349176-13.312 6.505412-16.50447 14.757647-60.235294 154.383059-262.384941 195.945412-380.265412 78.185412-5.903059-5.842824-10.902588-7.047529-18.913882-5.963294-129.927529 18.070588-242.447059-61.861647-265.697883-188.717177a204.197647 204.197647 0 0 1 5.722353-96.798118c2.409412-7.830588 0.843294-12.830118-4.21647-19.034352C6.023529 457.005176 70.475294 261.662118 233.110588 220.461176c8.131765-2.048 11.866353-5.541647 14.817883-12.950588C282.864941 117.217882 367.856941 59.813647 470.196706 60.235294z m140.830118 555.971765c-73.487059 41.803294-144.564706 81.980235-215.160471 122.88-15.962353 9.216-29.515294 8.975059-45.477647-0.301177-55.356235-32.286118-111.073882-63.608471-166.79153-95.111529-4.035765-2.228706-7.408941-6.746353-13.854117-4.818824-7.529412 67.102118 13.733647 123.000471 69.571765 162.635295 56.32 39.875765 118.181647 44.875294 179.501176 12.830117 62.704941-32.707765 123.361882-69.451294 184.801882-104.508235 3.493647-1.927529 7.408941-3.433412 7.408942-8.553412V616.207059z m-39.152942-456.824471c-1.445647-4.818824-5.059765-6.204235-7.830588-8.192-56.018824-37.345882-115.651765-43.369412-176.188235-13.914353-61.018353 29.816471-93.485176 80.715294-95.292235 147.998118-1.807059 68.367059-0.301176 136.734118-0.722824 205.040941 0 7.288471 2.529882 11.143529 8.794353 14.456471 20.600471 11.203765 40.96 23.070118 61.199059 34.514823 2.529882 1.385412 4.818824 4.457412 8.975059 1.807059 0-80.896 0.301176-162.213647-0.120471-243.531294-0.180706-16.685176 6.264471-27.467294 20.961882-35.599059 42.586353-23.612235 84.690824-47.947294 126.976-72.101647 17.769412-10.059294 35.538824-20.419765 53.187765-30.479059z m81.016471 320.150588v17.648942c0 76.8-0.120471 153.660235 0.120471 230.460235 0.180706 15.600941-5.722353 26.202353-19.576471 33.671529-19.456 10.480941-38.490353 21.684706-57.645177 32.527059-41.321412 23.672471-82.763294 47.284706-128 73.065412 3.915294 1.385412 5.903059 1.686588 7.288471 2.770823 51.922824 37.406118 108.664471 45.959529 168.116706 22.528 59.512471-23.491765 97.882353-68.065882 105.170823-130.891294 8.794353-76.739765 1.807059-154.383059 3.192471-231.54447 0.180706-4.156235-1.807059-6.505412-5.180235-8.432941-23.792941-13.492706-47.405176-27.045647-73.487059-41.803295zM553.923765 375.145412c5.722353 3.433412 9.637647 5.662118 13.43247 7.830588 67.764706 38.731294 135.408941 77.522824 203.414589 115.712 14.697412 8.312471 21.022118 19.275294 20.901647 35.779765-0.481882 63.909647-0.180706 127.879529-0.180706 191.789176 0 4.698353 0.421647 9.216 0.722823 14.878118 3.493647-1.204706 5.601882-1.927529 7.710118-2.770824 60.837647-27.888941 96.978824-74.691765 102.761412-140.348235 6.023529-68.065882-21.564235-122.759529-80.77553-158.780235-59.632941-36.321882-121.253647-69.451294-181.910588-104.207059-5.300706-3.072-9.216-3.493647-14.817882-0.301177-22.949647 13.251765-46.200471 26.081882-71.258353 40.417883zM232.207059 284.431059c-6.324706-0.783059-10.059294 2.108235-14.034824 4.035765-57.946353 28.672-91.798588 75.113412-97.159529 138.541176-5.421176 65.897412 20.48 120.048941 77.161412 155.407059 60.777412 37.767529 124.205176 71.619765 186.368 107.218823 3.614118 2.108235 6.987294 3.915294 11.203764 1.385412l73.60753-42.10447-12.709647-7.710118c-67.764706-38.671059-135.408941-77.462588-203.474824-115.59153-15.239529-8.553412-21.383529-19.696941-21.263059-36.864 0.602353-67.764706 0.301176-135.710118 0.301177-204.318117z m180.705882 122.639059c5.903059-3.011765 9.818353-4.999529 13.613177-7.228236 67.041882-38.068706 134.264471-75.896471 200.884706-114.688 15.962353-9.276235 29.515294-9.517176 45.537882-0.301176 56.139294 32.707765 112.64 64.451765 169.08047 96.496941 3.373176 1.927529 6.204235 5.541647 11.926589 3.855059 7.408941-65.656471-12.769882-121.193412-67.222589-160.948706-56.560941-41.441882-119.145412-47.104-181.549176-14.637176-62.765176 32.707765-123.361882 69.451294-184.922353 104.387764-3.553882 1.927529-7.348706 3.614118-7.348706 8.673883v84.329411z m198.174118 108.604235c0-18.913882-0.481882-34.635294 0.12047-50.236235 0.240941-7.228235-2.108235-11.324235-8.553411-14.757647-28.009412-15.480471-55.898353-31.322353-83.425883-47.525647-5.360941-3.132235-9.276235-3.132235-14.697411-0.120471a3800.847059 3800.847059 0 0 1-83.486118 47.525647c-6.445176 3.614118-8.432941 7.710118-8.432941 14.878118 0.481882 30.780235 0.602353 61.741176 0 92.521411-0.120471 8.432941 3.011765 12.830118 10.24 16.564706 13.312 6.746353 25.901176 14.637176 38.972235 21.925647 16.504471 9.276235 33.008941 25.961412 49.392941 25.840942 17.106824-0.120471 34.032941-16.444235 50.838588-25.840942 16.082824-9.095529 37.225412-15.179294 46.381177-28.852706 9.336471-14.456471 1.626353-36.562824 2.590118-51.922823z" fill="currentColor"/>
        </svg>
      )
  }
}


export function LandingModelShowcase({ locale }: LandingModelShowcaseProps) {
  const isZh = locale.toLowerCase().startsWith('zh')
  const cards = getPrimaryModelCards(isZh)
  const matrixModels = getMatrixModels()
  
  // Refs for tracking DOM elements without directly querying the DOM
  const sectionRef = useRef<HTMLElement | null>(null)
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  const overlayRefs = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    // Cache bgSystem ref once — never query inside scroll handler
    const bgSystem = document.querySelector('[class*="backgroundSystem"]') as HTMLElement | null

    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true

      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY
        const vh = window.innerHeight

        // Darken bg via opacity only (no blur/brightness — GPU friendly)
        if (bgSystem) {
          if (scrollY > 10) {
            const darkProgress = Math.min(1, scrollY / (vh * 0.9))
            bgSystem.style.opacity = Math.max(0.18, 1 - darkProgress * 0.82).toString()
          } else {
            bgSystem.style.opacity = '1'
          }
        }

        // Card stacking animation
        const activeCards = cardRefs.current.filter(Boolean) as HTMLElement[]
        const activeOverlays = overlayRefs.current.filter(Boolean) as HTMLDivElement[]

        if (activeCards.length > 0) {
          const stickyTop = vh * 0.12

          for (let i = 0; i < activeCards.length - 1; i++) {
            const currentCard = activeCards[i]
            const nextCard = activeCards[i + 1]
            const currentOverlay = activeOverlays[i]

            const nextTop = nextCard.getBoundingClientRect().top
            const distance = nextTop - stickyTop
            const maxDistance = vh - stickyTop

            if (distance < maxDistance && distance > 0) {
              let progress = 1 - distance / maxDistance
              progress = Math.max(0, Math.min(1, progress))
              const easeProgress = Math.pow(progress, 1.5)

              const scale = 1 - easeProgress * 0.05
              const yOffset = easeProgress * -20
              const opacity = easeProgress * 0.6

              currentCard.style.transform = `scale(${scale}) translateY(${yOffset}px)`
              if (currentOverlay) currentOverlay.style.opacity = opacity.toString()
            } else if (distance <= 0) {
              currentCard.style.transform = `scale(0.95) translateY(-20px)`
              if (currentOverlay) currentOverlay.style.opacity = '0.6'
            } else {
              currentCard.style.transform = 'scale(1) translateY(0)'
              if (currentOverlay) currentOverlay.style.opacity = '0'
            }
          }
        }

        ticking = false
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const matrixTitle = isZh ? '模型生态矩阵' : 'Model Ecosystem Matrix'
  const matrixDescription = isZh
    ? '把常用视觉模型统一纳入一套工作流里，切换模型时依然保持创作节奏与结果一致性。'
    : 'Bring the most-used visual models into one workflow so you can switch engines without breaking momentum or consistency.'

  return (
    <section ref={sectionRef} className={styles.modelShowcaseSection}>
      <div className={styles.modelShowcaseIntro}>
        <h2 className={styles.modelShowcaseTitle}>
          {isZh ? '顶级模型引擎' : 'Premier Model Engines'}
        </h2>
      </div>

      <div className={styles.modelStackingWrapper}>
        {cards.map((card, index) => (
          <article
            key={card.id}
            ref={(node) => { cardRefs.current[index] = node }}
            className={`${styles.stackCard} ${index === 0 ? styles.stackCardFirst : styles.stackCardSecond}`}
            style={{
              '--model-card-accent': card.accent,
            } as CSSProperties}
          >
            {/* 动态覆盖遮罩，用于模拟被盖住时的阴影变暗 */}
            <div 
              ref={(node) => { overlayRefs.current[index] = node }} 
              className={styles.cardOverlay} 
            />

            <div className={styles.cinematicInner}>
              {/* 左侧文字区 */}
              <div className={styles.infoCol}>
                <div className={styles.modelCompanyTag}>
                  <span className={styles.modelCompanyGlyph}>
                    {renderShowcaseIcon(card.iconName, styles.modelCompanyIcon)}
                  </span>
                  <span>{card.company}</span>
                </div>

                <div className={styles.modelTitleRow}>
                  <span className={styles.modelIconBadge}>
                    {renderShowcaseIcon(card.iconName, styles.modelIconGlyph)}
                  </span>
                  <h3 className={styles.modelCardTitle}>{card.title}</h3>
                </div>

                <p className={styles.modelCardDescription}>{card.description}</p>

                <div className={styles.modelFeatureList}>
                  {card.features.map((feature) => (
                    <span key={feature} className={styles.modelFeatureTag}>
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* 右侧悬浮玻璃视窗与真实案例图 */}
              <div className={styles.showcaseCol}>
                <div className={styles.glassWindow}>
                  <img src={card.showcaseImage} alt={card.title} className={styles.showcaseImage} />
                  <div className={styles.showcaseBadge}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    {card.showcaseBadge}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}

        {/* 第 3 张卡片：生态矩阵 */}
        <article
          ref={(node) => { cardRefs.current[cards.length] = node }}
          className={`${styles.stackCard} ${styles.stackCardThird}`}
        >
          <div className={styles.cinematicInner}>
            <div className={styles.infoCol} style={{ flex: '0 0 35%' }}>
              <div className={styles.modelTitleRow}>
                <span className={styles.modelIconBadge} style={{ '--model-card-accent': '#A78BFA' } as CSSProperties}>
                  {renderShowcaseIcon('matrix', styles.modelIconGlyph)}
                </span>
                <h3 className={styles.modelCardTitle}>{matrixTitle}</h3>
              </div>
              <p className={styles.modelCardDescription}>{matrixDescription}</p>
              <div className={styles.modelFeatureList}>
                <span className={styles.modelFeatureTag}>{isZh ? '一站式调用' : 'Unified access'}</span>
                <span className={styles.modelFeatureTag}>{isZh ? '混合工作流' : 'Hybrid workflows'}</span>
              </div>
            </div>

            <div className={styles.showcaseCol} style={{ flex: '0 0 65%', padding: '0', display: 'flex', alignItems: 'center' }}>
              <div className={styles.modelMatrixViewport}>
                <div className={styles.modelMatrixTrack}>
                  {[...matrixModels, ...matrixModels].map((model, index) => (
                    <span
                      key={`${model.id}-track-a-${index}`}
                      className={styles.modelMatrixPill}
                      style={{ '--matrix-pill-accent': model.accent, '--matrix-pill-accent-soft': model.accentSoft } as CSSProperties}
                    >
                      <span className={styles.modelMatrixPillIcon}>
                        {renderShowcaseIcon(model.iconName, styles.modelMatrixPillGlyph)}
                      </span>
                      <span>{model.label}</span>
                    </span>
                  ))}
                </div>
                <div className={`${styles.modelMatrixTrack} ${styles.modelMatrixTrackReverse}`}>
                  {[...matrixModels.slice().reverse(), ...matrixModels.slice().reverse()].map((model, index) => (
                    <span
                      key={`${model.id}-track-b-${index}`}
                      className={styles.modelMatrixPill}
                      style={{ '--matrix-pill-accent': model.accent, '--matrix-pill-accent-soft': model.accentSoft } as CSSProperties}
                    >
                      <span className={styles.modelMatrixPillIcon}>
                        {renderShowcaseIcon(model.iconName, styles.modelMatrixPillGlyph)}
                      </span>
                      <span>{model.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}