import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

type ExportResearchReportOptions = {
  report: string
  topic?: string
  taskNo?: string
  modelName?: string | null
  generatedAt?: string | null
  locale?: string
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

function toDisplayDate(value: string | null | undefined, locale: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildReportParagraphs(report: string) {
  const lines = report.replace(/\r\n/g, '\n').split('\n')
  const paragraphs: Paragraph[] = []

  for (const line of lines) {
    const text = line.trimEnd()

    if (!text.trim()) {
      paragraphs.push(new Paragraph({ spacing: { after: 100 } }))
      continue
    }

    if (text.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: text.slice(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 140, after: 100 },
        })
      )
      continue
    }

    if (text.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: text.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 100 },
        })
      )
      continue
    }

    if (text.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: text.slice(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 200, after: 120 },
        })
      )
      continue
    }

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(text)],
        spacing: { after: 90 },
      })
    )
  }

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph(''))
  }
  return paragraphs
}

export async function exportResearchReportToWord(options: ExportResearchReportOptions) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false

  const report = (options.report || '').trim()
  if (!report) return false

  const locale = options.locale === 'en-US' ? 'en-US' : 'zh-CN'
  const topic = (options.topic || '').trim()
  const taskNo = (options.taskNo || '').trim()
  const modelName = (options.modelName || '').trim()
  const generatedAt = toDisplayDate(options.generatedAt, locale)

  const titleText = locale === 'zh-CN' ? '深度研究报告' : 'Deep Research Report'
  const labelTopic = locale === 'zh-CN' ? '研究主题' : 'Topic'
  const labelTaskNo = locale === 'zh-CN' ? '任务编号' : 'Task No.'
  const labelModel = locale === 'zh-CN' ? '模型' : 'Model'
  const labelGeneratedAt = locale === 'zh-CN' ? '导出时间' : 'Exported At'
  const metaRows: Array<[string, string]> = []
  if (topic) metaRows.push([labelTopic, topic])
  if (taskNo) metaRows.push([labelTaskNo, taskNo])
  if (modelName) metaRows.push([labelModel, modelName])
  metaRows.push([labelGeneratedAt, generatedAt || new Date().toLocaleString(locale)])

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
    },
    rows: metaRows.map(([label, value]) => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            children: [new Paragraph(value)],
          }),
        ],
      })
    }),
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: titleText,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { after: 220 },
          }),
          table,
          new Paragraph({ text: '' }),
          ...buildReportParagraphs(report),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)

  const fileBase = safeFileName(topic || taskNo || titleText) || 'research-report'
  const fileName = `${fileBase}.docx`
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
  return true
}
