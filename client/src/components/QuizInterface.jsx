/**
 * QuizInterface.jsx
 *
 * Renders the student exam-taking UI (one question at a time) and the
 * post-submission review UI (all questions, read-only with highlighting).
 *
 * Active-exam props (new in Phase 3):
 *   answers            – { [questionId]: string }  controlled answer state from StudentPage
 *   onAnswerChange     – (questionId, value) => void
 *   markedForReview    – Set<questionId>
 *   onToggleReview     – (questionId) => void
 *   currentQuestionIndex – number (0-based)
 *   onNavigate         – (index) => void
 *   onRequestSubmit    – () => void  called when student clicks "Finish Exam"
 *
 * Unchanged props (all still required):
 *   currentQuiz, isReviewMode, formatTimerDisplay, timeRemaining,
 *   submitQuiz, backToDashboard
 */

import { useState } from 'react'

export default function QuizInterface({
  // ── original props (unchanged) ──────────────────────────────────────
  currentQuiz,
  isReviewMode,
  formatTimerDisplay,
  timeRemaining,
  submitQuiz,
  backToDashboard,
  // ── new Phase-3 props (active-exam only) ────────────────────────────
  answers = {},
  onAnswerChange,
  markedForReview = new Set(),
  onToggleReview,
  currentQuestionIndex = 0,
  onNavigate,
  onRequestSubmit,
}) {
  // ── local state ──────────────────────────────────────────────────────
  // Confirmation dialog shown before final submission
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  // Whether the small question-grid panel is open
  const [showGrid, setShowGrid] = useState(false)

  if (!currentQuiz) return null

  const questions = currentQuiz.questions || []
  const totalQuestions = questions.length
  const currentQuestion = questions[currentQuestionIndex] ?? null

  // ── derived counts (live, keyed by question id) ──────────────────────
  const answeredCount = questions.filter(
    (q) => answers[q.id] !== undefined && answers[q.id] !== ''
  ).length
  const unansweredCount = totalQuestions - answeredCount
  const reviewCount = markedForReview.size

  // ── timer classes ────────────────────────────────────────────────────
  const timerClass =
    timeRemaining <= 60
      ? 'quiz-timer-display danger'
      : timeRemaining <= 300
      ? 'quiz-timer-display warning'
      : 'quiz-timer-display'

  // ── rich-text helper (unchanged from original) ───────────────────────
  const renderRichText = (text) => {
    if (!text) return { __html: '' }
    let html = String(text)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    html = html.replace(/__(.*?)__/g, '<u>$1</u>')
    html = html.replace(/\^(.*?)\^/g, '<sup>$1</sup>')
    html = html.replace(/~(.*?)~/g, '<sub>$1</sub>')
    html = html.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;height:auto;margin:10px 0;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)"/>'
    )
    return { __html: html }
  }

  // ════════════════════════════════════════════════════════════════════
  // REVIEW MODE — unchanged all-questions layout with correct/incorrect
  // ════════════════════════════════════════════════════════════════════
  if (isReviewMode) {
    return (
      <div id="quiz-view" className="quiz-interface active">
        {/* Header */}
        <div className="quiz-review-header" id="quiz-header">
          <button
            className="quiz-close-btn"
            onClick={backToDashboard}
            aria-label="Close review"
          >
            ×
          </button>
          <h1 className="quiz-title">{currentQuiz.name} — Review</h1>
          <div className="review-score">
            Score: {currentQuiz.earnedMarks ?? 0}/
            {currentQuiz.totalMarks ??
              questions.reduce((t, q) => t + (q.marks || 1), 0)}{' '}
            Marks
          </div>
          <div className="quiz-info-bar">
            <span>{currentQuiz.subject}</span>
            <span>{questions.length} Questions</span>
            {currentQuiz.totalMarks && (
              <span>Total: {currentQuiz.totalMarks} Marks</span>
            )}
          </div>
        </div>

        {/* All questions, read-only */}
        <div className="quiz-form" style={{ background: 'var(--bg-main)', padding: '2rem' }}>
          <div id="quiz-questions">
            {questions.map((question, index) => (
              <ReviewQuestionCard
                key={question.id}
                question={question}
                index={index}
                renderRichText={renderRichText}
              />
            ))}
          </div>
          <div className="submit-section">
            <button
              type="button"
              className="back-btn"
              onClick={backToDashboard}
              style={backBtnStyle}
            >
              ← Back to Results
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════
  // ACTIVE EXAM MODE — one question at a time
  // ════════════════════════════════════════════════════════════════════

  if (!currentQuestion) return null

  const isFirst = currentQuestionIndex === 0
  const isLast = currentQuestionIndex === totalQuestions - 1
  const isMarked = markedForReview.has(currentQuestion.id)
  const currentAnswer = answers[currentQuestion.id] ?? ''

  // Progress bar width
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0

  // ── handlers ─────────────────────────────────────────────────────────
  const handlePrev = () => {
    if (!isFirst) onNavigate(currentQuestionIndex - 1)
  }
  const handleNext = () => {
    if (!isLast) onNavigate(currentQuestionIndex + 1)
  }
  const handleFinishClick = () => {
    setShowGrid(false)
    setShowConfirmDialog(true)
  }
  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false)
    submitQuiz(false)
  }
  const handleCancelSubmit = () => {
    setShowConfirmDialog(false)
  }

  return (
    <div id="quiz-view" className="quiz-interface active">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="quiz-header" id="quiz-header">
        <h1 className="quiz-title" id="current-quiz-title">
          {currentQuiz.name}
        </h1>
        <div className={timerClass} id="quiz-timer-display">
          {formatTimerDisplay(timeRemaining)}
        </div>
        <div className="quiz-info-bar">
          <span id="quiz-subject">{currentQuiz.subject}</span>
          <span id="quiz-questions-count">{totalQuestions} Questions</span>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      <div style={progressBarContainerStyle}>
        <div style={progressStatRowStyle}>
          <span style={progressStatStyle}>
            Question <strong>{currentQuestionIndex + 1}</strong> of{' '}
            <strong>{totalQuestions}</strong>
          </span>
          <span style={progressStatStyle}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              ✓ {answeredCount} Answered
            </span>
            {' · '}
            <span style={{ color: 'var(--text-secondary)' }}>
              {unansweredCount} Unanswered
            </span>
            {reviewCount > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                  🔖 {reviewCount} Review
                </span>
              </>
            )}
          </span>
        </div>
        <div style={progressTrackStyle}>
          <div
            style={{
              ...progressFillStyle,
              width: `${progressPct}%`,
            }}
            role="progressbar"
            aria-valuenow={answeredCount}
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-label={`${answeredCount} of ${totalQuestions} questions answered`}
          />
        </div>
      </div>

      {/* ── Question Card ────────────────────────────────────────────── */}
      <div style={cardContainerStyle}>
        <div style={questionCardStyle}>

          {/* Card header row */}
          <div style={cardHeaderRowStyle}>
            <span style={questionNumberBadgeStyle}>
              {currentQuestionIndex + 1}
            </span>
            <span style={questionTypeStyle}>
              {(currentQuestion.type || '').toUpperCase()}
            </span>
            {currentQuestion.marks && (
              <span style={marksBadgeStyle}>
                {currentQuestion.marks} Mark{currentQuestion.marks !== 1 ? 's' : ''}
              </span>
            )}
            {/* Mark for Review toggle */}
            <button
              type="button"
              onClick={() => onToggleReview(currentQuestion.id)}
              style={{
                ...markReviewBtnStyle,
                background: isMarked ? '#FEF3C7' : 'var(--bg-surface)',
                borderColor: isMarked ? 'var(--warning)' : 'var(--border-color)',
                color: isMarked ? '#92400e' : 'var(--text-secondary)',
              }}
              aria-pressed={isMarked}
              title={isMarked ? 'Remove review mark' : 'Mark for review'}
            >
              🔖 {isMarked ? 'Marked' : 'Mark for Review'}
            </button>
          </div>

          {/* Question text */}
          <p
            style={questionTextStyle}
            dangerouslySetInnerHTML={renderRichText(currentQuestion.question)}
          />

          {/* Answer options */}
          <div style={{ marginTop: '1.5rem' }}>
            <ActiveAnswerInput
              question={currentQuestion}
              currentAnswer={currentAnswer}
              onAnswerChange={onAnswerChange}
              renderRichText={renderRichText}
            />
          </div>
        </div>
      </div>

      {/* ── Navigation row ───────────────────────────────────────────── */}
      <div style={navRowStyle}>
        {/* Previous */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={isFirst}
          style={{
            ...navBtnStyle,
            opacity: isFirst ? 0.4 : 1,
            cursor: isFirst ? 'not-allowed' : 'pointer',
          }}
          aria-label="Previous question"
        >
          ← Previous
        </button>

        {/* Centre: Question grid toggle + Finish Exam */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            style={gridToggleBtnStyle}
            aria-expanded={showGrid}
            aria-label="Toggle question grid"
          >
            ⊞ Questions
          </button>
          <button
            type="button"
            onClick={handleFinishClick}
            style={finishBtnStyle}
          >
            Finish Exam
          </button>
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={handleNext}
          disabled={isLast}
          style={{
            ...navBtnStyle,
            opacity: isLast ? 0.4 : 1,
            cursor: isLast ? 'not-allowed' : 'pointer',
          }}
          aria-label="Next question"
        >
          Next →
        </button>
      </div>

      {/* ── Question Grid panel ──────────────────────────────────────── */}
      {showGrid && (
        <div style={gridPanelStyle}>
          <div style={gridPanelHeaderStyle}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>
              Jump to Question
            </span>
            <button
              type="button"
              onClick={() => setShowGrid(false)}
              style={gridCloseBtnStyle}
              aria-label="Close question grid"
            >
              ×
            </button>
          </div>
          <div style={gridDotsStyle}>
            {questions.map((q, idx) => {
              const isAnswered =
                answers[q.id] !== undefined && answers[q.id] !== ''
              const isMark = markedForReview.has(q.id)
              const isCurrent = idx === currentQuestionIndex
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => { onNavigate(idx); setShowGrid(false) }}
                  style={getGridDotStyle(isCurrent, isAnswered, isMark)}
                  title={`Q${idx + 1}${isAnswered ? ' – Answered' : ''}${isMark ? ' – Review' : ''}`}
                  aria-label={`Go to question ${idx + 1}`}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
          {/* Legend */}
          <div style={gridLegendStyle}>
            <span style={legendItemStyle('#10B981', '#D1FAE5')}>● Answered</span>
            <span style={legendItemStyle('#F59E0B', '#FEF3C7')}>● Review</span>
            <span style={legendItemStyle('#6B7280', '#F3F4F6')}>● Unanswered</span>
            <span style={legendItemStyle('#FFFFFF', '#EF4444', true)}>● Current</span>
          </div>
        </div>
      )}

      {/* ── Submission Confirmation Dialog ───────────────────────────── */}
      {showConfirmDialog && (
        <SubmitConfirmDialog
          totalQuestions={totalQuestions}
          answeredCount={answeredCount}
          unansweredCount={unansweredCount}
          reviewCount={reviewCount}
          onConfirm={handleConfirmSubmit}
          onCancel={handleCancelSubmit}
          onGoToUnanswered={() => {
            setShowConfirmDialog(false)
            // Navigate to the first unanswered question
            const firstUnanswered = questions.findIndex(
              (q) => !answers[q.id] || answers[q.id] === ''
            )
            if (firstUnanswered !== -1) onNavigate(firstUnanswered)
          }}
          onGoToReview={() => {
            setShowConfirmDialog(false)
            // Navigate to the first review-marked question
            const firstReview = questions.findIndex((q) =>
              markedForReview.has(q.id)
            )
            if (firstReview !== -1) onNavigate(firstReview)
          }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// ActiveAnswerInput — controlled inputs for the active exam
// Keyed by question.id so React mounts a fresh input for each question
// ══════════════════════════════════════════════════════════════════════
function ActiveAnswerInput({ question, currentAnswer, onAnswerChange, renderRichText }) {
  const qid = question.id

  if (question.type === 'mcq') {
    return (
      <div className="mcq-options">
        {question.options.map((option, i) => {
          const isSelected = currentAnswer === option
          return (
            <label
              key={i}
              className={`mcq-option${isSelected ? ' selected' : ''}`}
              htmlFor={`active_q${qid}_${i}`}
              style={{
                borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                background: isSelected ? 'var(--primary-light)' : 'var(--bg-main)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                type="radio"
                id={`active_q${qid}_${i}`}
                name={`active_question_${qid}`}
                value={option}
                checked={isSelected}
                onChange={() => onAnswerChange(qid, option)}
              />
              <span dangerouslySetInnerHTML={renderRichText(option)} />
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'tf') {
    return (
      <div className="tf-options">
        {['True', 'False'].map((val) => {
          const isSelected = currentAnswer.toLowerCase() === val.toLowerCase()
          return (
            <label
              key={val}
              className={`tf-option${isSelected ? ' selected' : ''}`}
              htmlFor={`active_q${qid}_${val}`}
              style={{
                borderColor: isSelected ? 'var(--primary)' : 'var(--border-color)',
                background: isSelected ? 'var(--primary-light)' : 'var(--bg-main)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                type="radio"
                id={`active_q${qid}_${val}`}
                name={`active_question_${qid}`}
                value={val}
                checked={isSelected}
                onChange={() => onAnswerChange(qid, val)}
              />
              <span>{val}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'fill') {
    return (
      <div className="fill-gap">
        <input
          type="text"
          className="fill-input"
          placeholder="Type your answer here…"
          value={currentAnswer}
          onChange={(e) => onAnswerChange(qid, e.target.value)}
          autoComplete="off"
          style={{ width: '100%' }}
        />
      </div>
    )
  }

  return null
}

// ══════════════════════════════════════════════════════════════════════
// ReviewQuestionCard — single read-only question card used in review mode
// Logic is identical to the original createQuestionHTML helper
// ══════════════════════════════════════════════════════════════════════
function ReviewQuestionCard({ question, index, renderRichText }) {
  const num = index + 1
  return (
    <div className="question">
      <span className="question-number">{num}</span>
      <span
        className="question-text"
        dangerouslySetInnerHTML={renderRichText(question.question)}
      />
      <span className="question-type">{(question.type || '').toUpperCase()}</span>
      {question.marks && (
        <span className="question-marks">{question.marks} Marks</span>
      )}
      <ReviewAnswerDisplay
        question={question}
        index={index}
        renderRichText={renderRichText}
      />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// ReviewAnswerDisplay — read-only answer display with correct/incorrect
// Extracted from the original createQuestionHTML, logic unchanged
// ══════════════════════════════════════════════════════════════════════
function ReviewAnswerDisplay({ question, index, renderRichText }) {
  const num = index + 1

  if (question.type === 'mcq') {
    return (
      <div className="mcq-options">
        {question.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === question.correct
          const isUser = optionIndex === question.userAnswer
          let optionClass = 'mcq-option'
          let style = {}
          let indicator = null
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
            style = { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
          }
          return (
            <label key={optionIndex} className={optionClass} htmlFor={`r_q${num}_${optionIndex}`} style={style}>
              <input type="radio" id={`r_q${num}_${optionIndex}`} name={`review_${num}`} value={option} disabled defaultChecked={isUser} />
              <span dangerouslySetInnerHTML={renderRichText(option)} />
              {indicator}
            </label>
          )
        })}
      </div>
    )
  }

  if (question.type === 'tf') {
    const trueCorrect = question.correct === true
    const trueUser = question.userAnswer === true
    const falseCorrect = question.correct === false
    const falseUser = question.userAnswer === false
    const trueStyle = trueCorrect
      ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
      : trueUser && !trueCorrect
      ? { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' }
      : {}
    const falseStyle = falseCorrect
      ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
      : falseUser && !falseCorrect
      ? { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' }
      : {}
    return (
      <div className="tf-options">
        <label className={trueCorrect ? 'tf-option correct' : trueUser && !trueCorrect ? 'tf-option incorrect' : 'tf-option'} htmlFor={`r_q${num}_t`} style={trueStyle}>
          <input type="radio" id={`r_q${num}_t`} name={`review_${num}`} value="true" disabled defaultChecked={trueUser} />
          <span>True</span>
          {trueCorrect && <span style={{ color: '#10b981', fontWeight: 'bold', marginLeft: '0.5rem' }}>✓ Correct Answer</span>}
          {trueUser && !trueCorrect && <span style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '0.5rem' }}>✗ Your Answer (Incorrect)</span>}
        </label>
        <label className={falseCorrect ? 'tf-option correct' : falseUser && !falseCorrect ? 'tf-option incorrect' : 'tf-option'} htmlFor={`r_q${num}_f`} style={falseStyle}>
          <input type="radio" id={`r_q${num}_f`} name={`review_${num}`} value="false" disabled defaultChecked={falseUser} />
          <span>False</span>
          {falseCorrect && <span style={{ color: '#10b981', fontWeight: 'bold', marginLeft: '0.5rem' }}>✓ Correct Answer</span>}
          {falseUser && !falseCorrect && <span style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: '0.5rem' }}>✗ Your Answer (Incorrect)</span>}
        </label>
      </div>
    )
  }

  if (question.type === 'fill') {
    const isCorrect =
      question.userAnswer &&
      String(question.userAnswer).toLowerCase().trim() ===
        String(question.correct).toLowerCase().trim()
    const inputStyle = isCorrect
      ? { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: '2px' }
      : { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: '2px' }
    return (
      <div className="fill-gap">
        <input type="text" className={`fill-input ${isCorrect ? 'correct' : 'incorrect'}`} disabled value={question.userAnswer || ''} style={inputStyle} />
        <div style={isCorrect ? { color: '#10b981', fontWeight: 'bold', marginTop: '0.5rem' } : { color: '#ef4444', fontWeight: 'bold', marginTop: '0.5rem' }}>
          {isCorrect
            ? '✓ Correct!'
            : <span>✗ Your answer: "{question.userAnswer || 'No answer'}" | Correct: <span dangerouslySetInnerHTML={renderRichText(question.correct)} /></span>}
        </div>
      </div>
    )
  }

  return null
}

// ══════════════════════════════════════════════════════════════════════
// SubmitConfirmDialog — modal overlay shown before final submission
// ══════════════════════════════════════════════════════════════════════
function SubmitConfirmDialog({
  totalQuestions,
  answeredCount,
  unansweredCount,
  reviewCount,
  onConfirm,
  onCancel,
  onGoToUnanswered,
  onGoToReview,
}) {
  const hasIssues = unansweredCount > 0 || reviewCount > 0
  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogBoxStyle} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title" style={{ margin: '0 0 1rem', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
          Ready to Submit?
        </h2>

        {/* Summary table */}
        <div style={summaryTableStyle}>
          <div style={summaryRowStyle}>
            <span style={{ color: 'var(--text-secondary)' }}>Total Questions</span>
            <span style={{ fontWeight: 700 }}>{totalQuestions}</span>
          </div>
          <div style={summaryRowStyle}>
            <span style={{ color: 'var(--success)' }}>✓ Answered</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>{answeredCount}</span>
          </div>
          {unansweredCount > 0 && (
            <div style={summaryRowStyle}>
              <span style={{ color: 'var(--error)' }}>✗ Unanswered</span>
              <span style={{ fontWeight: 700, color: 'var(--error)' }}>{unansweredCount}</span>
            </div>
          )}
          {reviewCount > 0 && (
            <div style={summaryRowStyle}>
              <span style={{ color: 'var(--warning)' }}>🔖 Marked for Review</span>
              <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{reviewCount}</span>
            </div>
          )}
        </div>

        {/* Warning banner */}
        {hasIssues && (
          <div style={warningBannerStyle}>
            {unansweredCount > 0 && reviewCount > 0 &&
              `You have ${unansweredCount} unanswered and ${reviewCount} review-marked question(s).`}
            {unansweredCount > 0 && reviewCount === 0 &&
              `You have ${unansweredCount} unanswered question(s). Unanswered questions will be marked incorrect.`}
            {unansweredCount === 0 && reviewCount > 0 &&
              `You have ${reviewCount} question(s) marked for review.`}
          </div>
        )}

        {/* Navigation shortcuts */}
        {(unansweredCount > 0 || reviewCount > 0) && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {unansweredCount > 0 && (
              <button type="button" onClick={onGoToUnanswered} style={goBackLinkStyle}>
                → Go to first unanswered
              </button>
            )}
            {reviewCount > 0 && (
              <button type="button" onClick={onGoToReview} style={goBackLinkStyle}>
                → Go to first review mark
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} style={cancelDialogBtnStyle}>
            Continue Exam
          </button>
          <button type="button" onClick={onConfirm} style={confirmDialogBtnStyle}>
            Submit Exam
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Style helpers — kept as plain objects so no extra CSS file is needed
// All colours reference the existing CSS variables from index.css
// ══════════════════════════════════════════════════════════════════════

const backBtnStyle = {
  background: 'var(--bg-surface-hover)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  padding: '0.75rem 2rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
}

// Progress bar
const progressBarContainerStyle = {
  background: 'var(--bg-main)',
  borderBottom: '1px solid var(--border-light)',
  padding: '0.75rem 2rem',
}
const progressStatRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
  flexWrap: 'wrap',
  gap: '0.5rem',
}
const progressStatStyle = {
  fontSize: '0.875rem',
  color: 'var(--text-secondary)',
}
const progressTrackStyle = {
  height: '8px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--bg-surface-hover)',
  overflow: 'hidden',
}
const progressFillStyle = {
  height: '100%',
  borderRadius: 'var(--radius-full)',
  background: 'linear-gradient(90deg, var(--primary), var(--accent))',
  transition: 'width 0.4s ease',
}

// Question card
const cardContainerStyle = {
  padding: '1.5rem 2rem',
  background: 'var(--bg-surface)',
  minHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
}
const questionCardStyle = {
  background: 'var(--bg-main)',
  borderRadius: 'var(--radius-lg)',
  padding: '2rem',
  boxShadow: 'var(--shadow-md)',
  maxWidth: '860px',
  width: '100%',
  margin: '0 auto',
  flex: 1,
}
const cardHeaderRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
  marginBottom: '1.25rem',
}
const questionNumberBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2.25rem',
  height: '2.25rem',
  borderRadius: 'var(--radius-full)',
  background: 'var(--primary)',
  color: '#fff',
  fontWeight: 800,
  fontSize: '0.9rem',
  flexShrink: 0,
}
const questionTypeStyle = {
  display: 'inline-block',
  background: 'var(--primary-light)',
  color: 'var(--primary)',
  padding: '0.2rem 0.75rem',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
}
const marksBadgeStyle = {
  display: 'inline-block',
  background: 'var(--primary)',
  color: '#fff',
  padding: '0.2rem 0.75rem',
  borderRadius: 'var(--radius-full)',
  fontSize: '0.75rem',
  fontWeight: 700,
}
const markReviewBtnStyle = {
  marginLeft: 'auto',
  border: '1.5px solid',
  borderRadius: 'var(--radius-md)',
  padding: '0.35rem 0.9rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
  whiteSpace: 'nowrap',
}
const questionTextStyle = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  lineHeight: 1.7,
  margin: 0,
}

// Navigation row
const navRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 2rem',
  background: 'var(--bg-main)',
  borderTop: '1px solid var(--border-light)',
  gap: '1rem',
  flexWrap: 'wrap',
}
const navBtnStyle = {
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1.5px solid var(--border-color)',
  padding: '0.625rem 1.5rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 600,
  fontSize: '0.95rem',
  transition: 'all var(--transition-fast)',
  minWidth: '7rem',
}
const gridToggleBtnStyle = {
  background: 'var(--bg-surface)',
  color: 'var(--text-secondary)',
  border: '1.5px solid var(--border-color)',
  padding: '0.625rem 1.25rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  transition: 'all var(--transition-fast)',
}
const finishBtnStyle = {
  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
  color: '#fff',
  border: 'none',
  padding: '0.625rem 1.5rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-sm)',
  transition: 'all var(--transition-fast)',
}

// Question grid panel
const gridPanelStyle = {
  position: 'fixed',
  bottom: '5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-xl)',
  padding: '1.25rem',
  zIndex: 200,
  minWidth: '320px',
  maxWidth: '90vw',
}
const gridPanelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.875rem',
}
const gridCloseBtnStyle = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  lineHeight: 1,
  padding: '0 0.25rem',
}
const gridDotsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginBottom: '0.875rem',
}
const gridLegendStyle = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
  borderTop: '1px solid var(--border-light)',
  paddingTop: '0.75rem',
}

function getGridDotStyle(isCurrent, isAnswered, isMark) {
  let bg = '#F3F4F6'
  let color = '#6B7280'
  let border = '2px solid transparent'
  if (isMark) { bg = '#FEF3C7'; color = '#92400e'; border = '2px solid #F59E0B' }
  if (isAnswered && !isMark) { bg = '#D1FAE5'; color = '#065F46'; border = '2px solid #10B981' }
  if (isCurrent) { bg = '#EF4444'; color = '#FFFFFF'; border = '2px solid #B91C1C' }
  return {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: 'var(--radius-sm)',
    background: bg,
    color: color,
    border: border,
    fontWeight: 700,
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  }
}

function legendItemStyle(color, bg, invertText = false) {
  return {
    fontSize: '0.75rem',
    color: invertText ? color : color,
    background: bg,
    padding: '0.2rem 0.6rem',
    borderRadius: 'var(--radius-full)',
    fontWeight: 600,
  }
}

// Dialog
const dialogOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
}
const dialogBoxStyle = {
  background: 'var(--bg-main)',
  borderRadius: 'var(--radius-xl)',
  padding: '2rem',
  maxWidth: '480px',
  width: '100%',
  boxShadow: 'var(--shadow-2xl)',
}
const summaryTableStyle = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
  marginBottom: '1.25rem',
}
const summaryRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border-light)',
  fontSize: '0.95rem',
}
const warningBannerStyle = {
  background: 'var(--warning-bg)',
  color: '#92400e',
  border: '1px solid var(--warning)',
  borderRadius: 'var(--radius-md)',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  marginBottom: '1.25rem',
}
const goBackLinkStyle = {
  background: 'none',
  border: '1.5px solid var(--border-color)',
  color: 'var(--primary)',
  fontWeight: 600,
  fontSize: '0.85rem',
  padding: '0.4rem 0.9rem',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
}
const cancelDialogBtnStyle = {
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1.5px solid var(--border-color)',
  padding: '0.75rem 1.5rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
}
const confirmDialogBtnStyle = {
  background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
  color: '#fff',
  border: 'none',
  padding: '0.75rem 1.75rem',
  borderRadius: 'var(--radius-md)',
  fontWeight: 700,
  fontSize: '1rem',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-md)',
}
