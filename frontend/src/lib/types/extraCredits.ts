export type ExtraCreditsLegacyConfig = Record<string, Record<string, number>>

export interface ExtraCreditsRuleCondition {
  parameter: string
  value: string
}

export interface ExtraCreditsRule {
  conditions: ExtraCreditsRuleCondition[]
  credits: number
}

export interface ExtraCreditsRuleGroupItem {
  value: string
  credits: number
}

export interface ExtraCreditsRuleGroup {
  variableParameter: string
  fixedConditions: ExtraCreditsRuleCondition[]
  items: ExtraCreditsRuleGroupItem[]
}

export interface ExtraCreditsRuleSet {
  version: 2
  rules: ExtraCreditsRule[]
}

export type ExtraCreditsConfig = ExtraCreditsLegacyConfig | ExtraCreditsRuleSet
