import type {
  ExtraCreditsConfig,
  ExtraCreditsLegacyConfig,
  ExtraCreditsRule,
  ExtraCreditsRuleCondition,
  ExtraCreditsRuleGroup,
  ExtraCreditsRuleSet,
} from '@/lib/types/extraCredits'

const GROUP_VARIABLE_PARAMETER_PRIORITY = [
  'duration',
  'resolution',
  'imageSize',
  'size',
  'aspectRatio',
  'ratio',
]

/**
 * 计算额外积分
 * 根据模型配置的 extraCreditsConfig 和任务参数计算额外积分
 *
 * @param extraCreditsConfig 模型配置的额外积分配置
 * @param parameters 任务参数（包含 resolution, duration, imageSize, size 等）
 * @returns 额外积分数量
 */
export function calculateExtraCredits(
  extraCreditsConfig: ExtraCreditsConfig | null | undefined,
  parameters: Record<string, unknown> | null | undefined,
): number {
  if (!extraCreditsConfig || !parameters) {
    return 0
  }

  if (isExtraCreditsRuleSet(extraCreditsConfig)) {
    return calculateRuleBasedExtraCredits(extraCreditsConfig, parameters)
  }

  if (isExtraCreditsLegacyConfig(extraCreditsConfig)) {
    return calculateLegacyExtraCredits(extraCreditsConfig, parameters)
  }

  return 0
}

function calculateLegacyExtraCredits(
  extraCreditsConfig: ExtraCreditsLegacyConfig,
  parameters: Record<string, unknown>,
) {
  let extraCredits = 0

  // 遍历配置中的每个参数类型（如 resolution, duration, imageSize, size 等）
  for (const [paramKey, valueMap] of Object.entries(extraCreditsConfig)) {
    if (!valueMap || typeof valueMap !== 'object') continue

    // 获取任务参数中对应的值
    const paramValue = parameters[paramKey]
    if (paramValue === undefined || paramValue === null) continue

    // 将参数值转为字符串进行匹配
    const valueStr = String(paramValue)

    // 查找配置中对应的额外积分
    if (valueStr in valueMap) {
      const credit = valueMap[valueStr]
      if (typeof credit === 'number' && credit > 0) {
        extraCredits += credit
      }
    }
  }

  return extraCredits
}

function calculateRuleBasedExtraCredits(
  extraCreditsConfig: ExtraCreditsRuleSet,
  parameters: Record<string, unknown>,
) {
  let extraCredits = 0

  for (const rule of extraCreditsConfig.rules) {
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) continue
    if (typeof rule.credits !== 'number' || rule.credits <= 0) continue

    const isMatched = rule.conditions.every((condition) => {
      if (typeof condition?.parameter !== 'string' || typeof condition?.value !== 'string') {
        return false
      }

      const parameterValue = parameters[condition.parameter]
      if (parameterValue === undefined || parameterValue === null) return false

      return String(parameterValue) === condition.value
    })

    if (isMatched) {
      extraCredits += rule.credits
    }
  }

  return extraCredits
}

/**
 * 计算总积分消耗
 *
 * @param baseCredits 基础积分
 * @param extraCreditsConfig 额外积分配置
 * @param parameters 任务参数
 * @returns 总积分消耗
 */
export function calculateTotalCredits(
  baseCredits: number,
  extraCreditsConfig: ExtraCreditsConfig | null | undefined,
  parameters: Record<string, unknown> | null | undefined,
): number {
  const extraCredits = calculateExtraCredits(extraCreditsConfig, parameters)
  return baseCredits + extraCredits
}

export function normalizeExtraCreditsRules(
  extraCreditsConfig: ExtraCreditsConfig | null | undefined,
): ExtraCreditsRule[] {
  if (!extraCreditsConfig) return []

  if (isExtraCreditsRuleSet(extraCreditsConfig)) {
    return extraCreditsConfig.rules.map((rule) => ({
      conditions: Array.isArray(rule.conditions)
        ? rule.conditions.map((condition) => ({
            parameter: String(condition?.parameter ?? ''),
            value: String(condition?.value ?? ''),
          }))
        : [],
      credits: typeof rule.credits === 'number' ? rule.credits : 0,
    }))
  }

  if (!isExtraCreditsLegacyConfig(extraCreditsConfig)) {
    return []
  }

  const rules: ExtraCreditsRule[] = []

  Object.entries(extraCreditsConfig).forEach(([parameter, valueMap]) => {
    if (!valueMap || typeof valueMap !== 'object') return

    Object.entries(valueMap).forEach(([value, credits]) => {
      rules.push({
        conditions: [{ parameter, value }],
        credits: typeof credits === 'number' ? credits : 0,
      })
    })
  })

  return rules
}

function normalizeRuleCondition(
  condition: Partial<ExtraCreditsRuleCondition> | null | undefined,
): ExtraCreditsRuleCondition {
  return {
    parameter: String(condition?.parameter ?? '').trim(),
    value: String(condition?.value ?? '').trim(),
  }
}

function resolveRuleVariableConditionIndex(conditions: ExtraCreditsRuleCondition[]) {
  if (conditions.length === 0) return -1

  for (const parameter of GROUP_VARIABLE_PARAMETER_PRIORITY) {
    const preferredIndex = conditions.findIndex((condition) => condition.parameter === parameter)
    if (preferredIndex >= 0) return preferredIndex
  }

  for (let index = conditions.length - 1; index >= 0; index -= 1) {
    if (conditions[index].parameter) return index
  }

  return conditions.length - 1
}

function buildRuleGroupKey(group: Pick<ExtraCreditsRuleGroup, 'variableParameter' | 'fixedConditions'>) {
  const normalizedFixedConditions = group.fixedConditions
    .map(normalizeRuleCondition)
    .sort((left, right) => {
      const leftKey = `${left.parameter}=${left.value}`
      const rightKey = `${right.parameter}=${right.value}`
      return leftKey.localeCompare(rightKey)
    })
    .map((condition) => `${condition.parameter}=${condition.value}`)
    .join('&')

  return `${group.variableParameter.trim()}::${normalizedFixedConditions}`
}

export function groupExtraCreditsRules(
  rules: ExtraCreditsRule[] | null | undefined,
): ExtraCreditsRuleGroup[] {
  if (!Array.isArray(rules) || rules.length === 0) return []

  const groups = new Map<string, ExtraCreditsRuleGroup>()

  rules.forEach((rule) => {
    const rawConditions = Array.isArray(rule.conditions) && rule.conditions.length > 0
      ? rule.conditions.map((condition) => normalizeRuleCondition(condition))
      : [{ parameter: '', value: '' }]

    const variableConditionIndex = resolveRuleVariableConditionIndex(rawConditions)
    const variableCondition =
      variableConditionIndex >= 0
        ? rawConditions[variableConditionIndex]
        : { parameter: '', value: '' }
    const fixedConditions = rawConditions.filter((_, index) => index !== variableConditionIndex)
    const nextGroup: ExtraCreditsRuleGroup = {
      variableParameter: variableCondition.parameter,
      fixedConditions,
      items: [
        {
          value: variableCondition.value,
          credits: typeof rule.credits === 'number' && Number.isFinite(rule.credits) ? rule.credits : 0,
        },
      ],
    }

    const groupKey = buildRuleGroupKey(nextGroup)
    const existingGroup = groups.get(groupKey)
    if (existingGroup) {
      existingGroup.items.push(nextGroup.items[0])
      return
    }

    groups.set(groupKey, nextGroup)
  })

  return Array.from(groups.values())
}

export function flattenExtraCreditsRuleGroups(
  groups: ExtraCreditsRuleGroup[] | null | undefined,
): ExtraCreditsRule[] {
  if (!Array.isArray(groups) || groups.length === 0) return []

  return groups.flatMap((group) => {
    const fixedConditions = Array.isArray(group.fixedConditions) && group.fixedConditions.length > 0
      ? group.fixedConditions.map((condition) => normalizeRuleCondition(condition))
      : []
    const variableParameter = String(group.variableParameter ?? '').trim()
    const items = Array.isArray(group.items) && group.items.length > 0
      ? group.items
      : [{ value: '', credits: 0 }]

    return items.map((item) => ({
      conditions: [
        ...fixedConditions,
        {
          parameter: variableParameter,
          value: String(item?.value ?? '').trim(),
        },
      ],
      credits: typeof item?.credits === 'number' && Number.isFinite(item.credits)
        ? item.credits
        : 0,
    }))
  })
}

export function buildExtraCreditsConfigFromRules(
  rules: ExtraCreditsRule[],
): { config: ExtraCreditsConfig | null; error: string | null } {
  const normalizedRules: ExtraCreditsRule[] = []
  const ruleSignatures = new Set<string>()

  for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
    const rule = rules[ruleIndex]
    const credits = Number(rule.credits)
    const hasRawConditionInput = rule.conditions.some(
      (condition) => String(condition.parameter || '').trim() || String(condition.value || '').trim(),
    )

    if (!Number.isFinite(credits) || !Number.isInteger(credits) || credits < 0) {
      return { config: null, error: `规则 ${ruleIndex + 1} 的积分必须为非负整数` }
    }

    const normalizedConditions = rule.conditions
      .map((condition) => ({
        parameter: String(condition.parameter || '').trim(),
        value: String(condition.value || '').trim(),
      }))
      .filter((condition) => condition.parameter || condition.value)

    if (normalizedConditions.length === 0) {
      if (credits > 0 || hasRawConditionInput) {
        return { config: null, error: `规则 ${ruleIndex + 1} 的条件不能为空` }
      }
      continue
    }

    if (normalizedConditions.some((condition) => !condition.parameter || !condition.value)) {
      return { config: null, error: `规则 ${ruleIndex + 1} 的条件不能为空` }
    }

    const parameterSet = new Set<string>()
    for (const condition of normalizedConditions) {
      if (parameterSet.has(condition.parameter)) {
        return { config: null, error: `规则 ${ruleIndex + 1} 存在重复参数` }
      }
      parameterSet.add(condition.parameter)
    }

    const signature = normalizedConditions
      .map((condition) => `${condition.parameter}=${condition.value}`)
      .sort()
      .join('&')

    if (ruleSignatures.has(signature)) {
      return { config: null, error: `存在重复的额外积分规则` }
    }
    ruleSignatures.add(signature)

    normalizedRules.push({
      conditions: normalizedConditions,
      credits,
    })
  }

  if (normalizedRules.length === 0) {
    return { config: null, error: null }
  }

  return {
    config: {
      version: 2,
      rules: normalizedRules,
    },
    error: null,
  }
}

function isExtraCreditsRuleSet(config: ExtraCreditsConfig): config is ExtraCreditsRuleSet {
  return typeof config === 'object'
    && config !== null
    && 'version' in config
    && 'rules' in config
    && Array.isArray((config as ExtraCreditsRuleSet).rules)
}

function isExtraCreditsLegacyConfig(config: ExtraCreditsConfig): config is ExtraCreditsLegacyConfig {
  return typeof config === 'object'
    && config !== null
    && !Array.isArray(config)
    && !('rules' in config)
}
