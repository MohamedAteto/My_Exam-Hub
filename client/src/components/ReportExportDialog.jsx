import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, Image as ImageIcon, X } from 'lucide-react'
import { downloadReportExcel, downloadReportPng } from '../utils/reportExport'

const formatCell = (value, type) => {
  if (value === null || value === undefined || value === '') return 'N/A'
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString()
  }
  if (type === 'percentage' || type === 'score') return `${Number(value).toFixed(2)}%`
  return String(value)
}

const sanitizeFilename = (value) => String(value || 'exam-hub-report')
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/gi, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase() || 'exam-hub-report'

export default function ReportExportDialog({ open, onClose, report, appliedFilters = [] }) {
  const [selectedKeys, setSelectedKeys] = useState([])
  const [format, setFormat] = useState('xlsx')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const previewRef = useRef(null)

  const columns = report?.columns || []
  const rows = report?.rows || []
  const selectedColumns = useMemo(
    () => selectedKeys.map(key => columns.find(column => column.key === key)).filter(Boolean),
    [selectedKeys, columns]
  )

  useEffect(() => {
    if (!open) return
    setSelectedKeys(columns.filter(column => column.defaultSelected !== false).map(column => column.key))
    setFormat('xlsx')
    setError('')
    setSuccess('')
  }, [open, report?.id, columns])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isExporting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isExporting, onClose])

  if (!open) return null

  const toggleColumn = (key) => {
    setError('')
    setSuccess('')
    setSelectedKeys(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  const moveColumn = (key, direction) => {
    setSelectedKeys(current => {
      const index = current.indexOf(key)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const handleExport = async () => {
    setError('')
    setSuccess('')
    if (rows.length === 0) {
      setError('No data matches the selected Dashboard filters.')
      return
    }
    if (selectedColumns.length === 0) {
      setError('Select at least one column to export.')
      return
    }
    if (format === 'png' && !previewRef.current) {
      setError('The report preview is not ready yet.')
      return
    }

    setIsExporting(true)
    try {
      const exportReport = { ...report, appliedFilters, generatedAt: new Date() }
      const filename = sanitizeFilename(report.title)
      if (format === 'xlsx') await downloadReportExcel(exportReport, selectedColumns, filename)
      else await downloadReportPng(previewRef.current, filename)
      setSuccess(`${format === 'xlsx' ? 'Excel' : 'PNG'} report exported successfully.`)
    } catch (exportError) {
      setError(exportError?.message || 'The report could not be exported. Try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const columnLabelStyle = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, color: '#374151', fontSize: 13 }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isExporting) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(17, 24, 39, 0.48)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-export-title"
        style={{ width: 'min(1120px, 100%)', maxHeight: '92vh', background: '#fff', borderRadius: 10, boxShadow: '0 24px 70px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 id="report-export-title" style={{ margin: 0, color: '#111827', fontSize: 18, fontWeight: 700 }}>Export Report</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>{report.title}</p>
          </div>
          <button type="button" aria-label="Close report export" onClick={onClose} disabled={isExporting} style={{ border: 0, background: 'transparent', color: '#4b5563', cursor: 'pointer', padding: 6 }}>
            <X size={20} />
          </button>
        </header>

        <div className="report-export-content" style={{ overflow: 'auto', display: 'grid', gridTemplateColumns: '290px minmax(0, 1fr)', gap: 20, padding: 20 }}>
          <aside style={{ borderRight: '1px solid #e5e7eb', paddingRight: 18 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#111827' }}>Applied Filters</h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 5 }}>
              {appliedFilters.map((filter, index) => <li key={`${filter}-${index}`} style={{ color: '#4b5563', fontSize: 12, overflowWrap: 'anywhere' }}>{filter}</li>)}
            </ul>

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#111827' }}>Columns</h3>
                <span style={{ color: '#6b7280', fontSize: 11 }}>{selectedColumns.length} selected</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <button type="button" onClick={() => setSelectedKeys(columns.map(column => column.key))} style={smallButtonStyle}>Select All</button>
                <button type="button" onClick={() => setSelectedKeys([])} style={smallButtonStyle}>Deselect All</button>
                <button type="button" onClick={() => setSelectedKeys(columns.filter(column => column.defaultSelected !== false).map(column => column.key))} style={smallButtonStyle}>Reset</button>
              </div>
              <div style={{ display: 'grid', gap: 1 }}>
                {columns.map(column => {
                  const selectedIndex = selectedKeys.indexOf(column.key)
                  return (
                    <div key={column.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <label style={columnLabelStyle}>
                        <input type="checkbox" checked={selectedIndex >= 0} onChange={() => toggleColumn(column.key)} />
                        <span>{column.label}</span>
                      </label>
                      {selectedIndex >= 0 && (
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button type="button" aria-label={`Move ${column.label} up`} disabled={selectedIndex === 0} onClick={() => moveColumn(column.key, -1)} style={orderButtonStyle}>
                            <ArrowUp size={14} />
                          </button>
                          <button type="button" aria-label={`Move ${column.label} down`} disabled={selectedIndex === selectedKeys.length - 1} onClick={() => moveColumn(column.key, 1)} style={orderButtonStyle}>
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <fieldset style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '14px 0 0', padding: '14px 0 0' }}>
              <legend style={{ padding: 0, marginBottom: 8, color: '#111827', fontSize: 14, fontWeight: 700 }}>Format</legend>
              <label style={{ ...columnLabelStyle, cursor: 'pointer' }}><input type="radio" name="report-format" value="xlsx" checked={format === 'xlsx'} onChange={() => setFormat('xlsx')} /><FileSpreadsheet size={16} color="#b91c1c" /> Excel (.xlsx)</label>
              <label style={{ ...columnLabelStyle, cursor: 'pointer' }}><input type="radio" name="report-format" value="png" checked={format === 'png'} onChange={() => setFormat('png')} /><ImageIcon size={16} color="#b91c1c" /> PNG Image</label>
            </fieldset>
          </aside>

          <div style={{ minWidth: 0 }}>
            <div ref={previewRef} style={{ background: '#fff', padding: 18, border: '1px solid #e5e7eb', color: '#111827' }}>
              <div style={{ borderBottom: '3px solid #dc2626', paddingBottom: 12, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 21, color: '#111827' }}>{report.title}</h2>
                <p style={{ margin: '5px 0 0', color: '#4b5563', fontSize: 12 }}>{report.description}</p>
                <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 11 }}>Generated {new Date().toLocaleString()}</p>
              </div>
              {report.summary?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginBottom: 12, fontSize: 12 }}>
                  {report.summary.map(item => <span key={item.label}><strong>{item.label}:</strong> {item.value}</span>)}
                </div>
              )}
              <div style={{ color: '#4b5563', fontSize: 11, marginBottom: 12 }}>{appliedFilters.join('  |  ')}</div>
              {rows.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>No data matches the selected Dashboard filters.</div>
              ) : selectedColumns.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#6b7280' }}>Select at least one column to preview the report.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr>{selectedColumns.map(column => <th key={column.key} style={{ padding: '8px 7px', background: '#dc2626', color: '#fff', textAlign: 'left', border: '1px solid #b91c1c' }}>{column.label}</th>)}</tr></thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id ?? row.examId ?? `${index}`} style={{ background: index % 2 ? '#fef2f2' : '#fff' }}>
                        {selectedColumns.map(column => <td key={column.key} style={{ padding: '7px', borderBottom: '1px solid #e5e7eb', color: '#374151', textAlign: ['integer', 'percentage', 'score'].includes(column.type) ? 'right' : 'left', verticalAlign: 'top' }}>{formatCell(row[column.key], column.type)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <footer style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div role="status" aria-live="polite" style={{ flex: 1, minWidth: 180, color: error ? '#b91c1c' : success ? '#047857' : '#6b7280', fontSize: 12 }}>
            {error || success || (rows.length === 0 ? 'No data matches the selected filters.' : '')}
          </div>
          <button type="button" onClick={onClose} disabled={isExporting} style={secondaryButtonStyle}>Cancel</button>
          <button type="button" onClick={handleExport} disabled={isExporting || rows.length === 0 || selectedColumns.length === 0} style={primaryButtonStyle}>
            <Download size={16} /> {isExporting ? 'Preparing…' : 'Export'}
          </button>
        </footer>
      </section>
      <style>{`@media (max-width: 720px) { .report-export-content { grid-template-columns: 1fr !important; } .report-export-content aside { border-right: 0 !important; border-bottom: 1px solid #e5e7eb; padding: 0 0 16px !important; } }`}</style>
    </div>
  )
}

const smallButtonStyle = { border: '1px solid #e5e7eb', background: '#fff', borderRadius: 5, padding: '4px 7px', color: '#374151', fontSize: 11, cursor: 'pointer' }
const orderButtonStyle = { border: 0, background: 'transparent', padding: 3, color: '#4b5563', cursor: 'pointer' }
const secondaryButtonStyle = { background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', color: '#374151', cursor: 'pointer', fontWeight: 600 }
const primaryButtonStyle = { background: '#dc2626', border: '1px solid #dc2626', borderRadius: 6, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 }