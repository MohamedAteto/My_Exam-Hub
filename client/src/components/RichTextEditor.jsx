import React, { useState, useRef } from 'react'

const RichTextEditor = ({ value = '', onChange, placeholder = "Enter your question here...", autoFocus = false }) => {
  const [showMathSymbols, setShowMathSymbols] = useState(false)
  const [showFormatting, setShowFormatting] = useState(false)
  const fileInputRef = useRef(null)

  const mathSymbols = [
    { symbol: '±', name: 'Plus-minus' },
    { symbol: '×', name: 'Multiplication' },
    { symbol: '÷', name: 'Division' },
    { symbol: '√', name: 'Square root' },
    { symbol: '²', name: 'Squared' },
    { symbol: '³', name: 'Cubed' },
    { symbol: '∞', name: 'Infinity' },
    { symbol: '≤', name: 'Less than or equal' },
    { symbol: '≥', name: 'Greater than or equal' },
    { symbol: '≠', name: 'Not equal' },
    { symbol: '≈', name: 'Approximately' },
    { symbol: '∑', name: 'Summation' },
    { symbol: '∫', name: 'Integral' },
    { symbol: 'π', name: 'Pi' },
    { symbol: 'θ', name: 'Theta' },
    { symbol: 'α', name: 'Alpha' },
    { symbol: 'β', name: 'Beta' },
    { symbol: 'γ', name: 'Gamma' },
    { symbol: 'δ', name: 'Delta' },
    { symbol: 'ε', name: 'Epsilon' },
    { symbol: 'φ', name: 'Phi' },
    { symbol: 'λ', name: 'Lambda' },
    { symbol: 'μ', name: 'Mu' },
    { symbol: 'σ', name: 'Sigma' },
    { symbol: 'τ', name: 'Tau' },
    { symbol: 'ω', name: 'Omega' },
    { symbol: '→', name: 'Arrow right' },
    { symbol: '←', name: 'Arrow left' },
    { symbol: '↑', name: 'Arrow up' },
    { symbol: '↓', name: 'Arrow down' },
    { symbol: '↔', name: 'Arrow both ways' },
    { symbol: '∠', name: 'Angle' },
    { symbol: '⊥', name: 'Perpendicular' },
    { symbol: '∥', name: 'Parallel' },
    { symbol: '°', name: 'Degrees' },
    { symbol: '′', name: 'Prime' },
    { symbol: '″', name: 'Double prime' },
    { symbol: '‰', name: 'Per mille' },
    { symbol: '‱', name: 'Per ten thousand' },
    { symbol: '⅟', name: 'Fraction 1/n' },
    { symbol: '½', name: 'One half' },
    { symbol: '⅓', name: 'One third' },
    { symbol: '⅔', name: 'Two thirds' },
    { symbol: '¼', name: 'One quarter' },
    { symbol: '¾', name: 'Three quarters' },
    { symbol: '⅕', name: 'One fifth' },
    { symbol: '⅖', name: 'Two fifths' },
    { symbol: '⅗', name: 'Three fifths' },
    { symbol: '⅘', name: 'Four fifths' },
    { symbol: '⅙', name: 'One sixth' },
    { symbol: '⅚', name: 'Five sixths' },
    { symbol: '⅐', name: 'One seventh' },
    { symbol: '⅛', name: 'One eighth' },
    { symbol: '⅜', name: 'Three eighths' },
    { symbol: '⅝', name: 'Five eighths' },
    { symbol: '⅞', name: 'Seven eighths' },
    { symbol: '⅑', name: 'One ninth' },
    { symbol: '⅒', name: 'One tenth' }
  ]

  const insertMathSymbol = (symbol) => {
    const textarea = document.getElementById('rich-text-editor')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + symbol + value.substring(end)
      if (onChange) onChange(newValue)

      // Set cursor position after the inserted symbol
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + symbol.length, start + symbol.length)
      }, 0)
    }
  }

  const insertFormatting = (format) => {
    const textarea = document.getElementById('rich-text-editor')
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = value.substring(start, end)

      let newValue
      switch (format) {
        case 'bold':
          newValue = value.substring(0, start) + `**${selectedText}**` + value.substring(end)
          break
        case 'italic':
          newValue = value.substring(0, start) + `*${selectedText}*` + value.substring(end)
          break
        case 'underline':
          newValue = value.substring(0, start) + `__${selectedText}__` + value.substring(end)
          break
        case 'superscript':
          newValue = value.substring(0, start) + `^${selectedText}^` + value.substring(end)
          break
        case 'subscript':
          newValue = value.substring(0, start) + `~${selectedText}~` + value.substring(end)
          break
        case 'fraction':
          newValue = value.substring(0, start) + `(${selectedText})` + value.substring(end)
          break
        default:
          return
      }

      onChange(newValue)

      // Set cursor position after the formatting
      setTimeout(() => {
        textarea.focus()
        if (format === 'fraction') {
          textarea.setSelectionRange(start + 1, start + 1)
        } else {
          textarea.setSelectionRange(start + 2, start + 2)
        }
      }, 0)
    }
  }

  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imgTag = `![${file.name}](${e.target.result})`
        const textarea = document.getElementById('rich-text-editor')
        if (textarea) {
          const start = textarea.selectionStart
          const newValue = value.substring(0, start) + imgTag + value.substring(start)
          onChange(newValue)

          // Set cursor position after the image tag
          setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + imgTag.length, start + imgTag.length)
          }, 0)
        }
      }
      reader.readAsDataURL(file)
    }

    // Reset file input
    event.target.value = ''
  }

  const renderPreview = () => {
    if (!value) return null

    let html = value

    // Convert markdown-like formatting to HTML
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    html = html.replace(/__(.*?)__/g, '<u>$1</u>')
    html = html.replace(/\^(.*?)\^/g, '<sup>$1</sup>')
    html = html.replace(/~(.*?)~/g, '<sub>$1</sub>')
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />')

    return (
      <div className="rich-text-preview">
        <h4>Preview:</h4>
        <div
          className="preview-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  return (
    <div className="rich-text-editor-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="editor-toolbar" style={{
        display: 'flex',
        gap: '.75rem',
        marginBottom: '.75rem',
        flexWrap: 'wrap'
      }}>
        <button
          type="button"
          onClick={() => setShowMathSymbols(!showMathSymbols)}
          title="Math Symbols"
          style={{
            padding: '.75rem 1.25rem',
            background: showMathSymbols ? '#dc2626' : 'white',
            color: showMathSymbols ? 'white' : '#374151',
            border: showMathSymbols ? 'none' : '2px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: showMathSymbols ? '0 4px 12px rgba(220,38,38,.25)' : '0 1px 3px rgba(0,0,0,.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.5rem'
          }}
          onMouseEnter={(e) => {
            if (!showMathSymbols) {
              e.currentTarget.style.borderColor = '#dc2626'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(220,38,38,.15)'
            }
          }}
          onMouseLeave={(e) => {
            if (!showMathSymbols) {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)'
            }
          }}
        >
          ∑ Math
        </button>

        <button
          type="button"
          onClick={() => setShowFormatting(!showFormatting)}
          title="Text Formatting"
          style={{
            padding: '.75rem 1.25rem',
            background: showFormatting ? '#dc2626' : 'white',
            color: showFormatting ? 'white' : '#374151',
            border: showFormatting ? 'none' : '2px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: showFormatting ? '0 4px 12px rgba(220,38,38,.25)' : '0 1px 3px rgba(0,0,0,.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.5rem'
          }}
          onMouseEnter={(e) => {
            if (!showFormatting) {
              e.currentTarget.style.borderColor = '#dc2626'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(220,38,38,.15)'
            }
          }}
          onMouseLeave={(e) => {
            if (!showFormatting) {
              e.currentTarget.style.borderColor = '#d1d5db'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)'
            }
          }}
        >
          ✎ Format
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Insert Image"
          style={{
            padding: '.75rem 1.25rem',
            background: 'white',
            color: '#374151',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,.1)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#dc2626'
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(220,38,38,.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#d1d5db'
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.1)'
          }}
        >
          🖼 Image
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
      </div>

      {showMathSymbols && (
        <div className="math-symbols-panel card">
          <div className="symbols-grid">
            {mathSymbols.map((item, index) => (
              <button
                key={index}
                type="button"
                className="symbol-btn pill"
                onClick={() => insertMathSymbol(item.symbol)}
                title={item.name}
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {showFormatting && (
        <div className="formatting-panel card">
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('bold')}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('italic')}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('underline')}
            title="Underline"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('superscript')}
            title="Superscript"
          >
            X<sup>2</sup>
          </button>
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('subscript')}
            title="Subscript"
          >
            X<sub>2</sub>
          </button>
          <button
            type="button"
            className="format-btn pill"
            onClick={() => insertFormatting('fraction')}
            title="Fraction"
          >
            <span style={{ fontSize: '0.8em' }}>a/b</span>
          </button>
        </div>
      )}

      <textarea
        id="rich-text-editor"
        className="rich-text-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
              case 'b':
                e.preventDefault()
                insertFormatting('bold')
                break
              case 'i':
                e.preventDefault()
                insertFormatting('italic')
                break
              case 'u':
                e.preventDefault()
                insertFormatting('underline')
                break
              default:
                break
            }
          }
        }}
        rows={10}
        autoFocus={autoFocus}
      />

      {renderPreview()}
    </div>
  )
}

export default RichTextEditor
