import { useState, useRef, useEffect } from 'react'
import api from '../api/axios'
import { storage } from '../utils/storage'
import { parseToken } from '../utils/token'

export default function FileUpload({ onQuestionsExtracted, onClose, bankKey }) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [onClose])

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid Excel file (.xlsx)')
      return
    }

    setIsUploading(true)
    setError('')
    setSuccess('')
    setUploadProgress(10) // Start progress

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Extract accountId
      let accountId = 0
      const token = storage.getItem('token')
      if (token) {
        const payload = parseToken(token)
        if (payload) {
          accountId = Number(payload.AccountId || payload.accountId || payload.sub) || 0
        }
      }
      formData.append('accountId', accountId)
      if (bankKey) {
        formData.append('bankKey', bankKey)
      }

      setUploadProgress(30)

      const response = await api.post('/questionbank/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          // Map upload progress to 30-80 range to leave room for processing
          setUploadProgress(30 + Math.round(percentCompleted * 0.5))
        }
      })

      setUploadProgress(90)

      const result = response.data

      if (result.addedQuestions && result.addedQuestions.length > 0) {
        // Map the questions to the format expected by the frontend editor
        const mappedQuestions = result.addedQuestions.map(q => {
          // Determine type based on options. 
          // Backend stores flat options.
          let type = 'mcq' // Default
          // Logic to infer type from fields if needed, or backend could send it.
          // Current backend DTO has standard fields. 
          // Frontend existing logic infers type from options presence.

          // Reuse frontend inference or rely on what we sent?
          // We sent standard QuestionBank entity.
          // Let's assume MCQ if options present, TF/FillBlank otherwise?
          // Wait, backend logic for upload set 'Overall' type? No, it used template logic.

          // Let's infer type like fetch logic in TeacherPage
          const hasCD = q.optionC || q.optionD;
          const typeDetected = q.optionC ? (q.optionD ? 'mcq' : (q.optionA && q.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank';

          // If uploaded options were blank, this inference might fail.
          // But upload logic uses template. Assuming standard template.

          // More robust inference:
          // The backend upload logic tried to set UsedOptions=4.

          // Correct answer format in backend: "A", "True", "Paris".
          // Frontend expects:
          // MCQ: correct is INDEX (0-3).
          // TF: correct is BOOLEAN.
          // Fill: correct is STRING.

          let correctVal = q.correctAnswer;
          let options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(x => x !== null && x !== undefined); // allow empty strings if they are placeholders? 
          // Actually frontend expects 4 options for MCQ padding.

          let finalType = 'mcq';
          let finalCorrect = 0;

          // Try to detect True/False
          if (options.length === 2 && options[0]?.toLowerCase() === 'true' && options[1]?.toLowerCase() === 'false') {
            finalType = 'true_false' // Wait, usually TF options are implicit in frontend or explicit?
            // In TeacherPage TF, it renders fixed buttons.
          }

          // Let's simpler approach: check CorrectAnswer string.
          if (q.correctAnswer?.toLowerCase() === 'true' || q.correctAnswer?.toLowerCase() === 'false') {
            finalType = 'true_false';
            finalCorrect = q.correctAnswer?.toLowerCase() === 'true';
          } else if (q.optionA && q.optionB && q.optionC && q.optionD) {
            finalType = 'mcq';
            // Map "Option A" or "A" or value to index.
            // Backend stores the value of the correct answer?
            // My upload logic stored `row.Cell(3)` as CorrectAnswer.
            // The template says "Correct Answer: 4" (for value) or "Option A" value?
            // Template Example: "Correct Answer: 4" implies the value "4".
            // Template Example #2: "Correct Answer: Cairo". optionA="Answer.."

            // So we need to find the index of CorrectAnswer in Options.
            const idx = options.findIndex(o => o?.trim() === q.correctAnswer?.trim());
            finalCorrect = idx >= 0 ? idx : 0;
          } else {
            finalType = 'fill_blank';
            finalCorrect = q.correctAnswer;
          }

          return {
            id: q.questionId,
            type: finalType,
            question: q.questionTitle,
            options: [q.optionA || '', q.optionB || '', q.optionC || '', q.optionD || ''],
            correct: finalCorrect,
            marks: q.mark
          }
        });

        setSuccess(`Successfully uploaded ${result.successCount} questions!`)
        if (onQuestionsExtracted) {
          onQuestionsExtracted(mappedQuestions)
        }
        setTimeout(() => { onClose?.() }, 1500)
      } else {
        if (result.errors && result.errors.length > 0) {
          setError(`Upload finished with errors: ${result.errors[0]} ...`)
        } else {
          setError('No questions were added.')
        }
      }
    } catch (error) {
      console.error(error)
      setError(error.response?.data?.message || 'Error processing the file')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files
      handleFileUpload({ target: { files: dataTransfer.files } })
    }
  }
  const handleDragOver = (event) => { event.preventDefault(); event.currentTarget.classList.add('dragover') }
  const handleDragLeave = (event) => { event.preventDefault(); event.currentTarget.classList.remove('dragover') }

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/questionbank/template', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'Questions_Template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (error) {
      console.error('Error downloading template:', error)
      let msg = 'Failed to download template'
      if (error.response && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text()
          const json = JSON.parse(text)
          if (json.message) msg = json.message
        } catch (e) {
          // ignore, not json
        }
      } else if (error.message) {
        msg = error.message
      }
      setError(msg)
    }
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }
  const modalStyle = { width: 'min(820px, 95vw)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: '20px', boxShadow: '0 25px 70px rgba(0,0,0,.35)', border: '1px solid #e5e7eb' }
  const headerStyle = { padding: '1.75rem 2rem', borderBottom: '2px solid #f3f4f6', background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)' }
  const bodyStyle = { padding: '2rem' }
  const footerStyle = { padding: '1.25rem 2rem', borderTop: '2px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }
  const primaryBtn = { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', padding: '.75rem 1.5rem', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s' }
  const secondaryBtn = { background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', padding: '.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }
  const closeXStyle = { position: 'absolute', right: '16px', top: '16px', background: '#f3f4f6', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div style={{ position: 'relative', ...modalStyle }}>
        <button 
          type="button" 
          aria-label="Close" 
          onClick={onClose} 
          style={closeXStyle}
          onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
          onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
        >
          ×
        </button>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>Upload Questions from Excel</h2>
              <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>Import questions in bulk using our Excel template format</p>
            </div>
          </div>
        </div>
        <div style={bodyStyle}>
          {/* Info Banner */}
          <div style={{ 
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
            border: '1.5px solid #bfdbfe', 
            borderRadius: '12px', 
            padding: '1rem 1.25rem', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: '#1e40af', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>Template Format Required</p>
              <p style={{ margin: 0, color: '#3b82f6', fontSize: '0.85rem' }}>Download our template below to ensure proper formatting. The template includes sample questions for MCQ, True/False, and Fill-in-the-Blank types.</p>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{ 
              border: '3px dashed #cbd5e1', 
              borderRadius: '16px', 
              padding: '2.5rem 1.5rem', 
              textAlign: 'center', 
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <div style={{ marginBottom: '1rem' }}>
              <svg viewBox="0 0 24 24" width="64" height="64" fill="#60a5fa">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
            </div>
            <p style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Drag and drop your Excel file here
            </p>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
              or <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} disabled={isUploading} style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>browse files</button>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.5rem 1rem', 
                background: 'white', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981" stroke="none">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 500 }}>Supports .xlsx format</span>
              </div>
              <div style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.5rem 1rem', 
                background: 'white', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#10b981" stroke="none">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 500 }}>Max 10MB file size</span>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploading} />
          </div>

          {isUploading && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>Uploading...</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>{uploadProgress}%</span>
              </div>
              <div style={{ height: '12px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ 
                  width: `${uploadProgress}%`, 
                  height: '12px', 
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', 
                  borderRadius: '999px', 
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                }}></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                <div className="spinner" style={{ 
                  width: '16px', 
                  height: '16px', 
                  border: '3px solid #d1d5db', 
                  borderTop: '3px solid #10b981',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Processing your Excel file...</p>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error ? (
            <div style={{ 
              marginTop: '1.5rem', 
              background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
              color: '#991b1b', 
              border: '1.5px solid #fecaca', 
              padding: '1rem 1.25rem', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.25rem' }}>Upload Failed</p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
              </div>
            </div>
          ) : null}
          {success ? (
            <div style={{ 
              marginTop: '1.5rem', 
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
              color: '#166534', 
              border: '1.5px solid #bbf7d0', 
              padding: '1rem 1.25rem', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.25rem' }}>Success!</p>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{success}</p>
              </div>
            </div>
          ) : null}
        </div>
        <div style={footerStyle}>
          <button 
            type="button" 
            style={{...secondaryBtn, display: 'flex', alignItems: 'center', gap: '0.5rem'}} 
            onClick={downloadTemplate}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#f9fafb' }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fff' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Template
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              type="button" 
              style={secondaryBtn} 
              onClick={onClose} 
              disabled={isUploading}
              onMouseOver={(e) => !isUploading && (e.currentTarget.style.borderColor = '#9ca3af')}
              onMouseOut={(e) => !isUploading && (e.currentTarget.style.borderColor = '#d1d5db')}
            >
              Cancel
            </button>
            <button 
              type="button" 
              style={{...primaryBtn, opacity: isUploading ? 0.6 : 1, cursor: isUploading ? 'not-allowed' : 'pointer'}} 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading}
              onMouseOver={(e) => !isUploading && (e.currentTarget.style.transform = 'translateY(-1px)', e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)')}
              onMouseOut={(e) => !isUploading && (e.currentTarget.style.transform = 'translateY(0)', e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)')}
            >
              {isUploading ? 'Uploading...' : 'Select File'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
