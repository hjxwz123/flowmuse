import { useState } from 'react'
import {
  Check,
  Clapperboard,
  Download,
  Droplets,
  Edit3,
  Film,
  ImageIcon,
  Search,
  Play,
  Sun,
  VolumeX,
  X,
  Zap,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ChatAutoProjectAgentMetadata, ChatTaskRef } from '@/lib/api/types/chat'
import type { MergeProjectStoryboardTransition, ProjectStoryboardStatus, ProjectStoryboardTransitionType } from '@/lib/api/types/projects'
import { cn } from '@/lib/utils/cn'

import styles from './ChatContent.module.css'

type AutoProjectWorkflowCardProps = {
  metadata: ChatAutoProjectAgentMetadata
  isZh: boolean
  taskRefs?: ChatTaskRef[]
  storyboardTaskRefs?: ChatTaskRef[]
  storyboardStatusByShotId?: Record<string, ProjectStoryboardStatus>
  disabled?: boolean
  onAction: (content: string, metadata: ChatAutoProjectAgentMetadata) => void
  onMergeStoryboard?: (metadata: ChatAutoProjectAgentMetadata, options?: {
    shotIds?: string[]
    transitions?: MergeProjectStoryboardTransition[]
    mute?: boolean
  }) => void
  isMergingStoryboard?: boolean
}

type StoryboardEditorClip = {
  shotId: string
  title: string
  label: string
  thumbnailUrl: string | null
}

type TransitionPreset = {
  type: ProjectStoryboardTransitionType
  labelZh: string
  labelEn: string
  duration: number
  Icon: LucideIcon
}

const STORYBOARD_TRANSITION_PRESETS: TransitionPreset[] = [
  { type: 'crossfade', labelZh: '交叉溶解', labelEn: 'Cross Dissolve', duration: 0.45, Icon: Film },
  { type: 'glitch', labelZh: '故障干扰', labelEn: 'Glitch', duration: 0.35, Icon: Zap },
  { type: 'zoom', labelZh: '镜头冲击', labelEn: 'Impact Zoom', duration: 0.45, Icon: Search },
  { type: 'lightleak', labelZh: '漏光胶片', labelEn: 'Light Leak', duration: 0.4, Icon: Sun },
  { type: 'blur', labelZh: '动感模糊', labelEn: 'Motion Blur', duration: 0.45, Icon: Droplets },
]

function buildStageLabel(stage: ChatAutoProjectAgentMetadata['stage'], isZh: boolean) {
  if (stage === 'project_plan_review') return isZh ? '方案' : 'Plan'
  if (stage === 'outline_review') return isZh ? '大纲' : 'Outline'
  if (stage === 'character_review') return isZh ? '角色' : 'Characters'
  if (stage === 'project_setup_confirmation') return isZh ? '初始化' : 'Setup'
  if (stage === 'shot_review') return isZh ? '分镜' : 'Shots'
  return isZh ? '流程' : 'Workflow'
}

export function AutoProjectWorkflowCard({
  metadata,
  isZh,
  taskRefs = [],
  storyboardTaskRefs = [],
  storyboardStatusByShotId = {},
  disabled = false,
  onAction,
  onMergeStoryboard,
  isMergingStoryboard = false,
}: AutoProjectWorkflowCardProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [transitionSlots, setTransitionSlots] = useState<Array<TransitionPreset | null>>([])
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [muteExport, setMuteExport] = useState(false)
  const workflow = metadata.workflow
  if (!workflow) return null

  const projectTitle = metadata.projectName || workflow.proposedProjectName || ''
  const totalShots = workflow.shots.length
  const skippedShotIdSet = new Set(workflow.skippedShotIds)
  const liveStoryboardShotIdSet = new Set(
    Object.values(storyboardStatusByShotId)
      .filter((item) =>
        !skippedShotIdSet.has(item.shotId) &&
        Boolean(item.taskId || item.status || item.resultUrl || item.errorMessage)
      )
      .map((item) => item.shotId)
  )
  const completedStoryboardShotIdSet = new Set(
    Object.values(storyboardStatusByShotId)
      .filter((item) => item.completed && !skippedShotIdSet.has(item.shotId))
      .map((item) => item.shotId)
  )
  const generatedShotIdSet = new Set(
    workflow.generatedShotIds.filter((shotId) => !skippedShotIdSet.has(shotId))
  )
  for (const shotId of liveStoryboardShotIdSet) {
    generatedShotIdSet.add(shotId)
  }
  for (const shotId of completedStoryboardShotIdSet) {
    generatedShotIdSet.add(shotId)
  }
  const doneShotIdSet = new Set<string>([...workflow.skippedShotIds, ...generatedShotIdSet])
  const doneShots = doneShotIdSet.size
  const remainingShots = Math.max(0, totalShots - doneShots)
  const stageLabel = workflow.progressLabel || buildStageLabel(metadata.stage ?? workflow.stage, isZh)
  const nextPendingShot = workflow.shots.find(
    (item) => !doneShotIdSet.has(item.id)
  ) || null
  const roleTaskRefs = taskRefs.filter((task) => task.kind === 'image')
  const expectedRoleTaskCount = workflow.imagePlans.length
  const roleTasksDone =
    roleTaskRefs.length > 0 &&
    roleTaskRefs.every((task) => task.status === 'completed' || Boolean(task.resultUrl))
  const roleTasksPending = roleTaskRefs.some((task) =>
    task.status === 'pending' ||
    task.status === 'processing' ||
    (!task.status && !task.resultUrl && !task.errorMessage)
  )
  const hasEnoughRoleTaskRefs =
    expectedRoleTaskCount === 0 || roleTaskRefs.length >= expectedRoleTaskCount
  const canProceedToShots =
    workflow.stage === 'project_setup_confirmation' &&
    hasEnoughRoleTaskRefs &&
    roleTasksDone &&
    !roleTasksPending
  const canRegenerateRoleImages =
    workflow.stage === 'project_setup_confirmation' &&
    roleTaskRefs.length > 0 &&
    !roleTasksPending
  const latestStoryboardTaskByShotId = storyboardTaskRefs.reduce((map, taskRef) => {
    if (taskRef.kind !== 'video' || taskRef.finalStoryboard !== true || !taskRef.shotId) {
      return map
    }

    const currentTimestamp = new Date(taskRef.completedAt ?? taskRef.createdAt ?? 0).getTime()
    const existing = map.get(taskRef.shotId)
    const existingTimestamp = existing ? new Date(existing.completedAt ?? existing.createdAt ?? 0).getTime() : -1
    const candidateCompleted = Boolean(taskRef.status === 'completed' || taskRef.resultUrl)
    const existingCompleted = Boolean(existing && (existing.status === 'completed' || existing.resultUrl))

    if (
      !existing ||
      (candidateCompleted && !existingCompleted) ||
      (candidateCompleted === existingCompleted && currentTimestamp >= existingTimestamp)
    ) {
      map.set(taskRef.shotId, taskRef)
    }

    return map
  }, new Map<string, ChatTaskRef>())
  const generatedShotsInOrder = workflow.shots.filter((item) => generatedShotIdSet.has(item.id))
  const generatedStoryboardStates = generatedShotsInOrder.map((item) => {
    const shotIndex = workflow.shots.findIndex((shot) => shot.id === item.id)
    const taskRef = latestStoryboardTaskByShotId.get(item.id)
    const storyboardStatus = storyboardStatusByShotId[item.id]
    const isCompleted =
      storyboardStatus?.completed === true ||
      Boolean(taskRef && (taskRef.status === 'completed' || taskRef.resultUrl))
    const isFailed =
      !isCompleted &&
      (
        storyboardStatus?.status === 'failed' ||
        taskRef?.status === 'failed'
      )
    const isPending = !isCompleted && !isFailed

    return {
      shot: item,
      shotIndex,
      isCompleted,
      isFailed,
      isPending,
    }
  })
  const completedGeneratedShotCount = generatedStoryboardStates.filter((item) => item.isCompleted).length
  const failedGeneratedShots = generatedStoryboardStates.filter((item) => item.isFailed)
  const pendingGeneratedShots = generatedStoryboardStates.filter((item) => item.isPending)
  const editorClips: StoryboardEditorClip[] = generatedStoryboardStates
    .filter((item) => item.isCompleted)
    .map((item) => {
      const taskRef = latestStoryboardTaskByShotId.get(item.shot.id)
      const storyboardStatus = storyboardStatusByShotId[item.shot.id]
      return {
        shotId: item.shot.id,
        title: item.shot.title,
        label: `${isZh ? '镜头' : 'Scene'}_${String(Math.max(0, item.shotIndex) + 1).padStart(2, '0')}.mp4`,
        thumbnailUrl: storyboardStatus?.thumbnailUrl ?? taskRef?.thumbnailUrl ?? null,
      }
    })
  const canShowMergeStoryboard =
    workflow.stage === 'shot_review' &&
    Boolean(metadata.projectId) &&
    totalShots > 0 &&
    remainingShots === 0 &&
    generatedShotsInOrder.length > 0
  const canMergeStoryboard =
    canShowMergeStoryboard &&
    completedGeneratedShotCount === generatedShotsInOrder.length &&
    failedGeneratedShots.length === 0
  const mergeBlockedShotPreview = (failedGeneratedShots.length > 0 ? failedGeneratedShots : pendingGeneratedShots)
    .slice(0, 2)
    .map((item) => `${Math.max(0, item.shotIndex) + 1}. ${item.shot.title}`)
    .join(' / ')
  const mergeStoryboardHint =
    failedGeneratedShots.length > 0
      ? isZh
        ? `仍有 ${failedGeneratedShots.length} 条分镜生成失败，处理后才能合并${mergeBlockedShotPreview ? `：${mergeBlockedShotPreview}` : ''}`
        : `${failedGeneratedShots.length} storyboard shots failed and must be fixed before merge${mergeBlockedShotPreview ? `: ${mergeBlockedShotPreview}` : ''}`
      : pendingGeneratedShots.length > 0
        ? isZh
          ? `还有 ${pendingGeneratedShots.length} 条分镜视频处理中，完成后即可合并${mergeBlockedShotPreview ? `：${mergeBlockedShotPreview}` : ''}`
          : `${pendingGeneratedShots.length} storyboard videos are still processing. Merge will unlock when they finish${mergeBlockedShotPreview ? `: ${mergeBlockedShotPreview}` : ''}`
        : null

  const actionLabels = {
    confirmPlan: isZh ? '确认后续方案' : 'Confirm Plan',
    outlineApprove: isZh ? '确认大纲' : 'Approve Outline',
    characterApprove: isZh ? '确认角色设定' : 'Approve Characters',
    confirmSetup: isZh ? '确认角色图生成+项目初始化' : 'Confirm Setup',
    regenerateSetup: isZh ? '重新生成角色图' : 'Regenerate Role Images',
    enterShots: isZh ? '进入分镜剧本+时长方案' : 'Proceed to Storyboard',
    confirmSkip: isZh ? '确认跳过当前分镜' : 'Confirm Skip',
    generateFirst: isZh ? '从第一镜开始生成' : 'Generate First Shot',
    generateNext: isZh ? '生成下一镜' : 'Generate Next Shot',
    mergeStoryboard: isZh ? '合并全部分镜' : 'Merge Storyboard',
    mergeStoryboardWaiting: isZh ? '等待全部完成后合并' : 'Waiting for completion',
    mergeStoryboardBlocked: isZh ? '处理失败分镜后合并' : 'Resolve failed shots first',
    mergingStoryboard: isZh ? '合并全片中...' : 'Merging...',
    editVideo: isZh ? '编辑视频' : 'Edit Video',
    editorTitle: isZh ? '全息转场编辑器' : 'Holographic Transition Editor',
    transitionLibrary: isZh ? '转场库 (拖拽至下方轨道)' : 'Transition Library (drag to the track)',
    videoTrack: isZh ? '视频轨道' : 'Video Track',
    muteExport: isZh ? '静音导出' : 'Mute Export',
    exportVideo: isZh ? '导出视频' : 'Export Video',
  }
  const openStoryboardEditor = () => {
    setTransitionSlots(Array.from({ length: Math.max(0, editorClips.length - 1) }, () => null))
    setMuteExport(false)
    setDragOverSlot(null)
    setIsEditorOpen(true)
  }
  const applyTransitionToSlot = (slotIndex: number, transitionType: string) => {
    const preset = STORYBOARD_TRANSITION_PRESETS.find((item) => item.type === transitionType)
    if (!preset) return
    setTransitionSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = preset
      return next
    })
  }
  const removeTransitionFromSlot = (slotIndex: number) => {
    setTransitionSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      return next
    })
  }
  const exportEditedStoryboard = () => {
    if (!onMergeStoryboard || editorClips.length === 0) return
    const transitions = transitionSlots
      .map((preset, index): MergeProjectStoryboardTransition | null => {
        const fromClip = editorClips[index]
        const toClip = editorClips[index + 1]
        if (!preset || !fromClip || !toClip) return null
        return {
          fromShotId: fromClip.shotId,
          toShotId: toClip.shotId,
          type: preset.type,
          duration: preset.duration,
        }
      })
      .filter((item): item is MergeProjectStoryboardTransition => Boolean(item))

    onMergeStoryboard(metadata, {
      shotIds: editorClips.map((clip) => clip.shotId),
      transitions,
      mute: muteExport,
    })
    setIsEditorOpen(false)
  }

  return (
    <div className={styles.autoWorkflowCard}>
      <div className={styles.autoWorkflowHead}>
        <div className={styles.autoWorkflowHeadMain}>
          {projectTitle ? (
            <span className={styles.autoWorkflowProject}>{projectTitle}</span>
          ) : null}
          <span className={styles.autoWorkflowStage}>{stageLabel}</span>
        </div>

        {totalShots > 0 ? (
          <span className={styles.autoWorkflowProgress}>
            {doneShots}/{totalShots}
          </span>
        ) : null}
      </div>

      {workflow.outlineTitle ? (
        <div className={styles.autoWorkflowTitle}>{workflow.outlineTitle}</div>
      ) : null}

      {workflow.proposedProjectDescription ? (
        <p className={styles.autoWorkflowItemText}>{workflow.proposedProjectDescription}</p>
      ) : null}

      {workflow.outline.length > 0 ? (
        <section className={styles.autoWorkflowSection}>
          <div className={styles.autoWorkflowSectionHead}>
            <Film className="h-3.5 w-3.5" />
            <span>{isZh ? '大纲' : 'Outline'}</span>
          </div>
          <div className={styles.autoWorkflowList}>
            {workflow.outline.map((item, index) => (
              <div key={item.id} className={styles.autoWorkflowListItem}>
                <div className={styles.autoWorkflowListHead}>
                  <span className={styles.autoWorkflowIndex}>{index + 1}</span>
                  <span className={styles.autoWorkflowItemTitle}>{item.title}</span>
                </div>
                <p className={styles.autoWorkflowItemText}>{item.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {workflow.characters.length > 0 ? (
        <section className={styles.autoWorkflowSection}>
          <div className={styles.autoWorkflowSectionHead}>
            <UserRound className="h-3.5 w-3.5" />
            <span>{isZh ? '角色' : 'Characters'}</span>
          </div>
          <div className={styles.autoWorkflowGrid}>
            {workflow.characters.map((item) => (
              <div key={item.id} className={styles.autoWorkflowPanel}>
                <div className={styles.autoWorkflowPanelHead}>
                  <span className={styles.autoWorkflowItemTitle}>{item.name}</span>
                  {item.role ? (
                    <span className={styles.autoWorkflowMiniTag}>{item.role}</span>
                  ) : null}
                </div>
                {item.description ? (
                  <p className={styles.autoWorkflowItemText}>{item.description}</p>
                ) : null}
                {item.visualPrompt ? (
                  <p className={styles.autoWorkflowPrompt}>{item.visualPrompt}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {workflow.imagePlans.length > 0 ? (
        <section className={styles.autoWorkflowSection}>
          <div className={styles.autoWorkflowSectionHead}>
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{isZh ? '图片' : 'Images'}</span>
          </div>
          <div className={styles.autoWorkflowGrid}>
            {workflow.imagePlans.map((item) => (
              <div key={item.id} className={styles.autoWorkflowPanel}>
                <div className={styles.autoWorkflowPanelHead}>
                  <span className={styles.autoWorkflowItemTitle}>{item.title}</span>
                  <div className={styles.autoWorkflowTagRow}>
                    {item.preferredAspectRatio ? (
                      <span className={styles.autoWorkflowMiniTag}>{item.preferredAspectRatio}</span>
                    ) : null}
                    {item.preferredResolution ? (
                      <span className={styles.autoWorkflowMiniTag}>{item.preferredResolution}</span>
                    ) : null}
                  </div>
                </div>
                <p className={styles.autoWorkflowPrompt}>{item.prompt}</p>
                {item.negativePrompt ? (
                  <p className={styles.autoWorkflowNegative}>{item.negativePrompt}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {workflow.shots.length > 0 ? (
        <section className={styles.autoWorkflowSection}>
          <div className={styles.autoWorkflowSectionHead}>
            <Clapperboard className="h-3.5 w-3.5" />
            <span>{isZh ? '分镜' : 'Shots'}</span>
          </div>
          <div className={styles.autoWorkflowList}>
            {workflow.shots.map((item, index) => {
              const generated = generatedShotIdSet.has(item.id)
              const skipped = skippedShotIdSet.has(item.id)
              const storyboardTask = latestStoryboardTaskByShotId.get(item.id)
              const storyboardStatus = storyboardStatusByShotId[item.id]
              const isCompleted =
                storyboardStatus?.completed === true ||
                Boolean(storyboardTask && (storyboardTask.status === 'completed' || storyboardTask.resultUrl))
              const isFailed =
                !isCompleted &&
                (
                  storyboardStatus?.status === 'failed' ||
                  storyboardTask?.status === 'failed'
                )
              const isRunning = generated && !isCompleted && !isFailed

              return (
                <div
                  key={item.id}
                  className={cn(styles.autoWorkflowListItem, (generated || skipped) && styles.autoWorkflowListItemDone)}
                >
                  <div className={styles.autoWorkflowListHead}>
                    <div className={styles.autoWorkflowShotTitleWrap}>
                      <span className={styles.autoWorkflowIndex}>{index + 1}</span>
                      <span className={styles.autoWorkflowItemTitle}>{item.title}</span>
                    </div>
                    <div className={styles.autoWorkflowTagRow}>
                      <span className={styles.autoWorkflowMiniTag}>{item.duration}</span>
                      {skipped ? (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '已跳过' : 'Skipped'}
                        </span>
                      ) : isCompleted ? (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '已完成' : 'Completed'}
                        </span>
                      ) : isFailed ? (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '失败' : 'Failed'}
                        </span>
                      ) : generated || isRunning ? (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '生成中' : 'Rendering'}
                        </span>
                      ) : item.generationDecision === 'skip' ? (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '建议跳过' : 'Suggest Skip'}
                        </span>
                      ) : (
                        <span className={styles.autoWorkflowMiniTag}>
                          {isZh ? '建议生成' : 'Suggest Generate'}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.decisionReason ? (
                    <p className={styles.autoWorkflowItemText}>{item.decisionReason}</p>
                  ) : null}
                  {item.summary ? (
                    <p className={styles.autoWorkflowItemText}>{item.summary}</p>
                  ) : null}
                  {item.script ? (
                    <p className={styles.autoWorkflowScript}>{item.script}</p>
                  ) : null}
                  <p className={styles.autoWorkflowPrompt}>{item.prompt}</p>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.autoWorkflowActions}>
        {workflow.stage === 'project_plan_review' ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.confirmPlan, metadata)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabels.confirmPlan}</span>
          </button>
        ) : null}

        {workflow.stage === 'outline_review' ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.outlineApprove, metadata)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabels.outlineApprove}</span>
          </button>
        ) : null}

        {workflow.stage === 'character_review' ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.characterApprove, metadata)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabels.characterApprove}</span>
          </button>
        ) : null}

        {workflow.stage === 'project_setup_confirmation' && !canProceedToShots ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.confirmSetup, metadata)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabels.confirmSetup}</span>
          </button>
        ) : null}

        {workflow.stage === 'project_setup_confirmation' && canRegenerateRoleImages ? (
          <button
            type="button"
            disabled={disabled}
            className={styles.autoWorkflowActionBtn}
            onClick={() => onAction(actionLabels.regenerateSetup, metadata)}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{actionLabels.regenerateSetup}</span>
          </button>
        ) : null}

        {canProceedToShots ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.enterShots, metadata)}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            <span>{actionLabels.enterShots}</span>
          </button>
        ) : null}

        {workflow.stage === 'shot_review' && nextPendingShot?.generationDecision === 'skip' ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() => onAction(actionLabels.confirmSkip, metadata)}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabels.confirmSkip}</span>
          </button>
        ) : null}

        {workflow.stage === 'shot_review' && remainingShots > 0 && nextPendingShot?.generationDecision !== 'skip' ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
            onClick={() =>
              onAction(
                doneShots > 0 ? actionLabels.generateNext : actionLabels.generateFirst,
                metadata,
              )
            }
          >
            <Play className="h-3.5 w-3.5" />
            <span>{doneShots > 0 ? actionLabels.generateNext : actionLabels.generateFirst}</span>
          </button>
        ) : null}

        {canShowMergeStoryboard && onMergeStoryboard ? (
          <>
            <button
              type="button"
              disabled={disabled || isMergingStoryboard || !canMergeStoryboard}
              className={cn(styles.autoWorkflowActionBtn, styles.autoWorkflowActionBtnPrimary)}
              onClick={() => onMergeStoryboard(metadata)}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              <span>
                {isMergingStoryboard
                  ? actionLabels.mergingStoryboard
                  : !canMergeStoryboard
                    ? failedGeneratedShots.length > 0
                      ? actionLabels.mergeStoryboardBlocked
                      : actionLabels.mergeStoryboardWaiting
                    : actionLabels.mergeStoryboard}
              </span>
            </button>
            <button
              type="button"
              disabled={disabled || isMergingStoryboard || !canMergeStoryboard}
              className={styles.autoWorkflowActionBtn}
              onClick={openStoryboardEditor}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{actionLabels.editVideo}</span>
            </button>
          </>
        ) : null}
      </div>

      {canShowMergeStoryboard && mergeStoryboardHint ? (
        <div className={styles.autoWorkflowActionHint}>{mergeStoryboardHint}</div>
      ) : null}

      {isEditorOpen ? (
        <div className={styles.videoEditorOverlay} role="dialog" aria-modal="true">
          <div className={styles.videoEditorModal}>
            <header className={styles.videoEditorHeader}>
              <div className={styles.videoEditorTitle}>
                <Film className="h-5 w-5" />
                <span>{actionLabels.editorTitle}</span>
              </div>
              <button
                type="button"
                className={styles.videoEditorCloseBtn}
                onClick={() => setIsEditorOpen(false)}
                aria-label={isZh ? '关闭' : 'Close'}
              >
                <X className="h-6 w-6" />
              </button>
            </header>

            <div className={styles.videoEditorBody}>
              <section>
                <div className={styles.videoEditorSectionLabel}>{actionLabels.transitionLibrary}</div>
                <div className={styles.videoTransitionLibrary}>
                  {STORYBOARD_TRANSITION_PRESETS.map((preset) => {
                    const Icon = preset.Icon
                    return (
                      <div
                        key={preset.type}
                        className={styles.videoTransitionItem}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', preset.type)
                          event.dataTransfer.effectAllowed = 'copy'
                        }}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{isZh ? preset.labelZh : preset.labelEn}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <div className={styles.videoEditorSectionLabel}>{actionLabels.videoTrack}</div>
                <div className={styles.videoTimelineWrapper}>
                  <div className={styles.videoTrack}>
                    {editorClips.map((clip, index) => {
                      const slot = transitionSlots[index] ?? null
                      const SlotIcon = slot?.Icon
                      return (
                        <div key={clip.shotId} className={styles.videoTrackGroup}>
                          <div className={styles.videoClip}>
                            {clip.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={clip.thumbnailUrl} alt={clip.title} />
                            ) : (
                              <div className={styles.videoClipFallback}>
                                <Film className="h-6 w-6" />
                              </div>
                            )}
                            <div className={styles.videoClipLabel}>{clip.label}</div>
                          </div>

                          {index < editorClips.length - 1 ? (
                            <button
                              type="button"
                              className={cn(
                                styles.videoDropZone,
                                dragOverSlot === index && !slot && styles.videoDropZoneDragOver,
                                slot && styles.videoDropZoneFilled,
                              )}
                              onDragOver={(event) => {
                                event.preventDefault()
                                if (!slot) setDragOverSlot(index)
                              }}
                              onDragLeave={() => setDragOverSlot((current) => (current === index ? null : current))}
                              onDrop={(event) => {
                                event.preventDefault()
                                setDragOverSlot(null)
                                if (slot) return
                                applyTransitionToSlot(index, event.dataTransfer.getData('text/plain'))
                              }}
                              onClick={() => {
                                if (slot) removeTransitionFromSlot(index)
                              }}
                              title={
                                slot
                                  ? (isZh ? '点击移除' : 'Click to remove')
                                  : (isZh ? '拖入转场' : 'Drop transition')
                              }
                              data-remove-label={slot ? (isZh ? '点击移除' : 'Click to remove') : undefined}
                            >
                              {SlotIcon ? <SlotIcon className="h-4 w-4" /> : null}
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>

            <footer className={styles.videoEditorFooter}>
              <label className={styles.videoMuteToggle}>
                <input
                  type="checkbox"
                  checked={muteExport}
                  onChange={(event) => setMuteExport(event.target.checked)}
                />
                <span className={styles.videoToggleSwitch} />
                <span className={styles.videoToggleLabel}>
                  <VolumeX className="h-4 w-4" />
                  {actionLabels.muteExport}
                </span>
              </label>

              <button
                type="button"
                className={styles.videoEditorExportBtn}
                disabled={isMergingStoryboard}
                onClick={exportEditedStoryboard}
              >
                <Download className="h-4 w-4" />
                <span>{isMergingStoryboard ? actionLabels.mergingStoryboard : actionLabels.exportVideo}</span>
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
