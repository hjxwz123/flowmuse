'use client'

import { useEffect, useRef, useState } from 'react'

import type {
  ExtraCreditsRule,
  ExtraCreditsRuleCondition,
  ExtraCreditsRuleGroup,
  ExtraCreditsRuleGroupItem,
} from '@/lib/types/extraCredits'
import {
  flattenExtraCreditsRuleGroups,
  groupExtraCreditsRules,
} from '@/lib/utils/extraCredits'
import { cn } from '@/lib/utils'

interface ExtraCreditsConfigEditorProps {
  value: ExtraCreditsRule[]
  onChange: (rules: ExtraCreditsRule[]) => void
  disabled?: boolean
}

interface DurationPricingBuilder {
  start: string
  end: string
  perSecond: string
}

interface EditorRuleGroup extends ExtraCreditsRuleGroup {
  durationPricing: DurationPricingBuilder
}

const PARAMETER_OPTIONS = ['resolution', 'duration', 'imageSize', 'size', 'aspectRatio', 'ratio']
const DEFAULT_DURATION_RANGE_START = '2'
const DEFAULT_DURATION_RANGE_END = '15'

function createEmptyCondition(): ExtraCreditsRuleCondition {
  return {
    parameter: '',
    value: '',
  }
}

function createEmptyItem(): ExtraCreditsRuleGroupItem {
  return {
    value: '',
    credits: 0,
  }
}

function inferDurationPricingBuilder(items: ExtraCreditsRuleGroupItem[]): DurationPricingBuilder {
  const durationRows = items
    .map((item) => {
      const seconds = Number(item.value.trim())
      const credits = Number(item.credits)
      if (!Number.isInteger(seconds) || seconds <= 0) return null
      if (!Number.isFinite(credits) || !Number.isInteger(credits) || credits < 0) return null
      return { seconds, credits }
    })
    .filter((item): item is { seconds: number; credits: number } => item !== null)

  if (durationRows.length === 0) {
    return {
      start: DEFAULT_DURATION_RANGE_START,
      end: DEFAULT_DURATION_RANGE_END,
      perSecond: '',
    }
  }

  const sortedRows = [...durationRows].sort((left, right) => left.seconds - right.seconds)
  let inferredPerSecond = ''

  if (sortedRows.every((row) => row.seconds > 0 && row.credits % row.seconds === 0)) {
    const firstRate = sortedRows[0].credits / sortedRows[0].seconds
    if (sortedRows.every((row) => row.credits / row.seconds === firstRate)) {
      inferredPerSecond = String(firstRate)
    }
  }

  return {
    start: String(sortedRows[0].seconds),
    end: String(sortedRows[sortedRows.length - 1].seconds),
    perSecond: inferredPerSecond,
  }
}

function createEditorRuleGroup(group?: Partial<ExtraCreditsRuleGroup>): EditorRuleGroup {
  const items = Array.isArray(group?.items) && group.items.length > 0
    ? group.items.map((item) => ({
        value: String(item.value ?? ''),
        credits: Number.isFinite(item.credits) ? item.credits : 0,
      }))
    : [createEmptyItem()]

  return {
    variableParameter: String(group?.variableParameter ?? ''),
    fixedConditions: Array.isArray(group?.fixedConditions) && group.fixedConditions.length > 0
      ? group.fixedConditions.map((condition) => ({
          parameter: String(condition.parameter ?? ''),
          value: String(condition.value ?? ''),
        }))
      : [],
    items,
    durationPricing: inferDurationPricingBuilder(items),
  }
}

function buildEditorGroupsFromRules(rules: ExtraCreditsRule[]) {
  return groupExtraCreditsRules(rules).map((group) => createEditorRuleGroup(group))
}

function cloneEditorRuleGroup(group: EditorRuleGroup): EditorRuleGroup {
  return {
    variableParameter: group.variableParameter,
    fixedConditions: group.fixedConditions.map((condition) => ({ ...condition })),
    items: group.items.map((item) => ({ ...item })),
    durationPricing: { ...group.durationPricing },
  }
}

function sortDurationItems(items: ExtraCreditsRuleGroupItem[]) {
  return [...items].sort((left, right) => {
    const leftNumber = Number(left.value.trim())
    const rightNumber = Number(right.value.trim())
    const leftIsNumber = Number.isInteger(leftNumber)
    const rightIsNumber = Number.isInteger(rightNumber)

    if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber
    if (leftIsNumber) return -1
    if (rightIsNumber) return 1
    return left.value.localeCompare(right.value)
  })
}

function flattenEditorGroups(groups: EditorRuleGroup[]) {
  return flattenExtraCreditsRuleGroups(
    groups.map((group) => ({
      variableParameter: group.variableParameter,
      fixedConditions: group.fixedConditions,
      items: group.items,
    })),
  )
}

function summarizeFixedConditions(conditions: ExtraCreditsRuleCondition[]) {
  const normalized = conditions
    .map((condition) => ({
      parameter: condition.parameter.trim(),
      value: condition.value.trim(),
    }))
    .filter((condition) => condition.parameter && condition.value)

  if (normalized.length === 0) return '无固定条件'
  return normalized.map((condition) => `${condition.parameter}=${condition.value}`).join('，')
}

function resolveValuePlaceholder(parameter: string) {
  const normalized = parameter.trim()
  if (normalized === 'duration') return '例如：5'
  if (normalized === 'resolution') return '例如：1080P'
  if (normalized === 'imageSize' || normalized === 'size') return '例如：1024x1024'
  if (normalized === 'aspectRatio' || normalized === 'ratio') return '例如：16:9'
  return '参数值'
}

function isDurationPricingReady(group: EditorRuleGroup) {
  if (group.variableParameter.trim() !== 'duration') return false

  const start = Number(group.durationPricing.start)
  const end = Number(group.durationPricing.end)
  const perSecond = Number(group.durationPricing.perSecond)

  return (
    Number.isInteger(start)
    && Number.isInteger(end)
    && Number.isInteger(perSecond)
    && start > 0
    && end >= start
    && perSecond >= 0
  )
}

export function ExtraCreditsConfigEditor({
  value,
  onChange,
  disabled = false,
}: ExtraCreditsConfigEditorProps) {
  const [groups, setGroups] = useState<EditorRuleGroup[]>(() => buildEditorGroupsFromRules(value))
  const lastCommittedSignatureRef = useRef(JSON.stringify(value))

  useEffect(() => {
    const incomingSignature = JSON.stringify(value)
    if (incomingSignature === lastCommittedSignatureRef.current) return

    setGroups(buildEditorGroupsFromRules(value))
    lastCommittedSignatureRef.current = incomingSignature
  }, [value])

  const commitGroups = (nextGroups: EditorRuleGroup[]) => {
    setGroups(nextGroups)
    const nextRules = flattenEditorGroups(nextGroups)
    lastCommittedSignatureRef.current = JSON.stringify(nextRules)
    onChange(nextRules)
  }

  const handleAddGroup = () => {
    commitGroups([...groups, createEditorRuleGroup()])
  }

  const handleCopyGroup = (groupIndex: number) => {
    const nextGroups = [...groups]
    nextGroups.splice(groupIndex + 1, 0, cloneEditorRuleGroup(groups[groupIndex]))
    commitGroups(nextGroups)
  }

  const handleRemoveGroup = (groupIndex: number) => {
    commitGroups(groups.filter((_, index) => index !== groupIndex))
  }

  const handleGroupChange = (
    groupIndex: number,
    updater: (group: EditorRuleGroup) => EditorRuleGroup,
  ) => {
    commitGroups(
      groups.map((group, index) => (index === groupIndex ? updater(cloneEditorRuleGroup(group)) : group)),
    )
  }

  const handleAddFixedCondition = (groupIndex: number) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      fixedConditions: [...group.fixedConditions, createEmptyCondition()],
    }))
  }

  const handleRemoveFixedCondition = (groupIndex: number, conditionIndex: number) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      fixedConditions: group.fixedConditions.filter((_, index) => index !== conditionIndex),
    }))
  }

  const handleFixedConditionChange = (
    groupIndex: number,
    conditionIndex: number,
    field: 'parameter' | 'value',
    nextValue: string,
  ) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      fixedConditions: group.fixedConditions.map((condition, index) =>
        index === conditionIndex
          ? {
              ...condition,
              [field]: nextValue,
            }
          : condition,
      ),
    }))
  }

  const handleVariableParameterChange = (groupIndex: number, nextValue: string) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      variableParameter: nextValue,
    }))
  }

  const handleAddItem = (groupIndex: number) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      items: [...group.items, createEmptyItem()],
    }))
  }

  const handleCopyItem = (groupIndex: number, itemIndex: number) => {
    handleGroupChange(groupIndex, (group) => {
      const nextItems = [...group.items]
      nextItems.splice(itemIndex + 1, 0, { ...group.items[itemIndex] })
      return {
        ...group,
        items: nextItems,
      }
    })
  }

  const handleRemoveItem = (groupIndex: number, itemIndex: number) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      items: group.items.filter((_, index) => index !== itemIndex).length > 0
        ? group.items.filter((_, index) => index !== itemIndex)
        : [createEmptyItem()],
    }))
  }

  const handleItemChange = (
    groupIndex: number,
    itemIndex: number,
    field: 'value' | 'credits',
    nextValue: string,
  ) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      items: group.items.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              [field]: field === 'credits'
                ? (nextValue === '' ? 0 : Number(nextValue))
                : nextValue,
            }
          : item,
      ),
    }))
  }

  const handleDurationPricingFieldChange = (
    groupIndex: number,
    field: keyof DurationPricingBuilder,
    nextValue: string,
  ) => {
    handleGroupChange(groupIndex, (group) => ({
      ...group,
      durationPricing: {
        ...group.durationPricing,
        [field]: nextValue,
      },
    }))
  }

  const handleGenerateDurationItems = (groupIndex: number) => {
    handleGroupChange(groupIndex, (group) => {
      if (!isDurationPricingReady(group)) return group

      const start = Number(group.durationPricing.start)
      const end = Number(group.durationPricing.end)
      const perSecond = Number(group.durationPricing.perSecond)
      const nextItems = [...group.items]

      for (let second = start; second <= end; second += 1) {
        const value = String(second)
        const existingIndex = nextItems.findIndex((item) => item.value.trim() === value)
        const nextItem = {
          value,
          credits: second * perSecond,
        }

        if (existingIndex >= 0) {
          nextItems[existingIndex] = nextItem
        } else {
          nextItems.push(nextItem)
        }
      }

      return {
        ...group,
        items: sortDurationItems(nextItems),
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="block font-ui text-sm font-medium text-stone-700">
              额外积分规则
            </label>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              先固定一组条件，再集中编辑某个参数下的价格表。保存时会自动展开成兼容后端的规则数组。
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddGroup}
            disabled={disabled}
            className={cn(
              'rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors',
              'hover:border-aurora-purple hover:text-aurora-purple',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            添加条件组
          </button>
        </div>
      </div>

      <datalist id="extra-credit-parameter-options">
        {PARAMETER_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-5">
          <button
            type="button"
            onClick={handleAddGroup}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg bg-stone-100 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors',
              'hover:bg-stone-200',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            添加第一个条件组
          </button>
        </div>
      ) : null}

      {groups.map((group, groupIndex) => (
        <div
          key={`extra-credit-group-${groupIndex}`}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_14px_36px_-32px_rgba(15,23,42,0.35)]"
        >
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-start gap-2">
                <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                  条件组 {groupIndex + 1}
                </span>
                <span className="inline-flex max-w-full min-w-0 break-all whitespace-normal rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-500">
                  固定条件：{summarizeFixedConditions(group.fixedConditions)}
                </span>
              </div>
              <p className="min-w-0 break-words text-xs leading-5 text-stone-500">
                这组中的每一行都会生成一条规则：固定条件 + {group.variableParameter.trim() || '浮动参数'} = 对应积分。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyGroup(groupIndex)}
                disabled={disabled}
                className={cn(
                  'rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors',
                  'hover:border-aurora-purple hover:text-aurora-purple',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                复制分组
              </button>
              <button
                type="button"
                onClick={() => handleRemoveGroup(groupIndex)}
                disabled={disabled}
                className={cn(
                  'rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors',
                  'hover:bg-red-50',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                删除分组
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
            <div className="min-w-0 space-y-4 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  浮动参数
                </label>
                <input
                  type="text"
                  list="extra-credit-parameter-options"
                  value={group.variableParameter}
                  onChange={(event) => handleVariableParameterChange(groupIndex, event.target.value)}
                  disabled={disabled}
                  placeholder="例如：duration"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-stone-700">
                    固定条件
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddFixedCondition(groupIndex)}
                    disabled={disabled}
                    className={cn(
                      'rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors',
                      'hover:border-aurora-purple hover:text-aurora-purple',
                      disabled && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    添加条件
                  </button>
                </div>

                {group.fixedConditions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-300 bg-white px-3 py-3 text-xs text-stone-500">
                    当前没有固定条件。适合做“所有时长统一按秒计费”这类规则。
                  </div>
                ) : null}

                {group.fixedConditions.map((condition, conditionIndex) => (
                  <div
                    key={`group-${groupIndex}-condition-${conditionIndex}`}
                    className="grid min-w-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <input
                      type="text"
                      list="extra-credit-parameter-options"
                      value={condition.parameter}
                      onChange={(event) =>
                        handleFixedConditionChange(groupIndex, conditionIndex, 'parameter', event.target.value)
                      }
                      disabled={disabled}
                      placeholder="参数名"
                      className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                    />
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(event) =>
                        handleFixedConditionChange(groupIndex, conditionIndex, 'value', event.target.value)
                      }
                      disabled={disabled}
                      placeholder="参数值"
                      className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFixedCondition(groupIndex, conditionIndex)}
                      disabled={disabled}
                      className={cn(
                        'justify-self-start rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 transition-colors',
                        'hover:border-red-200 hover:text-red-600',
                        disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 space-y-4 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-700">
                    价格表
                  </p>
                  <p className="mt-1 min-w-0 break-words text-xs leading-5 text-stone-500">
                    在固定条件不变的情况下，逐个填写 {group.variableParameter.trim() || '参数'} 的值与对应积分。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem(groupIndex)}
                  disabled={disabled}
                  className={cn(
                    'rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors',
                    'hover:border-aurora-purple hover:text-aurora-purple',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  添加一行
                </button>
              </div>

              {group.variableParameter.trim() === 'duration' ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                  <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-end">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-stone-600">
                          起始秒数
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={group.durationPricing.start}
                          onChange={(event) =>
                            handleDurationPricingFieldChange(groupIndex, 'start', event.target.value)
                          }
                          disabled={disabled}
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-stone-600">
                          结束秒数
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={group.durationPricing.end}
                          onChange={(event) =>
                            handleDurationPricingFieldChange(groupIndex, 'end', event.target.value)
                          }
                          disabled={disabled}
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-stone-600">
                          每秒积分
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={group.durationPricing.perSecond}
                          onChange={(event) =>
                            handleDurationPricingFieldChange(groupIndex, 'perSecond', event.target.value)
                          }
                          disabled={disabled}
                          placeholder="例如：2"
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateDurationItems(groupIndex)}
                      disabled={disabled || !isDurationPricingReady(group)}
                      className={cn(
                        'rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition-colors',
                        'hover:border-indigo-300 hover:bg-indigo-100/70',
                        (disabled || !isDurationPricingReady(group)) && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      按每秒积分生成
                    </button>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-stone-500">
                    会把区间内每一秒自动生成或覆盖成“时长秒数 × 每秒积分”。例如每秒 2 积分，则 5 秒为 10 积分、8 秒为 16 积分。
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto] gap-2 px-1 text-xs font-medium uppercase tracking-[0.08em] text-stone-500">
                  <span>{group.variableParameter.trim() || '参数值'}</span>
                  <span>积分</span>
                  <span>操作</span>
                </div>

                {group.items.map((item, itemIndex) => (
                  <div
                    key={`group-${groupIndex}-item-${itemIndex}`}
                    className="grid min-w-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_auto] gap-2"
                  >
                    <input
                      type="text"
                      value={item.value}
                      onChange={(event) => handleItemChange(groupIndex, itemIndex, 'value', event.target.value)}
                      disabled={disabled}
                      placeholder={resolveValuePlaceholder(group.variableParameter)}
                      className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={Number.isFinite(item.credits) ? item.credits : 0}
                      onChange={(event) => handleItemChange(groupIndex, itemIndex, 'credits', event.target.value)}
                      disabled={disabled}
                      className="min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-aurora-purple focus:outline-none focus:ring-2 focus:ring-aurora-purple/20"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyItem(groupIndex, itemIndex)}
                        disabled={disabled}
                        className={cn(
                          'rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-600 transition-colors',
                          'hover:border-aurora-purple hover:text-aurora-purple',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(groupIndex, itemIndex)}
                        disabled={disabled}
                        className={cn(
                          'rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-600 transition-colors',
                          'hover:border-red-200 hover:text-red-600',
                          disabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
