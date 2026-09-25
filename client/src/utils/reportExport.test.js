import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { createReportWorkbook } from './reportExport'

describe('report workbook export', () => {
  it('writes only selected columns in order with report styling and table controls', async () => {
    const workbook = await createReportWorkbook({
      title: 'Exam Performance Report',
      worksheetName: 'Exam Performance',
      description: 'Filtered exam results',
      appliedFilters: ['Grade: Junior', 'Date: September'],
      summary: [{ label: 'Results', value: 2 }],
      generatedAt: new Date('2026-09-25T12:00:00Z'),
      rows: [
        { examTitle: 'Math', passed: 1, ignored: 'not exported' },
        { examTitle: 'Science', passed: 2, ignored: 'not exported' }
      ]
    }, [
      { key: 'passed', label: 'Passed', width: 14, type: 'integer' },
      { key: 'examTitle', label: 'Exam', width: 28, type: 'text' }
    ])
    const buffer = await workbook.xlsx.writeBuffer()
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(buffer)

    const sheet = reopened.getWorksheet('Exam Performance')
    expect(sheet).toBeDefined()
    expect(sheet.getRow(6).values.slice(1)).toEqual(['Passed', 'Exam'])
    expect(sheet.getRow(7).values.slice(1)).toEqual([1, 'Math'])
    expect(sheet.getRow(8).values.slice(1)).toEqual([2, 'Science'])
    expect(sheet.getCell('A6').fill.fgColor.argb).toBe('FFDC2626')
    expect(sheet.autoFilter).toBeDefined()
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 })
    expect(sheet.getColumn(1).width).toBe(14)
  })
})