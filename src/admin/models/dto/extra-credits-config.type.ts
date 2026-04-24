export type ExtraCreditsLegacyConfig = Record<string, Record<string, number>>;

export type ExtraCreditsRuleCondition = {
  parameter: string;
  value: string;
};

export type ExtraCreditsRule = {
  conditions: ExtraCreditsRuleCondition[];
  credits: number;
};

export type ExtraCreditsRuleSet = {
  version: 2;
  rules: ExtraCreditsRule[];
};

export type ExtraCreditsConfig = ExtraCreditsLegacyConfig | ExtraCreditsRuleSet;
