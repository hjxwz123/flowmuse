type RgbColor = {
  r: number
  g: number
  b: number
}

type ThemeModePalette = {
  solid: string
  hover: string
  onSolid: string
  shadow: string
}

export type ThemeCssPalette = {
  sourceHex: string
  light: ThemeModePalette
  dark: ThemeModePalette
}

const DEFAULT_THEME_COLOR = '#B794F6'
const LIGHT_THEME_BACKGROUND = hexToRgb('#FFFFFF')
const DARK_THEME_BACKGROUND = hexToRgb('#18181B')
const WHITE_TEXT = hexToRgb('#FFFFFF')
const DARK_TEXT = hexToRgb('#0C0A09')
const MIN_THEME_CONTRAST = 4.5

export function normalizeThemeHex(input?: string | null) {
  const value = String(input || '').trim()
  if (!value) return DEFAULT_THEME_COLOR

  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(value)
  if (shortHexMatch) {
    return `#${shortHexMatch[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toUpperCase()
  }

  return DEFAULT_THEME_COLOR
}

export function buildThemeCssPalette(themeColor?: string | null): ThemeCssPalette {
  const sourceHex = normalizeThemeHex(themeColor)
  const sourceRgb = hexToRgb(sourceHex)
  const lightSolid = ensureContrast(sourceRgb, LIGHT_THEME_BACKGROUND, MIN_THEME_CONTRAST, 'darken')
  const darkSolid = ensureContrast(sourceRgb, DARK_THEME_BACKGROUND, MIN_THEME_CONTRAST, 'lighten')
  const lightOnSolid = pickReadableText(lightSolid)
  const darkOnSolid = pickReadableText(darkSolid)

  return {
    sourceHex,
    light: {
      solid: rgbToCssValue(lightSolid),
      hover: rgbToCssValue(buildHoverColor(lightSolid, lightOnSolid)),
      onSolid: rgbToCssValue(lightOnSolid),
      shadow: rgbToCssValue(lightSolid),
    },
    dark: {
      solid: rgbToCssValue(darkSolid),
      hover: rgbToCssValue(buildHoverColor(darkSolid, darkOnSolid)),
      onSolid: rgbToCssValue(darkOnSolid),
      shadow: rgbToCssValue(darkSolid),
    },
  }
}

function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeThemeHex(hex)

  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToCssValue(color: RgbColor) {
  return `${color.r} ${color.g} ${color.b}`
}

function mixRgb(color: RgbColor, target: RgbColor, amount: number): RgbColor {
  const clampedAmount = clamp(amount, 0, 1)

  return {
    r: Math.round(color.r + (target.r - color.r) * clampedAmount),
    g: Math.round(color.g + (target.g - color.g) * clampedAmount),
    b: Math.round(color.b + (target.b - color.b) * clampedAmount),
  }
}

function relativeLuminance(color: RgbColor) {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const srgb = channel / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(foreground: RgbColor, background: RgbColor) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function ensureContrast(
  color: RgbColor,
  background: RgbColor,
  minimumContrast: number,
  direction: 'darken' | 'lighten',
) {
  if (contrastRatio(color, background) >= minimumContrast) {
    return color
  }

  const target = direction === 'darken' ? DARK_TEXT : WHITE_TEXT

  for (let step = 1; step <= 24; step += 1) {
    const candidate = mixRgb(color, target, step / 24)
    if (contrastRatio(candidate, background) >= minimumContrast) {
      return candidate
    }
  }

  return mixRgb(color, target, 1)
}

function pickReadableText(background: RgbColor) {
  const whiteContrast = contrastRatio(WHITE_TEXT, background)
  const darkContrast = contrastRatio(DARK_TEXT, background)
  return whiteContrast >= darkContrast ? WHITE_TEXT : DARK_TEXT
}

function buildHoverColor(base: RgbColor, onSolid: RgbColor) {
  const hoverTarget = onSolid === WHITE_TEXT ? DARK_TEXT : WHITE_TEXT
  return mixRgb(base, hoverTarget, 0.12)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
