/**
 * 预定义创作模板
 * 帮助新手快速开始创作
 */

import type { CreationTemplate, TemplateCategory } from '../types/templates'

export const CREATION_TEMPLATES: CreationTemplate[] = [
  // 人物肖像模板
  {
    id: 'portrait-professional',
    category: 'portrait',
    type: 'image',
    name: '专业肖像',
    description: '生成高质量的专业人物肖像照片',
    icon: '👔',
    preview: '/templates/portrait-professional.jpg',
    config: {
      provider: 'gemini',
      operation: 'imagine',
      aspectRatio: '3:4',
      negativePrompt: 'blurry, low quality, distorted, cartoon',
    },
    examplePrompts: [
      '一位穿着职业装的年轻女性，自信的微笑，办公室背景，专业摄影',
      '商务男士证件照，正面，白色背景，高清画质',
      '时尚人像，优雅女性，柔和光线，浅灰色背景',
    ],
    tags: ['证件照', '商务', '专业'],
    difficulty: 'beginner',
  },
  {
    id: 'portrait-artistic',
    category: 'portrait',
    type: 'image',
    name: '艺术人像',
    description: '创造性艺术风格的人物肖像',
    icon: '🎭',
    preview: '/templates/portrait-artistic.jpg',
    config: {
      provider: 'midjourney',
      operation: 'imagine',
      aspectRatio: '2:3',
      negativePrompt: 'photograph, realistic',
    },
    examplePrompts: [
      '油画风格的古典美女肖像，文艺复兴画风',
      '水彩画风格，梦幻少女，柔和色调',
      '赛博朋克风格人物，霓虹灯光，未来感',
    ],
    tags: ['艺术', '创意', '风格化'],
    difficulty: 'intermediate',
  },

  // 风景照片模板
  {
    id: 'landscape-nature',
    category: 'landscape',
    type: 'image',
    name: '自然风光',
    description: '壮丽的自然景观摄影',
    icon: '⛰️',
    preview: '/templates/landscape-nature.jpg',
    config: {
      provider: 'gemini',
      operation: 'imagine',
      aspectRatio: '16:9',
      negativePrompt: 'people, buildings, urban',
    },
    examplePrompts: [
      '日落时分的雪山，金色阳光，倒映在湖面，8k高清摄影',
      '茂密的热带雨林，阳光穿过树叶，雾气缭绕',
      '北极光下的冰岛风光，星空，长曝光摄影',
    ],
    tags: ['自然', '风光', '摄影'],
    difficulty: 'beginner',
  },
  {
    id: 'landscape-city',
    category: 'landscape',
    type: 'image',
    name: '城市景观',
    description: '现代都市建筑与夜景',
    icon: '🌃',
    preview: '/templates/landscape-city.jpg',
    config: {
      provider: 'gemini',
      operation: 'imagine',
      aspectRatio: '16:9',
      negativePrompt: 'daytime, rural, natural',
    },
    examplePrompts: [
      '未来感科技城市夜景，摩天大楼，霓虹灯光',
      '东京街道夜景，雨后倒影，赛博朋克风格',
      '纽约曼哈顿天际线，黄昏，航拍视角',
    ],
    tags: ['城市', '建筑', '夜景'],
    difficulty: 'beginner',
  },

  // 产品摄影模板
  {
    id: 'product-simple',
    category: 'product',
    type: 'image',
    name: '简约产品',
    description: '干净简洁的产品展示照片',
    icon: '📱',
    preview: '/templates/product-simple.jpg',
    config: {
      provider: 'flux',
      operation: 'imagine',
      aspectRatio: '1:1',
      negativePrompt: 'cluttered, messy, dark',
    },
    examplePrompts: [
      '白色背景上的智能手机产品图，柔和光线，高清细节',
      '化妆品产品摄影，纯色背景，工作室灯光',
      '运动鞋产品展示，白色背景，专业摄影',
    ],
    tags: ['产品', '电商', '简洁'],
    difficulty: 'beginner',
  },
  {
    id: 'product-lifestyle',
    category: 'product',
    type: 'image',
    name: '生活场景',
    description: '产品在真实场景中的应用',
    icon: '☕',
    preview: '/templates/product-lifestyle.jpg',
    config: {
      provider: 'gemini',
      operation: 'imagine',
      aspectRatio: '4:3',
      negativePrompt: 'plain background, studio',
    },
    examplePrompts: [
      '咖啡杯放在木质桌面上，早晨阳光，温馨氛围',
      '笔记本电脑在咖啡厅场景，自然光线',
      '护肤品在浴室场景，绿植装饰，清新感',
    ],
    tags: ['产品', '场景', '生活化'],
    difficulty: 'intermediate',
  },

  // 艺术创作模板
  {
    id: 'art-abstract',
    category: 'art',
    type: 'image',
    name: '抽象艺术',
    description: '现代抽象艺术作品',
    icon: '🌈',
    preview: '/templates/art-abstract.jpg',
    config: {
      provider: 'midjourney',
      operation: 'imagine',
      aspectRatio: '1:1',
    },
    examplePrompts: [
      '抽象色彩流动，渐变效果，现代艺术风格',
      '几何形状组合，明亮色彩，极简主义',
      '液体艺术，色彩爆炸，动态效果',
    ],
    tags: ['艺术', '抽象', '创意'],
    difficulty: 'intermediate',
  },
  {
    id: 'art-illustration',
    category: 'art',
    type: 'image',
    name: '插画设计',
    description: '扁平化风格插画',
    icon: '✏️',
    preview: '/templates/art-illustration.jpg',
    config: {
      provider: 'flux',
      operation: 'imagine',
      aspectRatio: '1:1',
      negativePrompt: 'realistic, photograph',
    },
    examplePrompts: [
      '扁平化风格城市插画，明亮色彩，简洁设计',
      '可爱卡通动物插画，儿童绘本风格',
      '科技感UI插画，渐变色，现代设计',
    ],
    tags: ['插画', '设计', '扁平化'],
    difficulty: 'beginner',
  },

]

// 按分类获取模板
export function getTemplatesByCategory(category: TemplateCategory): CreationTemplate[] {
  return CREATION_TEMPLATES.filter((t) => t.category === category)
}

// 按类型获取模板
export function getTemplatesByType(type: 'image' | 'video'): CreationTemplate[] {
  return CREATION_TEMPLATES.filter((t) => t.type === type)
}

// 按难度获取模板
export function getTemplatesByDifficulty(
  difficulty: 'beginner' | 'intermediate' | 'advanced'
): CreationTemplate[] {
  return CREATION_TEMPLATES.filter((t) => t.difficulty === difficulty)
}
