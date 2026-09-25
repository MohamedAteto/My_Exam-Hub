import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportExportDialog from './ReportExportDialog'
import { downloadReportExcel, downloadReportPng } from '../utils/reportExport'

vi.mock('../utils/reportExport', () => ({
  downloadReportExcel: vi.fn().mockResolvedValue(undefined),
  downloadReportPng: vi.fn().mockResolvedValue(undefined)
}))

const report = {
  id: 'student-report',
  title: 'Student Performance Report',
  description: 'Filtered student results',
  columns: [
    { key: 'name', label: 'Student Name', type: 'text', defaultSelected: true },
    { key: 'score', label: 'Score', type: 'score', defaultSelected: true }
  ],
  rows: [{ name: 'Student One', score: 80 }],
  summary: [{ label: 'Students', value: 1 }]
}

describe('ReportExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports Excel using the reordered selected columns only', async () => {
    render(<ReportExportDialog open report={report} appliedFilters={['Grade: Junior']} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Move Score up' }))
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))

    await waitFor(() => expect(downloadReportExcel).toHaveBeenCalled())
    const [exportReport, selectedColumns, filename] = downloadReportExcel.mock.calls[0]
    expect(exportReport.appliedFilters).toEqual(['Grade: Junior'])
    expect(selectedColumns.map(column => column.key)).toEqual(['score', 'name'])
    expect(filename).toBe('student-performance-report')
  })

  it('exports the report preview as PNG', async () => {
    render(<ReportExportDialog open report={report} appliedFilters={[]} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Score' }))
    fireEvent.click(screen.getByRole('radio', { name: /PNG Image/ }))
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))

    await waitFor(() => expect(downloadReportPng).toHaveBeenCalled())
    const preview = downloadReportPng.mock.calls[0][0]
    expect(preview).toBeInstanceOf(HTMLElement)
    expect(preview.querySelectorAll('thead th')).toHaveLength(1)
    expect(downloadReportPng.mock.calls[0][1]).toBe('student-performance-report')
  })

  it('supports Select All, Deselect All, and Reset to Default', () => {
    const reportWithOptionalColumn = {
      ...report,
      columns: report.columns.map((column, index) => ({ ...column, defaultSelected: index === 0 }))
    }
    render(<ReportExportDialog open report={reportWithOptionalColumn} appliedFilters={[]} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }))
    expect(screen.getByText('0 selected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }))
    expect(screen.getByText('2 selected')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('1 selected')).toBeTruthy()
  })

  it('disables export when filters produce no rows', () => {
    render(<ReportExportDialog open report={{ ...report, rows: [] }} appliedFilters={[]} onClose={() => {}} />)
    expect(screen.getByText('No data matches the selected Dashboard filters.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Export/ })).toBeDisabled()
  })
})