import type {
  ExtraCreditsConfig,
  ExtraCreditsLegacyConfig,
  ExtraCreditsRuleSet,
} from '../../admin/models/dto/extra-credits-config.type';

/**
 * 计算额外积分
 * 根据模型配置的 extraCreditsConfig 和任务参数计算额外积分
 *
 * @param extraCreditsConfig 模型配置的额外积分配置
 * @param parameters 任务参数（包含 resolution, duration, imageSize, size 等）
 * @returns 额外积分数量
 *
 * @example
 * // 模型配置（旧版）
 * extraCreditsConfig = {
 *   imageSize: { "4K": 5, "2K": 0 },
 *   resolution: { "1080p": 1, "720p": 0 },
 *   duration: { "10": 1, "5": 0, "6": 0 }
 * }
 *
 * // 模型配置（新版）
 * extraCreditsConfig = {
 *   version: 2,
 *   rules: [
 *     {
 *       conditions: [
 *         { parameter: "resolution", value: "1080p" },
 *         { parameter: "duration", value: "5" }
 *       ],
 *       credits: 5
 *     },
 *     {
 *       conditions: [
 *         { parameter: "resolution", value: "720p" },
 *         { parameter: "duration", value: "5" }
 *       ],
 *       credits: 2
 *     }
 *   ]
 * }
 *
 * // 任务参数
 * parameters = { imageSize: "4K" }
 * // 返回: 5
 *
 * parameters = { resolution: "1080p", duration: "10" }
 * // 返回: 2 (1 + 1)
 */
export function calculateExtraCredits(
  extraCreditsConfig: ExtraCreditsConfig | null | undefined,
  parameters: Record<string, unknown> | null | undefined,
): number {
  if (!extraCreditsConfig || !parameters) {
    return 0;
  }

  if (isExtraCreditsRuleSet(extraCreditsConfig)) {
    return calculateRuleBasedExtraCredits(extraCreditsConfig, parameters);
  }

  if (isExtraCreditsLegacyConfig(extraCreditsConfig)) {
    return calculateLegacyExtraCredits(extraCreditsConfig, parameters);
  }

  return 0;
}

function calculateLegacyExtraCredits(
  extraCreditsConfig: ExtraCreditsLegacyConfig,
  parameters: Record<string, unknown>,
) {
  let extraCredits = 0;

  // 遍历配置中的每个参数类型（如 resolution, duration, imageSize, size 等）
  for (const [paramKey, valueMap] of Object.entries(extraCreditsConfig)) {
    if (!valueMap || typeof valueMap !== 'object') continue;

    // 获取任务参数中对应的值
    const paramValue = parameters[paramKey];
    if (paramValue === undefined || paramValue === null) continue;

    // 将参数值转为字符串进行匹配
    const valueStr = String(paramValue);

    // 查找配置中对应的额外积分
    if (valueStr in valueMap) {
      const credit = valueMap[valueStr];
      if (typeof credit === 'number' && credit > 0) {
        extraCredits += credit;
      }
    }
  }

  return extraCredits;
}

function calculateRuleBasedExtraCredits(
  extraCreditsConfig: ExtraCreditsRuleSet,
  parameters: Record<string, unknown>,
) {
  let extraCredits = 0;

  for (const rule of extraCreditsConfig.rules) {
    if (!rule || typeof rule !== 'object') continue;
    if (!Array.isArray(rule.conditions) || rule.conditions.length === 0) continue;
    if (typeof rule.credits !== 'number' || rule.credits <= 0) continue;

    const isMatched = rule.conditions.every((condition) => {
      if (!condition || typeof condition !== 'object') return false;
      if (typeof condition.parameter !== 'string' || typeof condition.value !== 'string') return false;

      const parameterValue = parameters[condition.parameter];
      if (parameterValue === undefined || parameterValue === null) return false;

      return String(parameterValue) === condition.value;
    });

    if (isMatched) {
      extraCredits += rule.credits;
    }
  }

  return extraCredits;
}

function isExtraCreditsRuleSet(config: ExtraCreditsConfig): config is ExtraCreditsRuleSet {
  return typeof config === 'object'
    && config !== null
    && 'version' in config
    && 'rules' in config
    && Array.isArray((config as ExtraCreditsRuleSet).rules);
}

function isExtraCreditsLegacyConfig(config: ExtraCreditsConfig): config is ExtraCreditsLegacyConfig {
  return typeof config === 'object'
    && config !== null
    && !Array.isArray(config)
    && !('rules' in config);
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
  const extraCredits = calculateExtraCredits(extraCreditsConfig, parameters);
  return baseCredits + extraCredits;
}
