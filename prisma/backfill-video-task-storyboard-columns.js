'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function normalizeString(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text ? text.slice(0, maxLength) : '';
}

function normalizeStringArray(value, maxItems, maxItemLength) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeString(item, maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function extractAutoProjectAssetMetadata(providerData) {
  const providerObject = asObject(providerData);
  const raw = asObject(providerObject && providerObject.autoProjectAsset);
  if (!raw) return null;

  const title = normalizeString(raw.title, 255);
  if (!title) return null;

  return {
    planId: normalizeString(raw.planId, 120) || null,
    title,
    description: normalizeString(raw.description, 5000) || null,
    sourcePrompt: normalizeString(raw.sourcePrompt, 12000) || null,
    referenceLabels: normalizeStringArray(raw.referenceLabels, 24, 80),
    referenceAssetIds: normalizeStringArray(raw.referenceAssetIds, 24, 120),
    referenceCharacterIds: normalizeStringArray(raw.referenceCharacterIds, 24, 120),
    workflowStage: normalizeString(raw.workflowStage, 40) || null,
    shotId: normalizeString(raw.shotId, 120) || null,
    finalStoryboard: raw.finalStoryboard === true,
  };
}

function buildAutoProjectTaskColumnData(metadata) {
  return {
    autoProjectShotId: normalizeString(metadata && metadata.shotId, 120) || null,
    autoProjectWorkflowStage: normalizeString(metadata && metadata.workflowStage, 40) || null,
    autoProjectFinalStoryboard:
      metadata && metadata.finalStoryboard === true
        ? true
        : metadata && metadata.finalStoryboard === false
          ? false
          : null,
  };
}

function extractAutoProjectAgentFromProviderData(providerData) {
  if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
    return null;
  }

  const source = providerData;
  const rawValue = source.autoProjectAgent;
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return null;
  }

  const raw = rawValue;
  const projectId =
    typeof raw.projectId === 'string' && raw.projectId.trim()
      ? raw.projectId.trim()
      : null;
  const imageModelId = typeof raw.imageModelId === 'string' ? raw.imageModelId.trim() : '';
  const videoModelId = typeof raw.videoModelId === 'string' ? raw.videoModelId.trim() : '';

  if (!imageModelId || !videoModelId) {
    return null;
  }

  const workflowRaw =
    raw.workflow && typeof raw.workflow === 'object' && !Array.isArray(raw.workflow)
      ? raw.workflow
      : null;
  const stageSource = workflowRaw && workflowRaw.stage != null ? workflowRaw.stage : raw.stage;
  const stageRaw =
    typeof stageSource === 'string'
      ? String(stageSource).trim().toLowerCase()
      : '';
  const stage =
    stageRaw === 'project_plan_review' ||
    stageRaw === 'outline_review' ||
    stageRaw === 'character_review' ||
    stageRaw === 'project_setup_confirmation' ||
    stageRaw === 'shot_review'
      ? stageRaw
      : null;

  return {
    projectId,
    stage,
    workflow: workflowRaw && stage ? { stage } : null,
  };
}

function extractStoryboardHintsFromProviderData(providerData) {
  if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
    return [];
  }

  const autoProjectMetadata = extractAutoProjectAgentFromProviderData(providerData);
  const source = providerData;
  if (!autoProjectMetadata || !autoProjectMetadata.projectId || !Array.isArray(source.taskRefs)) {
    return [];
  }

  const workflowStage =
    (autoProjectMetadata.workflow && autoProjectMetadata.workflow.stage) ||
    autoProjectMetadata.stage ||
    'shot_review';
  const out = [];

  for (const item of source.taskRefs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const raw = item;
    if (normalizeString(raw.kind, 32) !== 'video' || raw.finalStoryboard !== true) continue;

    const taskId = normalizeString(raw.taskId, 120);
    const shotId = normalizeString(raw.shotId, 120);
    const taskNo = normalizeString(raw.taskNo, 120) || null;
    if (!taskId || !shotId) continue;

    out.push({
      taskId,
      taskNo,
      projectId: autoProjectMetadata.projectId,
      shotId,
      workflowStage,
      finalStoryboard: true,
    });
  }

  return out;
}

function shouldUpdateTaskColumns(current, next) {
  return (
    current.autoProjectShotId !== next.autoProjectShotId ||
    current.autoProjectWorkflowStage !== next.autoProjectWorkflowStage ||
    current.autoProjectFinalStoryboard !== next.autoProjectFinalStoryboard
  );
}

async function backfillFromTaskProviderData() {
  let cursorId;
  let updatedCount = 0;

  while (true) {
    const tasks = await prisma.videoTask.findMany({
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      where: {
        projectId: { not: null },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        providerData: true,
        autoProjectShotId: true,
        autoProjectWorkflowStage: true,
        autoProjectFinalStoryboard: true,
      },
    });

    if (tasks.length === 0) break;
    cursorId = tasks[tasks.length - 1] && tasks[tasks.length - 1].id;

    for (const task of tasks) {
      const metadata = extractAutoProjectAssetMetadata(task.providerData);
      if (!metadata) continue;

      const nextColumns = buildAutoProjectTaskColumnData(metadata);
      if (!shouldUpdateTaskColumns(task, nextColumns)) continue;

      await prisma.videoTask.update({
        where: { id: task.id },
        data: nextColumns,
      });
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function backfillFromChatMessages() {
  let cursorId;
  let updatedCount = 0;

  while (true) {
    const messages = await prisma.chatMessage.findMany({
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      where: {
        role: 'assistant',
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id: true,
        providerData: true,
      },
    });

    if (messages.length === 0) break;
    cursorId = messages[messages.length - 1] && messages[messages.length - 1].id;

    const hintByTaskKey = new Map();
    const numericTaskIds = [];
    const taskNos = [];

    for (const message of messages) {
      const hints = extractStoryboardHintsFromProviderData(message.providerData);
      for (const hint of hints) {
        const idKey = `id:${hint.taskId}`;
        if (!hintByTaskKey.has(idKey)) {
          hintByTaskKey.set(idKey, hint);
          try {
            numericTaskIds.push(BigInt(hint.taskId));
          } catch {
            taskNos.push(hint.taskId);
          }
        }

        if (hint.taskNo) {
          const taskNoKey = `taskNo:${hint.taskNo}`;
          if (!hintByTaskKey.has(taskNoKey)) {
            hintByTaskKey.set(taskNoKey, hint);
            taskNos.push(hint.taskNo);
          }
        }
      }
    }

    if (hintByTaskKey.size === 0) continue;

    const uniqueTaskNos = [...new Set(taskNos.filter(Boolean))];
    const tasks = await prisma.videoTask.findMany({
      where: {
        OR: [
          ...(numericTaskIds.length > 0 ? [{ id: { in: numericTaskIds } }] : []),
          ...(uniqueTaskNos.length > 0 ? [{ taskNo: { in: uniqueTaskNos } }] : []),
        ],
      },
      select: {
        id: true,
        taskNo: true,
        projectId: true,
        autoProjectShotId: true,
        autoProjectWorkflowStage: true,
        autoProjectFinalStoryboard: true,
      },
    });

    for (const task of tasks) {
      const hint =
        hintByTaskKey.get(`id:${task.id.toString()}`) ||
        (task.taskNo ? hintByTaskKey.get(`taskNo:${task.taskNo}`) : null);
      if (!hint) continue;

      if (hint.projectId && task.projectId && task.projectId.toString() !== hint.projectId) {
        continue;
      }

      const nextColumns = {
        autoProjectShotId: task.autoProjectShotId || hint.shotId,
        autoProjectWorkflowStage: task.autoProjectWorkflowStage || hint.workflowStage,
        autoProjectFinalStoryboard:
          task.autoProjectFinalStoryboard === true
            ? true
            : hint.finalStoryboard,
      };

      if (!shouldUpdateTaskColumns(task, nextColumns)) continue;

      await prisma.videoTask.update({
        where: { id: task.id },
        data: nextColumns,
      });
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function main() {
  const providerDataUpdates = await backfillFromTaskProviderData();
  const chatHintUpdates = await backfillFromChatMessages();

  console.log(
    `[backfill-video-task-storyboard-columns] Updated ${providerDataUpdates} task(s) from providerData and ${chatHintUpdates} task(s) from chat message hints.`,
  );
}

main()
  .catch((error) => {
    console.error('[backfill-video-task-storyboard-columns] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
