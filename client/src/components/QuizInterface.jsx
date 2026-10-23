// FEATURE: AUTOMATIC ANSWER SAVING
import React, { useState, useEffect } from 'react'

export default function QuizInterface({
  currentQuiz,
  isReviewMode,
  formatTimerDisplay,
  timeRemaining,
  submitQuiz,
  backToDashboard,
  answers = {},
  onAnswerChange,
  saveStatus = 'saved', // 'idle' | 'saving' | 'saved' | 'offline' | 'error'
  onRetrySave,
}) {
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  if (!currentQuiz) return null

  // Helper function to render rich text (markdown-like to HTML)
  const renderRichText = (text) => {
    if (!text) return { __html: '' }
    let html = text
    // Convert markdown-like formatting to HTML
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    html = html.replace(/__(.*?)__/g, '<u>$1</u>')
    html = html.replace(/\^(.*?)\^/g, '<sup>$1</sup>')
    html = html.replace(/~(.*?)~/g, '<sub>$1</sub>')
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />')
    return { __html: html }
  }

  // FEATURE: AUTOMATIC ANSWER SAVING - Helper function to create reactive question HTML
  const createQuestionHTML = (question, index, reviewMode = false) => {
    const num = index + 1
    const currentVal = answers[question.id]

    if (question.type === 'mcq') {
      return (
        <div className="mcq-options">
          {question.options.map((option, optionIndex) => {
            let optionClass = 'mcq-option'
            let indicator = null
            let style = {}

            if (reviewMode) {
              const isCorrect = optionIndex === question.correct
              const isUser = optionIndex === question.userAnswer

              if (isCorrect) {
                optionClass += ' correct'
                style = { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
                indicator = <span className="answer-indicator correct" style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Correct Answer</span>
              }
              if (isUser && !isCorrect) {
                optionClass += ' incorrect'
                style = { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' }
                indicator = <span className="answer-indicator incorrect" style={{ color: '#ef4444', fontWeight: 'bold' }}>✗ Your Answer (Incorrect)</span>
              }
              if (isUser && isCorrect) {
                style = { ...style, backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
              }
            }

            const isChecked = reviewMode
              ? (optionIndex === question.userAnswer || option === question.userAnswer)
              : (currentVal !== undefined && (currentVal === option || currentVal === optionIndex || String(currentVal).trim() === String(option).trim()))

            return (
              <label key={optionIndex} className={optionClass} htmlFor={`q${num}_${optionIndex}`} style={style}>
                <input
                  type="radio"
                  id={`q${num}_${optionIndex}`}
                  name={`question_${num}`}
                  value={option}
                  disabled={reviewMode}
                  checked={Boolean(isChecked)}
                  onChange={(e) => {
                    if (!reviewMode && onAnswerChange) {
                      onAnswerChange(question.id, e.target.value)
                    }
                  }}
                />
                <span dangerouslySetInnerHTML={renderRichText(option)} />
                {indicator}
              </label>
            )
          })}
        </div>
      )
    }

    if (question.type === 'tf') {
      const trueCorrect = reviewMode && question.correct === true
      const trueUser = reviewMode && question.userAnswer === true
      const falseCorrect = reviewMode && question.correct === false
      const falseUser = reviewMode && question.userAnswer === false

      const trueStyle = trueCorrect ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' } :
        (trueUser && !trueCorrect) ? { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' } : {}
      const falseStyle = falseCorrect ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' } :
        (falseUser && !falseCorrect) ? { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' } : {}

      const trueChecked = reviewMode
        ? (question.userAnswer === true || String(question.userAnswer).toLowerCase() === 'true')
        : (currentVal !== undefined && String(currentVal).toLowerCase() === 'true')

      const falseChecked = reviewMode
        ? (question.userAnswer === false || String(question.userAnswer).toLowerCase() === 'false')
        : (currentVal !== undefined && String(currentVal).toLowerCase() === 'false')

      return (
        <div className="tf-options">
          <label className={trueCorrect ? 'tf-option correct' : (trueUser && !trueCorrect) ? 'tf-option incorrect' : 'tf-option'}
            htmlFor={`q${num}_true`} style={trueStyle}>
            <input
              type="radio"
              id={`q${num}_true`}
              name={`question_${num}`}
              value="true"
              disabled={reviewMode}
              checked={Boolean(trueChecked)}
              onChange={() => {
                if (!reviewMode && onAnswerChange) {
                  onAnswerChange(question.id, 'true')
                }
              }}
            />
            <span>True</span>
            {trueCorrect && <span className="answer-indicator correct" style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Correct Answer</span>}
            {trueUser && !trueCorrect && <span className="answer-indicator incorrect" style={{ color: '#ef4444', fontWeight: 'bold' }}>✗ Your Answer (Incorrect)</span>}
          </label>
          <label className={falseCorrect ? 'tf-option correct' : (falseUser && !falseCorrect) ? 'tf-option incorrect' : 'tf-option'}
            htmlFor={`q${num}_false`} style={falseStyle}>
            <input
              type="radio"
              id={`q${num}_false`}
              name={`question_${num}`}
              value="false"
              disabled={reviewMode}
              checked={Boolean(falseChecked)}
              onChange={() => {
                if (!reviewMode && onAnswerChange) {
                  onAnswerChange(question.id, 'false')
                }
              }}
            />
            <span>False</span>
            {falseCorrect && <span className="answer-indicator correct" style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Correct Answer</span>}
            {falseUser && !falseCorrect && <span className="answer-indicator incorrect" style={{ color: '#ef4444', fontWeight: 'bold' }}>✗ Your Answer (Incorrect)</span>}
          </label>
        </div>
      )
    }

    if (question.type === 'fill') {
      const isCorrect = reviewMode && question.userAnswer && question.userAnswer.toLowerCase().trim() === question.correct.toLowerCase().trim()
      const inputClass = reviewMode ? (isCorrect ? 'fill-input correct' : 'fill-input incorrect') : 'fill-input'
      const inputStyle = isCorrect ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' } :
        (reviewMode && !isCorrect) ? { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' } : {}

      return (
        <div className="fill-gap">
          <input
            type="text"
            className={inputClass}
            name={`question_${num}`}
            placeholder="Enter your answer..."
            disabled={reviewMode}
            value={reviewMode ? (question.userAnswer || '') : (currentVal ?? '')}
            onChange={(e) => {
              if (!reviewMode && onAnswerChange) {
                onAnswerChange(question.id, e.target.value)
              }
            }}
            style={inputStyle}
          />
          {reviewMode ? (
            <div className={`fill-answer-display ${isCorrect ? 'correct' : 'incorrect'}`} style={isCorrect ? { color: '#10b981', fontWeight: 'bold' } : { color: '#ef4444', fontWeight: 'bold' }}>
              {isCorrect ? '✓ Correct!' : <span>✗ Your answer: "{question.userAnswer || 'No answer'}" | Correct answer: <span dangerouslySetInnerHTML={renderRichText(question.correct)} /></span>}
            </div>
          ) : null}
        </div>
      )
    }
    return null
  }

  useEffect(() => {
    if (currentQuiz && !isReviewMode && timeRemaining === 0) {
      setShowSuccessMessage(true)
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
      }, 2000)
      return () => clearTimeout(timer)
    } else {
      setShowSuccessMessage(false)
    }
  }, [currentQuiz, isReviewMode, timeRemaining])

  return (
    <div id="quiz-view" className={`quiz-interface ${currentQuiz ? 'active' : ''}`}>
      <style>{`
        @keyframes autoSaveSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .autosave-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #f59e0b;
          border-top-color: transparent;
          border-radius: 50%;
          animation: autoSaveSpin 0.8s linear infinite;
        }
      `}</style>
      <div className={isReviewMode ? 'quiz-review-header' : 'quiz-header'} id="quiz-header">
        {isReviewMode && (
          <button
            className="quiz-close-btn"
            onClick={backToDashboard}
            aria-label="Close exam"
          >
            ×
          </button>
        )}
        <h1 className="quiz-title" id="current-quiz-title">
          {currentQuiz.name}{isReviewMode ? ' - Review' : ''}
        </h1>
        <div className={isReviewMode ? 'review-score' : 'quiz-timer-display'} id="quiz-timer-display">
          {isReviewMode ? `Score: ${currentQuiz.earnedMarks ?? 0}/${currentQuiz.totalMarks ?? currentQuiz.questions.reduce((t, q) => t + (q.marks || 1), 0)} Marks` : formatTimerDisplay(timeRemaining)}
        </div>
        <div className="quiz-info-bar">
          <span id="quiz-subject">{currentQuiz.subject}</span>
          <span id="quiz-questions-count">{currentQuiz.questions.length} Questions</span>
          {isReviewMode && currentQuiz.totalMarks && (
            <span id="quiz-total-marks">Total: {currentQuiz.totalMarks} Marks</span>
          )}

          {/* FEATURE: AUTOMATIC ANSWER SAVING - Unobtrusive Save Status Badge */}
          {!isReviewMode && (
            <div
              className="save-status-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 500,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.2s ease'
              }}
            >
              {saveStatus === 'saving' && (
                <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span className="autosave-spinner" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Saved
                </span>
              )}
              {saveStatus === 'offline' && (
                <span style={{ color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                  Offline / Waiting to reconnect
                </span>
              )}
              {saveStatus === 'error' && (
                <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Save failed
                  {onRetrySave && (
                    <button
                      type="button"
                      onClick={onRetrySave}
                      style={{
                        marginLeft: '3px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      Retry
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <form
        className="quiz-form"
        id="quiz-form"
        onSubmit={(e) => { e.preventDefault(); if (!isReviewMode) submitQuiz(); }}
      >
        <div className={`success-message ${showSuccessMessage ? 'show' : ''}`} id="success-message">
          Exam submitted successfully! Moving to completed exams...
        </div>
        <div id="quiz-questions">
          {currentQuiz.questions.map((question, index) => (
            <div key={question.id || index} className="question">
              <span className="question-number">{index + 1}</span>
              <span className="question-text" dangerouslySetInnerHTML={renderRichText(question.question)} />
              <span className="question-type">{(question.type || '').toUpperCase()}</span>
              {question.marks && (
                <span className="question-marks">
                  {question.marks} Marks
                </span>
              )}
              {createQuestionHTML(question, index, isReviewMode)}
            </div>
          ))}
        </div>
        <div className="submit-section" id="submit-section">
          {!isReviewMode && (
            <button type="submit" className="submit-btn" id="submit-btn">
              Submit Quiz
            </button>
          )}
          {isReviewMode && (
            <button
              type="button"
              className="back-btn"
              onClick={backToDashboard}
              style={{ marginLeft: !isReviewMode ? '1rem' : 0 }}
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
