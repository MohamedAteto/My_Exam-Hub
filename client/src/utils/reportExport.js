import { saveAs } from 'file-saver'

const RED = 'FFDC2626'
const PALE_RED = 'FFFEF2F2'
const BORDER = 'FFE5E7EB'

const excelValue = (value, column) => {
  if (value == null || value === '') return 'N/A'
  if (column.type === 'date') {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? 'N/A' : date
  }
  return value
}

export async function createReportWorkbook(report, selectedColumns) {
  const excelModule = await import('exceljs')
  const ExcelJS = excelModule.default ?? excelModule
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Exam Hub'
  workbook.created = new Date()
  workbook.subject = report.description || report.title

  const columns = selectedColumns
  const worksheet = workbook.addWorksheet((report.worksheetName || report.title || 'Report').slice(0, 31))
  worksheet.columns = columns.map(column => ({ key: column.key, width: column.width || 18 }))

  const mergedRow = (rowNumber, value) => {
    const row = worksheet.addRow([value])
    if (columns.length > 1) worksheet.mergeCells(rowNumber, 1, rowNumber, columns.length)
    return row
  }

  mergedRow(1, report.title || 'Exam Hub Report')
  mergedRow(2, report.description || '')
  mergedRow(3, `Generated: ${(report.generatedAt || new Date()).toLocaleString()}`)
  mergedRow(4, `Filters: ${(report.appliedFilters || []).join(' | ') || 'All Dashboard data'}`)
  mergedRow(5, `Summary: ${(report.summary || []).map(item => `${item.label}: ${item.value}`).join(' | ') || 'No summary'}`)

  const headerRow = worksheet.addRow(columns.map(column => column.label))
  headerRow.height = 26
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: RED } } }
  })

  for (const record of report.rows || []) {
    const row = worksheet.addRow(columns.map(column => excelValue(record[column.key], column)))
    row.height = 21
    row.eachCell((cell, columnNumber) => {
      const column = columns[columnNumber - 1]
      if (column.type === 'percentage' || column.type === 'score') cell.numFmt = '0.00"%"'
      if (column.type === 'integer') cell.numFmt = '#,##0'
      if (column.type === 'date') cell.numFmt = 'yyyy-mm-dd hh:mm'
      cell.alignment = { vertical: 'middle', horizontal: ['integer', 'percentage', 'score'].includes(column.type) ? 'right' : 'left' }
      cell.border = { bottom: { style: 'hair', color: { argb: BORDER } } }
      if (row.number % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALE_RED } }
    })
  }

  const lastRow = Math.max(headerRow.number, worksheet.rowCount)
  worksheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: lastRow, column: columns.length }
  }
  worksheet.views = [{ state: 'frozen', ySplit: headerRow.number, topLeftCell: `A${headerRow.number + 1}`, activePane: 'bottomLeft' }]

  worksheet.getRow(1).height = 30
  worksheet.getCell('A1').font = { bold: true, size: 17, color: { argb: 'FFFFFFFF' } }
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } }
  worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' }
  for (let rowNumber = 2; rowNumber <= 5; rowNumber++) {
    worksheet.getRow(rowNumber).height = rowNumber === 5 ? 24 : 20
    const cell = worksheet.getCell(rowNumber, 1)
    cell.font = { color: { argb: 'FF374151' }, size: 10, bold: rowNumber === 5 }
    cell.alignment = { vertical: 'middle', wrapText: true }
  }
  return workbook
}

export async function downloadReportExcel(report, selectedColumns, filename) {
  const workbook = await createReportWorkbook(report, selectedColumns)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}.xlsx`)
}

export async function downloadReportPng(element, filename) {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(element, { pixelRatio: 2.5, backgroundColor: '#ffffff', cacheBust: true })
  const blob = await (await fetch(dataUrl)).blob()
  saveAs(blob, `${filename}.png`)
}