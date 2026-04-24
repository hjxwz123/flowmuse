import { Prisma, ResearchTask, TaskStatus } from '@prisma/client';

export type ApiResearchTask = {
  type: 'research';
  id: string;
  userId: string;
  modelId: string;
  modelName: string | null;
  channelId: string;
  taskNo: string;
  topic: string;
  reportTitle: string | null;
  status: TaskStatus;
  stage: string;
  progress: number;
  plan: Prisma.JsonValue | null;
  queries: Prisma.JsonValue | null;
  findings: Prisma.JsonValue | null;
  report: string | null;
  providerData: Prisma.JsonValue | null;
  creditsCost: number | null;
  creditSource: ResearchTask['creditSource'] | null;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeResearchTask(
  task: ResearchTask & {
    model?: {
      name: string;
    } | null;
  },
): ApiResearchTask {
  const providerDataRecord =
    task.providerData && typeof task.providerData === 'object' && !Array.isArray(task.providerData)
      ? (task.providerData as Record<string, unknown>)
      : null;
  const reportTitleRaw = providerDataRecord?.reportTitle;
  const reportTitle =
    typeof reportTitleRaw === 'string' && reportTitleRaw.trim().length > 0
      ? reportTitleRaw.trim().slice(0, 120)
      : null;

  return {
    type: 'research',
    id: task.id.toString(),
    userId: task.userId.toString(),
    modelId: task.modelId.toString(),
    modelName: task.model?.name ?? null,
    channelId: task.channelId.toString(),
    taskNo: task.taskNo,
    topic: task.topic,
    reportTitle,
    status: task.status,
    stage: task.stage,
    progress: Math.max(0, Math.min(100, Math.trunc(task.progress ?? 0))),
    plan: task.plan,
    queries: task.queries,
    findings: task.findings,
    report: task.report ?? null,
    providerData: task.providerData,
    creditsCost: task.creditsCost ?? null,
    creditSource: task.creditSource ?? null,
    errorMessage: task.errorMessage ?? null,
    retryCount: task.retryCount,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
