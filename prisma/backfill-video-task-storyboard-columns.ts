import { PrismaClient } from '@prisma/client';

import { extractAutoProjectAgentFromProviderData } from '../src/chat/auto-project-workflow.metadata';
import {
  buildAutoProjectTaskColumnData,
  extractAutoProjectAssetMetadata,
} from '../src/common/utils/task-provider-data.util';

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

type StoryboardHint = {
  taskId: string;
  taskNo: string | null;
  projectId: string | null;
  shotId: string;
  workflowStage: string | null;
  finalStoryboard: boolean;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractStoryboardHintsFromProviderData(providerData: unknown): StoryboardHint[] {
  if (!providerData || typeof providerData !== 'object' || Array.isArray(providerData)) {
    return [];
  }

  const autoProjectMetadata = extractAutoProjectAgentFromProviderData(providerData as never);
  const source = providerData as Record<string, unknown>;
  if (!autoProjectMetadata?.projectId || !Array.isArray(source.taskRefs)) {
    return [];
  }

  const workflowStage = autoProjectMetadata.workflow?.stage ?? autoProjectMetadata.stage ?? 'shot_review';
  const out: StoryboardHint[] = [];

  for (const item of source.taskRefs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const raw = item as Record<string, unknown>;
    if (normalizeText(raw.kind) !== 'video' || raw.finalStoryboard !== true) continue;

    const taskId = normalizeText(raw.taskId);
    const shotId = normalizeText(raw.shotId);
    const taskNo = normalizeText(raw.taskNo) || null;
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

function shouldUpdateTaskColumns(
  current: {
    autoProjectShotId: string | null;
    autoProjectWorkflowStage: string | null;
    autoProjectFinalStoryboard: boolean | null;
  },
  next: {
    autoProjectShotId: string | null;
    autoProjectWorkflowStage: string | null;
    autoProjectFinalStoryboard: boolean | null;
  },
) {
  return (
    current.autoProjectShotId !== next.autoProjectShotId ||
    current.autoProjectWorkflowStage !== next.autoProjectWorkflowStage ||
    current.autoProjectFinalStoryboard !== next.autoProjectFinalStoryboard
  );
}

async function backfillFromTaskProviderData() {
  let cursorId: bigint | undefined;
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
    cursorId = tasks[tasks.length - 1]?.id;

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
  let cursorId: bigint | undefined;
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
    cursorId = messages[messages.length - 1]?.id;

    const hintByTaskKey = new Map<string, StoryboardHint>();
    const numericTaskIds: bigint[] = [];
    const taskNos: string[] = [];

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

    const tasks = await prisma.videoTask.findMany({
      where: {
        OR: [
          ...(numericTaskIds.length > 0 ? [{ id: { in: numericTaskIds } }] : []),
          ...(taskNos.length > 0 ? [{ taskNo: { in: [...new Set(taskNos)] } }] : []),
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
        hintByTaskKey.get(`id:${task.id.toString()}`) ??
        hintByTaskKey.get(`taskNo:${task.taskNo}`);
      if (!hint) continue;

      if (hint.projectId && task.projectId && task.projectId.toString() !== hint.projectId) {
        continue;
      }

      const nextColumns = {
        autoProjectShotId: task.autoProjectShotId ?? hint.shotId,
        autoProjectWorkflowStage: task.autoProjectWorkflowStage ?? hint.workflowStage,
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
