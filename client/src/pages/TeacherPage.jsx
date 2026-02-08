import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FileUpload from '../components/FileUpload.jsx'
import RichTextEditor from '../components/RichTextEditor.jsx'
import ProfilePage from '../components/ProfilePage'
import UserProfile from '../components/UserProfile'
import Sidebar from '../components/Sidebar'
import DashboardView from '../components/DashboardView'
import QuizModal from '../components/QuizModal'
import ErrorBoundary from '../components/ErrorBoundary'
import UnifiedDashboard from '../components/UnifiedDashboard'
import DashboardFilters from '../components/DashboardFilters'
import api from '../api/axios.js'
import { storage } from '../utils/storage'
import MultiSelectDropdown from '../components/MultiSelectDropdown.jsx'
import StudentsDataGrid from '../components/Teacher/StudentsDataGrid.jsx'

export default function TeacherPage() {
  const navigate = useNavigate()



  // replicate Teacher.html state
  const [currentSection, setCurrentSection] = useState('main')
  const [currentQuizId, setCurrentQuizId] = useState(null)
  const [currentBankId, setCurrentBankId] = useState(null)
  const [currentClass, setCurrentClass] = useState(null)
  const [currentGrade, setCurrentGrade] = useState(null)
  const [currentQuizQuestions, setCurrentQuizQuestions] = useState([])
  const [selectedBankQuestions, setSelectedBankQuestions] = useState(new Set())
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [isSuperAdminView, setIsSuperAdminView] = useState(false)
  const [selectedTeacherData, setSelectedTeacherData] = useState(null)
  const [currentSubject, setCurrentSubject] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [teacherName, setTeacherName] = useState('Teacher')
  const bankKeyRef = useRef(null)


  const [quizzes, setQuizzes] = useState([])
  const [questionBanks, setQuestionBanks] = useState([])
  const [currentBankSnapshot, setCurrentBankSnapshot] = useState(null)
  const [students, setStudents] = useState([])
  const [activeQuizSession, setActiveQuizSession] = useState(null)
  const [quizResults, setQuizResults] = useState([])
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [quizModalData, setQuizModalData] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [dbGrades, setDbGrades] = useState([])
  const [dbClasses, setDbClasses] = useState([])
  const [filters, setFilters] = useState({
    gradeId: null,
    classId: null,
    startDate: null,
    endDate: null
  })

  // Modal state
  const [isModalActive, setIsModalActive] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const modalResolveRef = useRef(null)

  const [studentFilterExamId, setStudentFilterExamId] = useState(null)
  const [studentFilterGrade, setStudentFilterGrade] = useState(null)

  function handleSeeAllScores(examId, gradeName = null) {
    console.log('👀 handleSeeAllScores triggered. Exam:', examId, 'Grade:', gradeName)
    setStudentFilterExamId(examId)
    setStudentFilterGrade(gradeName)
    console.log('🔄 Setting section to students')
    setCurrentSection('students')
  }

  useEffect(() => {
    const isSuperAdmin = storage.getItem('isSuperAdminView')
    if (isSuperAdmin === 'true') {
      setIsSuperAdminView(true)
      const teacherData = storage.getItem('selectedTeacherData')
      if (teacherData) {
        setSelectedTeacherData(JSON.parse(teacherData))
      }
      // Clear the flag after loading
      storage.removeItem('isSuperAdminView')
      storage.removeItem('selectedTeacherData')
    }
  }, [])


  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          api.get("/examdetail"),    // quizzes [0]
          api.get("/questionbank"),  // question banks [1]
          api.get("/dashboard/lookup-data"), // lookup data (grades/classes) [2]
          api.get("/dashboard/students") // students [3]
        ])

        const quizRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
        const questionRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
        const lookupRes = results[2].status === 'fulfilled' ? results[2].value : { data: null };
        const studentRes = results[3].status === 'fulfilled' ? results[3].value : { data: [] };

        // Log errors
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const endpoints = ['/examdetail', '/questionbank', '/dashboard/lookup-data', '/dashboard/students'];
            console.error(`❌ API Error for ${endpoints[index]}:`, result.reason);
          }
        });

        if (lookupRes.data) {
          console.log('🔍 Lookup Data Received:', lookupRes.data);
          setDbGrades(lookupRes.data.grades || [])
          setDbClasses(lookupRes.data.classes || [])
        } else {
          console.warn('⚠️ No lookup data received');
        }

        if (studentRes.data) {
          setStudents(studentRes.data);
        }

        const mappedQuizzes = (quizRes.data || []).map(quiz => {
          const questions = (quiz.questions || []).map(q => ({
            id: q.questionId || q.QuestionId,
            type: q.optionC ? (q.optionD ? 'mcq' : (q.optionA && q.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank',
            question: q.questionTitle || q.QuestionTitle,
            options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
            correct: q.correctAnswer || q.CorrectAnswer,
            marks: q.mark || q.Mark
          }));

          const gradeId = quiz.gradeId || quiz.GradeId || quiz.GradeID;
          const classId = quiz.classId || quiz.ClassId || quiz.ClassID;
          const classIds = quiz.classIds || quiz.ClassIds || (classId ? [classId] : []);

          const gradeName = lookupRes.data?.grades?.find(g => String(g.id) === String(gradeId))?.gradeName || quiz.grade || '';
          const className = lookupRes.data?.classes?.find(c => String(c.id) === String(classId))?.className || quiz.class || '';

          return {
            examId: quiz.examId || quiz.ExamId,
            id: quiz.examId || quiz.ExamId,
            title: quiz.title || quiz.Title,
            description: quiz.examDescription || quiz.ExamDescription || quiz.description,
            examDescription: quiz.examDescription || quiz.ExamDescription || quiz.description,
            grade: gradeName,
            gradeId: gradeId,
            class: className,
            classId: classId,
            classIds: classIds,
            classNames: quiz.classNames || quiz.ClassNames || [],
            subject: quiz.examSubject || quiz.ExamSubject || quiz.subject,
            startDate: quiz.startDate || quiz.StartDate,
            datetime: quiz.endDate || quiz.EndDate || quiz.datetime,
            endDate: quiz.endDate || quiz.EndDate,
            created: quiz.createdDate || quiz.CreatedDate || quiz.created,
            questions: questions,
            questions_data: questions
          };
        })

        const groupedQuestionBanks = questionRes.data.reduce((acc, question) => {
          const gradeId = question.gradeId;
          const gradeName = lookupRes.data?.grades?.find(g => g.id == gradeId)?.gradeName || '';

          const key = question.bankKey || `${question.questionSubject}-${gradeId}`;
          if (!acc[key]) {
            acc[key] = {
              id: key,
              bankKey: key,
              title: question.bankTitle || `${question.questionSubject} - ${gradeName} Bank`,
              description: question.bankDescription || `Questions for ${question.questionSubject} in ${gradeName}`,
              grade: gradeName,
              gradeId: gradeId,
              subject: question.questionSubject || '',
              created: new Date().toISOString(),
              questions: []
            };
          }
          acc[key].questions.push({
            id: question.questionId,
            type: question.optionC ? (question.optionD ? 'mcq' : (question.optionA && question.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank',
            question: question.questionTitle,
            options: [question.optionA, question.optionB, question.optionC, question.optionD].filter(Boolean),
            correct: question.correctAnswer,
            marks: question.mark
          });
          return acc;
        }, {});

        setQuizzes(mappedQuizzes);
        setQuestionBanks(Object.values(groupedQuestionBanks));
        // setStudents(studentRes.data)
      } catch (err) {
        console.error("Error fetching teacher data:", err)
      }
    }

    fetchData()
  }, [])

  function confirmModal(title, message) {
    return new Promise((resolve) => {
      if (window.confirm(`${title}\n\n${message}`)) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  }

  // Authentication & Authorization
  useEffect(() => {
    const token = storage.getItem('token')
    const storedUserRole = storage.getItem('userRole')
    setUserRole(storedUserRole)

    if (!token) {
      navigate('/')
    } else {
      // Fetch user profile if logged in
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const userId = payload.sub || payload.id
        if (userId) {
          api.get(`/auth/profile/${userId}`).then(res => {
            if (res.data && (res.data.fullNameEn || res.data.fullNameAr)) {
              setTeacherName(res.data.fullNameEn || res.data.fullNameAr)
            }
          }).catch(err => console.error("Failed to fetch profile", err))
        }
      } catch (e) {
        console.error('Error parsing token:', e)
      }
    }
  }, [navigate])



  function showModal(title, message) {
    return new Promise((resolve) => {
      setIsModalActive(true)
      setModalTitle(title)
      setModalMessage(message)
      modalResolveRef.current = resolve
    })
  }

  const handleModalConfirm = () => {
    setIsModalActive(false)
    if (modalResolveRef.current) {
      modalResolveRef.current(true)
    }
  }

  const handleModalCancel = () => {
    setIsModalActive(false)
    if (modalResolveRef.current) {
      modalResolveRef.current(false)
    }
  }

  const handleLogout = () => {
    showModal('Confirm Logout', 'Are you sure you want to logout?').then((confirmed) => {
      if (confirmed) {
        // Clear all session data
        storage.clear()
        // Reset state
        setCurrentSection('main')
        setCurrentQuizId(null)
        setCurrentBankId(null)
        // Redirect to login
        navigate('/')
      }
    })
  }

  const showSection = (section) => {
    setCurrentSection(section)
    setCurrentQuizId(null)
    // Don't reset currentBankId when going to bank-editor (we need it for editing)
    if (section !== 'bank-editor') {
      setCurrentBankId(null)
    }
    setCurrentClass(null)
    setCurrentGrade(null)
    setCurrentQuizQuestions([])
    setSelectedBankQuestions(new Set())
    // setIsRichTextEditorOpen(false) // Removed as it's not defined
    // setEditorTarget(null) // Removed as it's not defined
    setShowFileUpload(false)
  }

  const getTimeUntilDeadline = (datetime) => {
    const now = new Date()
    const deadline = new Date(datetime)
    const diff = deadline - now
    if (diff < 0) return 'Expired'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `${days}d ${hours}h ${minutes}m`
  }

  function viewQuiz(quizId) {
    setCurrentQuizId(quizId)
    setCurrentSection('quiz-viewer')
  }

  function createNewQuiz() {
    setCurrentQuizId(null)
    setCurrentQuizQuestions([])
    setQuizForm({ title: '', description: '', grade: '', gradeId: '', className: '', classIds: [], datetime: '', startDate: '' })
    setCurrentSection('quiz-editor')
  }

  const [quizForm, setQuizForm] = useState({ title: '', description: '', grade: '', gradeId: '', className: '', classIds: [], datetime: '', startDate: '' })

  function editQuiz(quizId) {
    const quiz = quizzes.find((q) => q.examId === quizId)
    if (!quiz) return
    setCurrentQuizId(quizId)
    setQuizForm({
      title: quiz.title,
      gradeId: quiz.gradeId || '',
      grade: quiz.grade,
      className: quiz.class,
      classIds: (quiz.classIds && quiz.classIds.length > 0) ? quiz.classIds : (quiz.classId ? [quiz.classId] : []),
      datetime: quiz.endDate || '',
      startDate: quiz.startDate || '',
    })
    setCurrentQuizQuestions([...(quiz.questions || [])])
    setCurrentSection('quiz-editor')
  }

  async function deleteQuiz(quizId) {
    confirmModal('Delete Quiz', 'Are you sure you want to delete this quiz?').then(async (c) => {
      if (c) {
        try {
          await api.delete(`/examdetail/${quizId}`)
          setQuizzes((prev) => prev.filter((q) => q.examId !== quizId))
        } catch (err) {
          console.error("Error deleting quiz:", err)
          window.alert("Failed to delete quiz.")
        }
      }
    })
  }

  function renderQuizEditorQuestions() {
    if (currentQuizQuestions.length === 0) {
      return (
        <div className="empty-state">
          <h3 className="empty-title">No questions added yet</h3>
          <p className="empty-description">Add questions from your question banks</p>
        </div>
      )
    }
    return currentQuizQuestions.map((questionData, index) => (
      <div key={index} className="question-item" data-question-index={index} style={{ textAlign: 'left' }}>
        <div className="question-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
          <h4 style={{ margin: 0 }}>Question {index + 1} {typeof questionData.marks !== 'undefined' ? `(Marks: ${questionData.marks})` : ''}</h4>
          <div>
            <span className={`question-type-badge type-${questionData.type}`} style={{ padding: '.25rem .5rem', borderRadius: '999px', border: '1px solid #e5e7eb', fontSize: '.75rem', fontWeight: 700, marginRight: '.5rem' }}>
              {questionData.type === 'mcq' ? 'Multiple Choice' : questionData.type === 'true_false' ? 'True/False' : 'Fill in the Blank'}
            </span>
            <button className="remove-question-btn" style={{ padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#991b1b', cursor: 'pointer', fontWeight: 600 }} onClick={() => removeQuestionFromQuiz(index)}>Remove</button>
          </div>
        </div>
        <div className="question-display-text" style={{ padding: '.5rem .75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '.75rem' }} dangerouslySetInnerHTML={{ __html: renderRichText(questionData.question) }} />
        {questionData.type === 'mcq' && questionData.options ? (
          <div className="options-display" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
            {questionData.options.map((option, optionIndex) => {
              const isCorrect = questionData.correct === optionIndex
              return (
                <div key={optionIndex} className={`option-display-item ${isCorrect ? 'correct' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flex: 1 }}>
                    <div className={`option-indicator ${isCorrect ? 'correct' : ''}`} style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: isCorrect ? '#dcfce7' : '#f9fafb', fontWeight: 700 }}>{String.fromCharCode(65 + optionIndex)}</div>
                    <span dangerouslySetInnerHTML={{ __html: renderRichText(option) }} />
                  </div>
                  {isCorrect ? (
                    <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '.75rem', background: '#dcfce7', border: '1px solid #86efac', padding: '.125rem .5rem', borderRadius: '999px' }}>✓ Correct</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
        {questionData.type === 'true_false' ? (
          <div className="true-false-display" style={{ display: 'flex', gap: '1rem' }}>
            <div className={`tf-option ${questionData.correct === true ? 'correct' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: questionData.correct === true ? '#dcfce7' : '#fff' }}>True {questionData.correct === true ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '.75rem' }}>✓</span> : null}</div>
            <div className={`tf-option ${questionData.correct === false ? 'correct' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: questionData.correct === false ? '#dcfce7' : '#fff' }}>False {questionData.correct === false ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '.75rem' }}>✓</span> : null}</div>
          </div>
        ) : null}
        {questionData.type === 'fill_blank' ? (
          <div className="fill-blank-answer" style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}><strong>Answer:</strong> <span dangerouslySetInnerHTML={{ __html: renderRichText(questionData.correct) }} /></div>
        ) : null}
      </div>
    ))
  }

  function removeQuestionFromQuiz(indexToRemove) {
    setCurrentQuizQuestions((prev) => prev.filter((_, i) => i !== indexToRemove))
  }

  function renderRichText(text) {
    if (!text) return ''

    let html = text

    // Convert markdown-like formatting to HTML
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    html = html.replace(/__(.*?)__/g, '<u>$1</u>')
    html = html.replace(/\^(.*?)\^/g, '<sup>$1</sup>')
    html = html.replace(/~(.*?)~/g, '<sub>$1</sub>')
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />')

    return html
  }

  function openQuestionBankSelector() {
    setCurrentSection('question-bank-selector')
  }

  function renderSelectableQuestionBanks() {
    if (questionBanks.length === 0) {
      return (
        <div className="empty-state">
          <h3 className="empty-title">No question banks available</h3>
          <p className="empty-description">Create question banks first to add questions to quizzes.</p>
        </div>
      )
    }
    return questionBanks.map((bank) => (
      <div
        key={bank.id}
        className="selectable-bank-item"
        onClick={() => viewSelectableBankQuestions(bank.id)}
        style={{
          background: 'linear-gradient(135deg,#ffffff 0%,#fcfcfd 100%)',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          boxShadow: '0 8px 24px rgba(0,0,0,.06)',
          border: '1px solid #e5e7eb',
          transition: 'transform .15s ease, box-shadow .15s ease',
          cursor: 'pointer',
        }}
      >
        <div className="bank-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div className="bank-info" style={{ flex: 1 }}>
            <h3 className="bank-title" style={{ margin: '0 0 .35rem 0', color: '#111827' }}>{bank.title}</h3>
            <div className="bank-meta" style={{ display: 'flex', gap: '1rem', marginBottom: '.5rem', color: '#6b7280' }}>
              <span>{bank.questions ? bank.questions.length : 0} questions</span>
              <span>Created: {new Date(bank.created).toLocaleDateString()}</span>
            </div>
            <div className="bank-badges" style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem' }}>
              <span className="badge badge-grade" style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', fontWeight: 700, fontSize: '.75rem' }}>{bank.grade}</span>
              <span className="badge badge-subject" style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700, fontSize: '.75rem' }}>{bank.subject}</span>
            </div>
            <p className="card-description" style={{ fontSize: '.9rem', color: '#6b7280', margin: 0 }}>{bank.description}</p>
          </div>
        </div>
      </div>
    ))
  }

  function viewSelectableBankQuestions(bankId) {
    setCurrentBankId(bankId)
    setSelectedBankQuestions(new Set())
    setCurrentSection('question-bank-questions-selector')
  }

  function toggleQuestionSelection(bankId, questionIndex, isChecked) {
    setSelectedBankQuestions((prev) => {
      const next = new Set(prev)
      const key = `${String(bankId)}::${questionIndex}`
      if (isChecked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const isQuestionSelected = (bankId, questionIndex) => {
    return selectedBankQuestions.has(`${String(bankId)}::${questionIndex}`)
  }

  function addSelectedQuestionsToQuiz() {
    const added = []
    const normalizeFromBank = (q) => {
      const normalized = { type: q.type, question: q.question, options: q.options || [], correct: q.correct, marks: q.marks ?? 1 }
      if (q.type === 'mcq') {
        if (typeof normalized.correct === 'string') {
          const upper = normalized.correct.trim().toUpperCase()
          const map = { A: 0, B: 1, C: 2, D: 3 }
          if (upper in map) normalized.correct = map[upper]
        }
        if (!Array.isArray(normalized.options)) normalized.options = []
        while (normalized.options.length < 4) normalized.options.push('')
      } else if (q.type === 'true_false') {
        if (typeof normalized.correct === 'string') {
          const t = normalized.correct.trim().toLowerCase()
          if (t === 'true' || t === 't') normalized.correct = true
          if (t === 'false' || t === 'f') normalized.correct = false
        }
      }
      return normalized
    }
    selectedBankQuestions.forEach((key) => {
      const [bankIdStr, idxStr] = key.split('::')
      const bank = questionBanks.find((b) => String(b.id) === String(bankIdStr) || String(b.bankKey) === String(bankIdStr))
      const idx = Number(idxStr)
      if (bank && bank.questions && bank.questions[idx]) {
        const original = bank.questions[idx]
        const q = normalizeFromBank(original)
        if (original && original.id) q.id = original.id
        added.push(q)
      }
    })
    if (added.length === 0) {
      window.alert('Please select at least one question to add')
      return
    }
    setCurrentQuizQuestions((prev) => [...prev, ...added])
    setSelectedBankQuestions(new Set())
    setCurrentSection('quiz-editor')
  }

  function backToQuestionBankSelector() {
    setCurrentSection('question-bank-selector')
  }

  function backToQuizEditor() {
    setCurrentSection('quiz-editor')
  }

  async function saveQuiz() {
    const { title, description, gradeId, className, classIds, datetime, startDate } = quizForm
    if (!title.trim()) return window.alert('Please enter a quiz title')
    if (!gradeId) return window.alert('Please select a grade')
    if ((!className && (!classIds || classIds.length === 0))) return window.alert('Please select at least one class')
    if (!datetime) return window.alert('Please select date and time for the quiz')
    if (!startDate) return window.alert('Please select a start date for the quiz')
    if (new Date(datetime) <= new Date(startDate)) return window.alert('End date must be after start date')
    if (currentQuizQuestions.length === 0) return window.alert('Please add at least one question to the quiz')

    const quizData = {
      title,
      examSubject: 'Mathematics',
      examDescription: description || "",
      gradeId: gradeId ? Number(gradeId) : null,
      classId: classIds[0] ? Number(classIds[0]) : null, // Handle single classId if needed
      classIds: (classIds || []).map(Number),
      startDate,
      endDate: datetime,
      questionIds: currentQuizQuestions.map(q => q.id).filter(Boolean),
      createdBy: (() => { try { const t = storage.getItem('token'); if (!t) return 0; const payload = JSON.parse(atob(t.split('.')[1] || '')); return Number(payload.sub) || 0; } catch { return 0; } })()
    }

    try {
      if (currentQuizId) {
        const response = await api.put(`/examdetail/${currentQuizId}`, { ...quizData })
        const updated = response.data
        setQuizzes((prev) => prev.map((q) => (q.examId === currentQuizId || q.id === currentQuizId)
          ? {
            examId: updated.examId,
            id: updated.examId,
            title: updated.title,
            examDescription: updated.examDescription,
            description: updated.examDescription,
            grade: updated.grade,
            class: updated.class,
            subject: updated.examSubject,
            startDate: updated.startDate,
            datetime: updated.endDate,
            endDate: updated.endDate,
            created: q.created || new Date().toISOString(),
            questions: (updated.questions || []).map(qq => ({
              id: qq.questionId,
              type: qq.optionC ? (qq.optionD ? 'mcq' : (qq.optionA && qq.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank',
              question: qq.questionTitle,
              options: [qq.optionA, qq.optionB, qq.optionC, qq.optionD].filter(Boolean),
              correct: qq.correctAnswer,
              marks: qq.mark
            })),
            questions_data: (updated.questions || []).map(qq => ({
              id: qq.questionId,
              type: qq.optionC ? (qq.optionD ? 'mcq' : (qq.optionA && qq.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank',
              question: qq.questionTitle,
              options: [qq.optionA, qq.optionB, qq.optionC, qq.optionD].filter(Boolean),
              correct: qq.correctAnswer,
              marks: qq.mark
            }))
          }
          : q))
      } else {
        const response = await api.post('/examdetail', { ...quizData })
        const saved = response.data
        const newQuizQuestions = (saved.questions || []).map(qq => ({
          id: qq.questionId,
          type: qq.optionC ? (qq.optionD ? 'mcq' : (qq.optionA && qq.optionB ? 'true_false' : 'fill_blank')) : 'fill_blank',
          question: qq.questionTitle,
          options: [qq.optionA, qq.optionB, qq.optionC, qq.optionD].filter(Boolean),
          correct: qq.correctAnswer,
          marks: qq.mark
        }));

        setQuizzes((prev) => [...prev, {
          examId: saved.examId,
          id: saved.examId,
          title: saved.title,
          examDescription: saved.examDescription,
          description: saved.examDescription,
          grade: saved.grade,
          class: saved.class,
          subject: saved.examSubject,
          startDate: saved.startDate,
          datetime: saved.endDate,
          endDate: saved.endDate,
          created: new Date().toISOString(),
          questions: newQuizQuestions,
          questions_data: newQuizQuestions
        }])
      }
      confirmModal('Quiz Saved', 'Quiz saved successfully!').then(() => {
        showSection('my-quizzes')
      })
    } catch (err) {
      console.error("Error saving quiz:", err)
      console.log("Failed Payload:", quizData) // Log data for debugging

      let errorMsg = err.response?.data?.message || err.message || "Failed to save quiz."

      // Handle ASP.NET Core Validation Errors
      if (err.response?.data?.errors) {
        const validationErrors = Object.entries(err.response.data.errors)
          .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
          .join("\n")
        errorMsg += `\n\nValidation Details:\n${validationErrors}`
      }

      window.alert(`Error: ${errorMsg}`)
    }
  }

  function cancelEdit() {
    confirmModal('Cancel Changes', 'Are you sure you want to cancel? Any unsaved changes will be lost.').then((c) => {
      if (c) setCurrentSection('my-quizzes')
    })
  }

  const [bankForm, setBankForm] = useState(() => ({ title: '', description: '', grade: '', gradeId: '' }))
  const [bankEditorQuestions, setBankEditorQuestions] = useState(() => [])
  const [forceRender, setForceRender] = useState(0)



  function renderQuestionBanksList() {
    if (questionBanks.length === 0) {
      return (
        <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 2rem', color: '#6b7280' }}>
          <svg className="empty-icon" viewBox="0 0 24 24" style={{ width: '48px', height: '48px', fill: '#d1d5db', marginBottom: '1rem' }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <h3 className="empty-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151', margin: '0 0 0.5rem 0' }}>No question banks yet</h3>
          <p className="empty-description" style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>Create your first question bank to get started</p>
        </div>
      )
    }
    return questionBanks.map((bank) => (
      <div key={bank.id} className="question-bank-item" style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1rem', boxShadow: '0 10px 26px rgba(0,0,0,.06)' }}>
        <div className="bank-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h3 className="bank-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', margin: '0 0 0.5rem 0' }}>{bank.title}</h3>
            <div className="bank-meta" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '.2rem .5rem', borderRadius: '999px', fontSize: '.8rem', fontWeight: 700 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 11h10v2H7z" /></svg>
                {bank.questions ? bank.questions.length : 0} questions
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', background: '#ecfeff', color: '#0e7490', border: '1px solid #bae6fd', padding: '.2rem .5rem', borderRadius: '999px', fontSize: '.8rem', fontWeight: 700 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                {new Date(bank.created).toLocaleDateString()}
              </span>
            </div>
            <div className="bank-badges" style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem' }}>
              <span className="badge badge-grade" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '.75rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>{bank.grade}</span>
              <span className="badge badge-subject" style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>{bank.subject}</span>
            </div>
            <p className="card-description" style={{ fontSize: '.875rem', color: '#6b7280', margin: '0 0 1rem 0' }}>{bank.description}</p>
          </div>
          <div className="bank-actions" style={{ display: 'flex', gap: '.5rem' }}>
            <button className="action-btn view-btn" style={{ padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #93c5fd', background: 'white', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600, fontSize: '.875rem' }} onClick={() => { console.log('View bank clicked:', bank.id); viewQuestionBank(bank.id); }}>View</button>
            <button className="action-btn edit-btn" style={{ padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #fcd34d', background: 'white', color: '#92400e', cursor: 'pointer', fontWeight: 600, fontSize: '.875rem' }} onClick={() => editQuestionBank(bank.id)}>Edit</button>
            <button className="action-btn delete-btn" style={{ padding: '.5rem .75rem', borderRadius: '8px', border: '1px solid #fecaca', background: 'white', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: '.875rem' }} onClick={() => deleteQuestionBank(bank.id)}>Delete</button>
          </div>
        </div>
      </div>
    ))
  }

  function createNewQuestionBank() {
    console.log('🔄 Creating new question bank');
    setCurrentBankId(null)
    setBankForm({ title: '', description: '', grade: '', gradeId: '' })
    setBankEditorQuestions([])
    try {
      bankKeyRef.current = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `bank-${Date.now()}-${Math.random().toString(36).slice(2)}`
    } catch {
      bankKeyRef.current = `bank-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    showSection('bank-editor')
  }

  function editQuestionBank(bankId) {
    const bank = questionBanks.find((b) => b.id === bankId)
    if (!bank) return
    setCurrentBankId(bankId)
    bankKeyRef.current = bank.bankKey || bank.id
    setBankForm({
      title: bank.title,
      description: bank.description,
      grade: bank.grade,
      gradeId: bank.gradeId || ''
    })
    setBankEditorQuestions(bank.questions.map(q => {
      let correctedQuestion = { ...q };
      // Preserve the original question ID
      if (q.id) correctedQuestion.id = q.id;

      if (q.type === 'mcq') {
        // Convert A,B,C,D to 0,1,2,3 for correct option
        correctedQuestion.correct = q.options.indexOf(q.correct) !== -1 ? q.options.indexOf(q.correct) : 0; // Default to 0 if not found
      } else if (q.type === 'true_false') {
        correctedQuestion.correct = q.correct === 'True';
      }
      return correctedQuestion;
    }) || []);
    showSection('bank-editor')
  }

  async function deleteQuestionBank(bankId) {
    confirmModal('Delete Question Bank', 'Are you sure you want to delete this question bank and all its questions?').then(async (c) => {
      if (c) {
        try {
          const bankToDelete = questionBanks.find(b => b.id === bankId);
          if (bankToDelete && bankToDelete.questions) {
            for (const question of bankToDelete.questions) {
              await api.delete(`/questionbank/${question.id}`);
            }
          }
          // Simply remove the bank from frontend state - no need to re-fetch
          setQuestionBanks((prev) => prev.filter((b) => b.id !== bankId));
        } catch (err) {
          console.error("Error deleting question bank:", err);
          window.alert("Failed to delete question bank.");
        }
      }
    });
  }

  function viewQuestionBank(bankId) {
    const bank = questionBanks.find((b) => String(b.id) === String(bankId))
    if (bank) {
      setCurrentBankSnapshot(bank)
    } else {
      // Fallback snapshot with minimal info to avoid blank view until data refresh
      setCurrentBankSnapshot({ id: bankId, title: 'Question Bank', description: '', grade: '', subject: '', created: new Date().toISOString(), questions: [] })
    }
    setCurrentBankId(bankId)
    // Navigate without resetting IDs
    setCurrentSection('bank-viewer')
  }

  function addBankQuestion(questionData) {
    setBankEditorQuestions((prev) => [
      // Prepend newest question to the top for faster editing
      questionData
        ? { marks: (questionData.marks ?? 1), ...questionData }
        : {
          type: 'mcq',
          question: '',
          options: ['', '', '', ''],
          correct: 0,
          marks: 1,
          // Don't add an ID for new questions - let the backend assign one
          id: undefined
        },
      ...prev,
    ])
  }

  function handleFileUploadQuestions(questions) {
    if (currentSection === 'bank-editor') {
      // Prepend uploaded questions (keep their order) to the top
      // Keep IDs from backend
      setBankEditorQuestions((prev) => [...questions, ...prev])
    } else if (currentSection === 'quiz-editor') {
      setCurrentQuizQuestions((prev) => [...questions, ...prev])
    }
    setShowFileUpload(false)
  }

  function changeBankQuestionType(index, newType) {
    setBankEditorQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? newType === 'mcq'
            ? { type: 'mcq', question: q.question || '', options: ['', '', '', ''], correct: 0, marks: q.marks ?? 1, id: q.id }
            : newType === 'true_false'
              ? { type: 'true_false', question: q.question || '', correct: true, marks: q.marks ?? 1, id: q.id }
              : { type: 'fill_blank', question: q.question || '', correct: '', marks: q.marks ?? 1, id: q.id }
          : q,
      ),
    )
  }

  function removeBankQuestion(index) {
    setBankEditorQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveQuestionBank() {
    const title = bankForm.title.trim()
    const gradeId = bankForm.gradeId
    const subject = 'Mathematics' // Assuming subject is always Mathematics for now

    if (!title) return window.alert('Please enter a bank title')
    if (!gradeId) return window.alert('Please select a grade')
    const questionsToSave = bankEditorQuestions.filter((q) => q.question.trim())
    if (questionsToSave.length === 0) return window.alert('Please add at least one question')

    try {
      if (currentBankId) {
        // For existing bank, get all current question IDs from the editor
        const currentQuestionIds = new Set(questionsToSave.map(q => q.id).filter(Boolean));
        const existingBank = questionBanks.find(b => b.id === currentBankId);
        const originalQuestionIds = new Set((existingBank?.questions || []).map(q => q.id));

        // Find questions that were removed (in original but not in current)
        const removedQuestionIds = Array.from(originalQuestionIds).filter(id => !currentQuestionIds.has(id));

        // Extract accountId from token once
        let accountId = 0;
        try {
          const token = storage.getItem('token');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            accountId = Number(payload.sub) || 0;
          }
        } catch (e) {
          console.error('Error extracting accountId from token:', e);
        }

        if (accountId <= 0) {
          throw new Error('Unable to get user account ID. Please log in again.');
        }

        // Update or create questions
        for (const q of questionsToSave) {
          const questionPayload = {
            bankKey: bankKeyRef.current || currentBankId,
            accountId: accountId,
            questionTitle: q.question,
            optionA: q.options[0] || '',
            optionB: q.options[1] || '',
            optionC: q.options[2] || '',
            optionD: q.options[3] || '',
            usedOptions: q.options.length,
            correctAnswer: q.type === 'mcq' ? String.fromCharCode(65 + (Number(q.correct) || 0)) : String(q.correct),
            questionSubject: 'Mathematics',
            mark: q.marks || 1,
            gradeId: bankForm.gradeId ? Number(bankForm.gradeId) : null,
            bankTitle: title,
            bankDescription: bankForm.description || '',
          };

          if (q.id && originalQuestionIds.has(q.id)) {
            // Update existing question
            await api.put(`/questionbank/${q.id}`, questionPayload);
          } else {
            // Create new question in this bank
            await api.post('/questionbank', questionPayload);
          }
        }

        // Delete questions that were removed from the bank
        for (const removedQuestionId of removedQuestionIds) {
          await api.delete(`/questionbank/${removedQuestionId}`);
        }

      } else {
        // For a new bank, create all questions
        // Extract accountId from token once
        let accountId = 0;
        try {
          const token = storage.getItem('token');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            accountId = Number(payload.sub) || 0;
          }
        } catch (e) {
          console.error('Error extracting accountId from token:', e);
        }

        if (accountId <= 0) {
          throw new Error('Unable to get user account ID. Please log in again.');
        }

        if (!bankKeyRef.current) {
          throw new Error('Bank key is missing. Please try creating the bank again.');
        }

        for (const q of questionsToSave) {
          const questionPayload = {
            bankKey: bankKeyRef.current,
            bankTitle: title,
            bankDescription: bankForm.description || '',
            gradeId: bankForm.gradeId ? Number(bankForm.gradeId) : null,
            questionTitle: q.question,
            optionA: q.options?.[0] || '',
            optionB: q.options?.[1] || '',
            optionC: q.options?.[2] || '',
            optionD: q.options?.[3] || '',
            usedOptions: q.options?.length || 4,
            correctAnswer: q.type === 'mcq' ? String.fromCharCode(65 + (Number(q.correct) || 0)) : String(q.correct),
            questionSubject: 'Mathematics',
            mark: q.marks ?? 1,
            accountId: accountId
          };

          if (q.id) {
            await api.put(`/questionbank/${q.id}`, questionPayload);
          } else {
            await api.post('/questionbank', questionPayload);
          }
        }
      }
      // Update the frontend state directly instead of re-fetching
      if (currentBankId) {
        // Update existing bank in state
        setQuestionBanks((prev) => prev.map((bank) =>
          bank.id === currentBankId
            ? {
              ...bank,
              title: title,
              description: bankForm.description || '',
              grade: dbGrades.find(g => g.id == bankForm.gradeId)?.gradeName || bank.grade,
              questions: questionsToSave.map(q => ({
                id: q.id,
                type: q.type,
                question: q.question,
                options: q.options || [],
                correct: q.correct,
                marks: q.marks ?? 1
              }))
            }
            : bank
        ));
      } else {
        // Add new bank to state
        const newBank = {
          id: bankKeyRef.current,
          bankKey: bankKeyRef.current,
          title: title,
          description: bankForm.description || '',
          gradeId: bankForm.gradeId,
          grade: dbGrades.find(g => g.id == bankForm.gradeId)?.gradeName || '',
          subject: subject,
          created: new Date().toISOString(),
          questions: questionsToSave.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options || [],
            correct: q.correct,
            marks: q.marks ?? 1
          }))
        };
        setQuestionBanks((prev) => [...prev, newBank]);
      }

      confirmModal('Question Bank Saved', 'Question bank saved successfully!').then(() => {
        showSection('question-banks');
      });
    } catch (err) {
      console.error("Error saving question bank:", err);
      // Show detailed error message
      let errorMessage = "Failed to save question bank.";
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
        errorMessage = "Failed to fetch (API error). Please check if the server is running and try again.";
      } else if (err.response?.data?.message) {
        errorMessage = `Failed to save question bank: ${err.response.data.message}`;
      } else if (err.response?.data?.errors) {
        errorMessage = `Validation errors: ${JSON.stringify(err.response.data.errors)}`;
      } else if (err.message) {
        errorMessage = `Failed to save question bank: ${err.message}`;
      }
      console.error("Full error response:", err.response?.data);
      window.alert(errorMessage);
    }
  }

  function cancelBankEdit() {
    confirmModal('Cancel Changes', 'Are you sure you want to cancel? Any unsaved changes will be lost.').then((c) => {
      if (c) showSection('question-banks')
    })
  }

  function getClassCategories() {
    const map = new Map()
    students.forEach((s) => {
      const key = `${s.grade}-${s.class}`
      if (!map.has(key)) map.set(key, { grade: s.grade, class: s.class, students: [] })
      map.get(key).students.push(s)
    })
    return Array.from(map.values())
  }

  function getGrades() {
    const grades = [...new Set(students.map(s => s.grade))].filter(g => g && g !== 'N/A')
    const order = ['Junior', 'Wheeler', 'Senior']
    return grades.sort((a, b) => {
      const idxA = order.indexOf(a)
      const idxB = order.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })
  }

  function getClassesForGrade(grade) {
    const classes = [...new Set(students.filter(s => s.grade === grade).map(s => s.class))]
    return classes.sort()
  }

  function getStudentsForClass(grade, className) {
    return students.filter(s => s.grade === grade && s.class === className)
  }

  function showGrades() {
    setCurrentSection('students')
    setCurrentGrade(null)
    setCurrentClass(null)
  }

  function showClassesForGrade(grade) {
    setCurrentGrade(grade)
    setCurrentSection('classes')
    setCurrentClass(null)
  }

  function showStudentsForClass(grade, className) {
    setCurrentGrade(grade)
    setCurrentClass({ grade, class: className })
    setCurrentSection('class-students')
  }

  function backToGrades() {
    setCurrentSection('students')
    setCurrentGrade(null)
    setCurrentClass(null)
  }

  function backToClasses() {
    setCurrentSection('classes')
    setCurrentClass(null)
  }

  function showClassStudents(grade, className) {
    setCurrentClass({ grade, class: className })
    setCurrentSection('class-students')
  }

  function backToStudents() {
    if (currentGrade) {
      setCurrentSection('classes')
      setCurrentClass(null)
    } else {
      setCurrentSection('students')
    }
  }

  function backToMain() {
    setCurrentSection('main')
  }

  function showStudentDetail(studentId) {
    setCurrentSection('student-detail')
    setSelectedStudentId(studentId)
  }

  const [selectedStudentId, setSelectedStudentId] = useState(null)

  const resolvedCurrentQuiz = useMemo(() => {
    if (!currentQuizId) return null;
    const byId = quizzes.find(q => String(q.id) === String(currentQuizId));
    if (byId) return byId;
    const byExam = quizzes.find(q => String(q.examId) === String(currentQuizId));
    return byExam || null;
  }, [currentQuizId, quizzes]);

  // IMPORTANT: Rendering guard with useMemo
  // Why: This component renders different large sub-views based on 'currentSection'.
  // We memoize the JSX tree to avoid re-computing heavy views on unrelated state changes.
  // Pitfall: If ANY state referenced inside this function is missing from the dependency array,
  // React will NOT recompute the memoized tree when that state changes. This causes inputs
  // and selects to appear "frozen" (no typing/selection effect) until a different state change
  // forces a re-render (e.g., hot reload), which looks like a rendering bug.
  // Fix: Always include ALL referenced state in the dependency array below. In particular,
  // quiz editor requires 'quizForm' and question bank editor requires 'bankForm',
  // 'bankEditorQuestions', and 'showFileUpload'. Omitting any of these recreates the bug.
  const currentView = useMemo(() => {
    const currentBank = currentBankId ? (questionBanks.find((b) => String(b.id) === String(currentBankId)) || currentBankSnapshot) : null;
    switch (currentSection) {
      case 'main':
        return (
          <UnifiedDashboard
            userRole="Teacher"
            userId={(() => {
              const token = storage.getItem('token')
              if (token) {
                try {
                  const payload = JSON.parse(atob(token.split('.')[1]))
                  return payload.sub || payload.id
                } catch (e) {
                  console.error('Error parsing token:', e)
                }
              }
              return null
            })()}
            allExams={quizzes}
            grades={dbGrades}
            classes={dbClasses}
            onSeeAllScores={handleSeeAllScores}
          />
        )
      case 'my-quizzes':
        return (
          <div id="quizzes-view">
            <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h1 className="content-title" style={{ margin: 0 }}><svg className="title-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>My Exams</h1>
                <p className="content-subtitle" style={{ marginTop: '0.25rem' }}>Create and manage your exams</p>
              </div>
              <button className="create-quiz-btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '.75rem 1.5rem', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '.5rem', boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)', cursor: 'pointer', transition: 'all .2s ease' }} onClick={createNewQuiz}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                Create New Exam
              </button>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <DashboardFilters
                onFilterChange={(newFilters) => setFilters(newFilters)}
                userRole="Teacher"
                grades={dbGrades}
                classes={dbClasses}
              />
            </div>
            <div className="quiz-list" id="quiz-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {quizzes.filter(quiz => {
                if (filters.gradeId && String(quiz.gradeId) !== String(filters.gradeId)) return false
                if (filters.classId) {
                  const cIds = quiz.classIds || []
                  if (!cIds.some(id => String(id) === String(filters.classId)) && String(quiz.classId) !== String(filters.classId)) return false
                }
                if (filters.startDate && new Date(quiz.startDate) < new Date(filters.startDate)) return false
                if (filters.endDate && new Date(quiz.endDate) > new Date(filters.endDate)) return false
                return true
              }).length === 0 ? (
                <div className="empty-state animate-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-main)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', gridColumn: '1 / -1' }}>
                  <svg className="empty-icon" style={{ width: '80px', height: '80px', fill: 'var(--text-light)', margin: '0 auto 1.5rem' }} viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" /></svg>
                  <h3 className="empty-title" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '.5rem' }}>No exams match your filters</h3>
                  <p className="empty-description" style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Try adjusting your filters or create a new exam</p>
                </div>
              ) : (
                quizzes.filter(quiz => {
                  if (filters.gradeId && String(quiz.gradeId) !== String(filters.gradeId)) return false
                  if (filters.classId) {
                    const cIds = quiz.classIds || []
                    if (!cIds.some(id => String(id) === String(filters.classId)) && String(quiz.classId) !== String(filters.classId)) return false
                  }
                  if (filters.startDate && new Date(quiz.startDate) < new Date(filters.startDate)) return false
                  if (filters.endDate && new Date(quiz.endDate) > new Date(filters.endDate)) return false
                  return true
                }).map((quiz, index) => (
                  <div key={quiz.id} className={`quiz-item animate-card stagger-${(index % 5) + 1}`} style={{ background: 'var(--bg-main)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', borderLeft: '4px solid var(--primary)', transition: 'transform 0.2s ease' }}>
                    <div className="quiz-info">
                      <h3 className="quiz-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{quiz.title}</h3>
                      <p className="quiz-meta" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
                        {new Date(quiz.startDate).toLocaleDateString()}
                      </p>
                      <p className="quiz-description" style={{ color: 'var(--text-secondary)', margin: '1rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{quiz.description}</p>
                    </div>
                    <div className="quiz-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                      <button className="action-btn edit-btn" style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => editQuiz(quiz.id)}>Edit</button>
                      <button className="action-btn view-btn" style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => viewQuiz(quiz.id)}>View</button>
                      <button className="action-btn delete-btn" style={{ padding: '0.5rem', background: 'var(--error-bg)', color: 'var(--error)', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => deleteQuiz(quiz.id)} aria-label="Delete"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      case 'available':
        return (
          <DashboardView
            currentSection='available'
            currentSubject={currentSubject}
            setCurrentSubject={setCurrentSubject}
            isQuizActive={activeQuizSession !== null}
            setIsQuizActive={() => { }}
            handleStartQuiz={() => { }}
            handleViewCompletedQuiz={() => { }}
            getTimeUntilDeadline={getTimeUntilDeadline}
            quizzes={quizzes.filter(q => new Date(q.startDate) <= new Date() && new Date(q.datetime) > new Date())}
          />
        )
      case 'completed':
        return (
          <DashboardView
            currentSection='completed'
            currentSubject={currentSubject}
            setCurrentSubject={setCurrentSubject}
            isQuizActive={activeQuizSession !== null}
            setIsQuizActive={() => { }}
            handleStartQuiz={() => { }}
            handleViewCompletedQuiz={() => { }}
            getTimeUntilDeadline={getTimeUntilDeadline}
            quizzes={quizzes.filter(q => new Date(q.datetime) <= new Date())}
          />
        )
      case 'question-banks':
        return (
          <div id="question-banks-view" className="question-banks-view active">
            <div className="content-header" style={{ marginBottom: '1.5rem' }}>
              <h1 className="content-title" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 .5rem 0' }}><svg className="title-icon" style={{ width: '32px', height: '32px', fill: 'var(--primary)' }} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>Question Banks</h1>
              <p className="content-subtitle" style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>Create and manage reusable question collections for your exams</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div className="question-banks-header-actions">
                <button className="create-bank-btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '.75rem 1.25rem', borderRadius: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '.5rem', boxShadow: '0 4px 12px rgba(229, 57, 53, 0.3)', cursor: 'pointer', transition: 'all .2s ease' }} onClick={createNewQuestionBank}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>Create New Bank</button>
              </div>
            </div>
            <div className="question-banks-grid" id="question-banks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {questionBanks.length === 0 ? (
                <div className="empty-state animate-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-main)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', gridColumn: '1 / -1' }}>
                  <svg className="empty-icon" style={{ width: '80px', height: '80px', fill: 'var(--text-light)', margin: '0 auto 1.5rem' }} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  <h3 className="empty-title" style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '.5rem' }}>No question banks yet</h3>
                  <p className="empty-description" style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Create your first question bank to get started</p>
                </div>
              ) : (
                questionBanks.map((bank, index) => (
                  <div key={bank.id} className={`bank-card animate-card stagger-${(index % 5) + 1}`} style={{ background: 'var(--bg-main)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', borderLeft: '4px solid var(--warning)', transition: 'transform 0.2s ease' }}>
                    <div className="bank-header">
                      <h3 className="bank-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{bank.title}</h3>
                      <div className="bank-meta" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{bank.questions ? bank.questions.length : 0} questions</span>
                        <span>•</span>
                        <span>Created {new Date(bank.created).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="bank-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                      <button className="action-btn edit-btn" style={{ flex: 1, padding: '0.5rem', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => editQuestionBank(bank.id)}>Edit</button>
                      <button className="action-btn delete-btn" style={{ padding: '0.5rem', background: 'var(--error-bg)', color: 'var(--error)', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => deleteQuestionBank(bank.id)} aria-label="Delete"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      case 'bank-editor':
        console.log('🏗️ RENDERING bank-editor case');
        console.log('bankForm state:', bankForm);
        console.log('bankEditorQuestions state:', bankEditorQuestions);
        return (
          <div id="bank-editor" className="bank-editor active" style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
            <div className="bank-editor-header" style={{ marginBottom: '2rem' }}>
              <h1 className="bank-editor-title" id="bank-editor-title" style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>{currentBankId ? 'Edit Question Bank' : 'Create New Question Bank'}</h1>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>Build a collection of reusable questions for your exams</p>
            </div>
            <div className="bank-editor-content" style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 18px rgba(0,0,0,.06)' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label className="form-label" htmlFor="bank-title" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Bank Title <span className="required" style={{ color: '#dc2626' }}>*</span></label><input type="text" id="bank-title" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none', cursor: 'text' }} placeholder="Enter question bank title" value={bankForm?.title || ''} onChange={(e) => { console.log('🔄 Title changed:', e.target.value); setBankForm(prev => ({ ...prev, title: e.target.value })); }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                  <div><label className="form-label" htmlFor="bank-description" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Description</label><input type="text" id="bank-description" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none', cursor: 'text' }} placeholder="Enter description" value={bankForm?.description || ''} onChange={(e) => { console.log('🔄 Description changed:', e.target.value); setBankForm(prev => ({ ...prev, description: e.target.value })); }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row-three" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                  <div><label className="form-label" htmlFor="bank-grade" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Grade <span className="required" style={{ color: '#dc2626' }}>*</span></label><select id="bank-grade" className="form-select" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none', cursor: 'pointer' }} value={bankForm?.gradeId || ''} onChange={(e) => { console.log('🔄 Grade changed:', e.target.value); setBankForm(prev => ({ ...prev, gradeId: e.target.value })); }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'}><option value="">Select grade</option>{dbGrades.map(g => (<option key={g.id} value={g.id}>{g.gradeName}</option>))}</select></div>
                  <div className="add-question-quiz-button-container" style={{ display: 'flex', gap: '.5rem' }}><button className="add-question-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => { console.log('Add Question clicked'); addBankQuestion(); }} ><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>Add Question</button><button className="add-question-btn upload-file" style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowFileUpload(true)} ><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" /></svg>Upload File</button></div>
                </div>
              </div>

              <div className="questions-section" style={{ marginTop: '2rem' }}>
                <div className="questions-header" style={{ marginBottom: '1.5rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Questions (<span id="bank-question-count">{bankEditorQuestions.length}</span>)</h3></div>
                <div id="bank-questions-container" style={{ minHeight: '200px', border: '2px dashed #e5e7eb', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  {bankEditorQuestions.length === 0 ? <div style={{ color: '#6b7280', fontSize: '1rem' }}>No questions added yet<br />Click "Add Question" to start building your question bank</div> : bankEditorQuestions.map((q, i) => (
                    <div key={i} className="question-item" data-question-id={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '0.75rem', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                      <div className="question-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Question {i + 1}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <select className="question-type-select" style={{ padding: '.375rem .5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '.75rem', background: 'white' }} value={q.type} onChange={(e) => changeBankQuestionType(i, e.target.value)}>
                            <option value="mcq">Multiple Choice</option>
                            <option value="true_false">True/False</option>
                            <option value="fill_blank">Fill in the Blank</option>
                          </select>
                          <button className="remove-question-btn" style={{ padding: '.375rem .5rem', borderRadius: '4px', border: '1px solid #fecaca', background: 'white', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: '.75rem' }} onClick={() => removeBankQuestion(i)}>Remove</button>
                        </div>
                      </div>
                      <div style={{ border: '1px solid #d1d5db', borderRadius: '12px', padding: '0.75rem', minHeight: '80px', background: 'white', boxShadow: '0 8px 24px rgba(0,0,0,.06)' }}>
                        <div style={{ fontSize: '.85rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>Question Text:</div>
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', minHeight: '120px', background: 'white', padding: '0.5rem' }}>
                          <RichTextEditor
                            value={q.question}
                            onChange={(value) => setBankEditorQuestions((prev) => prev.map((qq, idx) => (idx === i ? { ...qq, question: value } : qq)))}
                            placeholder="Enter your question here..."
                            autoFocus={i === 0}
                          />
                        </div>
                      </div>
                      <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label className="form-label" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Marks</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className="form-input form-input-marks"
                          placeholder="e.g., 1"
                          value={q.marks ?? 1}
                          onChange={(e) =>
                            setBankEditorQuestions((prev) =>
                              prev.map((qq, idx) => (idx === i ? { ...qq, marks: Number(e.target.value) } : qq)),
                            )
                          }
                          style={{ maxWidth: '140px', padding: '.5rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '.875rem', background: 'white' }}
                        />
                      </div>
                      <div className="question-options" style={{ marginTop: '1rem' }}>
                        {q.type === 'mcq' && (
                          <div className="options-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            {q.options.map((opt, idx) => (
                              <div key={idx} className="option-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb', minHeight: '60px' }}>
                                <div className="option-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '80px' }}>
                                  <input type="radio" name={`bank-correct-${i}`} value={idx} className="correct-checkbox" checked={q.correct === idx} onChange={() => setBankEditorQuestions((prev) => prev.map((qq, qi) => (qi === i ? { ...qq, correct: idx } : qq)))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                  <label style={{ fontSize: '.75rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>✓</label>
                                </div>
                                <div style={{ flex: 1, minHeight: '40px' }}>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => setBankEditorQuestions((prev) => prev.map((qq, qi) => (qi === i ? { ...qq, options: qq.options.map((o, oi) => (oi === idx ? e.target.value : o)) } : qq)))}
                                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '.875rem', color: '#374151', background: 'white', outline: 'none' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {q.type === 'true_false' && (
                          <div className="true-false-options" style={{ display: 'flex', gap: '2rem', padding: '.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb' }}>
                            <div className="true-false-option" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                              <input type="radio" name={`bank-tf-correct-${i}`} value="true" checked={q.correct === true} onChange={() => setBankEditorQuestions((prev) => prev.map((qq, qi) => (qi === i ? { ...qq, correct: true } : qq)))} style={{ width: '16px', height: '16px' }} />
                              <label style={{ fontSize: '.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>True</label>
                            </div>
                            <div className="true-false-option" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                              <input type="radio" name={`bank-tf-correct-${i}`} value="false" checked={q.correct === false} onChange={() => setBankEditorQuestions((prev) => prev.map((qq, qi) => (qi === i ? { ...qq, correct: false } : qq)))} style={{ width: '16px', height: '16px' }} />
                              <label style={{ fontSize: '.875rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>False</label>
                            </div>
                          </div>
                        )}
                        {q.type === 'fill_blank' && (
                          <div className="form-group">
                            <label className="form-label">Correct Answer:</label>
                            <RichTextEditor
                              value={q.correct}
                              onChange={(value) => setBankEditorQuestions((prev) => prev.map((qq, qi) => (qi === i ? { ...qq, correct: value } : qq)))}
                              placeholder="Enter the correct answer"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="editor-actions">
                <button className="save-btn" style={{ padding: '.75rem 2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', marginRight: '1rem' }} onClick={saveQuestionBank}>Save Question Bank</button>
                <button className="cancel-btn" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={cancelBankEdit}>Cancel</button>
              </div>
              {showFileUpload ? (
                <FileUpload
                  onQuestionsExtracted={handleFileUploadQuestions}
                  onClose={() => setShowFileUpload(false)}
                  bankKey={bankKeyRef.current}
                />
              ) : null}
            </div>
          </div>
        )
      case 'bank-viewer':
        return currentBank && (
          <div id="bank-viewer" className="bank-viewer active" style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
            <div className="bank-viewer-header" style={{ marginBottom: '2rem' }}><h1 className="bank-viewer-title" id="bank-viewer-title" style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>{currentBank.title}</h1><p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>View question bank content and questions</p></div>
            <div className="bank-viewer-content" style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 18px rgba(0,0,0,.06)' }}>
              <div className="bank-info-section" style={{ marginBottom: '2rem' }}>
                <div className="bank-info-grid" id="bank-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="bank-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}><div className="bank-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Subject</div><div className="bank-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{currentBank.subject}</div></div>
                  <div className="bank-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}><div className="bank-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Grade</div><div className="bank-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{currentBank.grade}</div></div>
                  <div className="bank-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}><div className="bank-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Questions</div><div className="bank-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{currentBank.questions ? currentBank.questions.length : 0}</div></div>
                  <div className="bank-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}><div className="bank-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Created</div><div className="bank-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{new Date(currentBank.created).toLocaleDateString()}</div></div>
                </div>
                <div id="bank-description-display" style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>{currentBank.description ? <p className="description-text" style={{ fontSize: '.875rem', color: '#0c4a6e', margin: 0 }}>{currentBank.description}</p> : null}</div>
              </div>
              <div className="questions-display" id="bank-questions-display">
                {currentBank.questions && currentBank.questions.length > 0 ? (
                  currentBank.questions.map((question, index) => (
                    <div key={index} className="question-display-item">
                      <div className="question-display-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.5rem' }}>
                        <h4 style={{ margin: 0 }}>Question {index + 1} {typeof question.marks !== 'undefined' ? `(Marks: ${question.marks})` : ''}</h4>
                        <span className={`question-type-badge type-${question.type}`} style={{ padding: '.25rem .5rem', borderRadius: '999px', border: '1px solid #e5e7eb', fontSize: '.75rem', fontWeight: 700 }}>{question.type === 'mcq' ? 'Multiple Choice' : question.type === 'true_false' ? 'True/False' : 'Fill in the Blank'}</span>
                      </div>
                      <div className="question-stem" style={{ padding: '.5rem .75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '.75rem' }} dangerouslySetInnerHTML={{ __html: renderRichText(question.question) }} />
                      {question.type === 'mcq' && question.options ? (
                        <div className="options-display" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className={`option-display-item ${question.correct === optionIndex ? 'correct' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff' }}>
                              <div className={`option-indicator ${question.correct === optionIndex ? 'correct' : ''}`} style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: question.correct === optionIndex ? '#dcfce7' : '#f9fafb', fontWeight: 700 }}>{String.fromCharCode(65 + optionIndex)}</div>
                              <span dangerouslySetInnerHTML={{ __html: renderRichText(option) }} />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {question.type === 'true_false' ? (
                        <div className="true-false-display" style={{ display: 'flex', gap: '1rem' }}><div className={`tf-option ${question.correct === true ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === true ? '#dcfce7' : '#fff' }}>True</div><div className={`tf-option ${question.correct === false ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === false ? '#dcfce7' : '#fff' }}>False</div></div>
                      ) : null}
                      {question.type === 'fill_blank' ? (
                        <div className="fill-blank-answer" style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}><strong>Answer:</strong> <span dangerouslySetInnerHTML={{ __html: renderRichText(question.correct) }} /></div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="empty-state"><h3 className="empty-title">No questions added yet</h3><p className="empty-description">This question bank doesn't have any questions</p></div>
                )}
              </div>
              <div className="submit-section" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}><button type="button" className="back-btn" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => showSection('question-banks')}>← Back to Question Banks</button></div>
            </div>
          </div>
        )
      case 'quiz-viewer':
        return resolvedCurrentQuiz && (
          <div id="quiz-viewer" className="quiz-viewer active" style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
            <div className="viewer-header" style={{ marginBottom: '2rem' }}>
              <h1 className="viewer-title" id="viewer-title" style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>{resolvedCurrentQuiz.title}</h1>
              <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>View exam content and questions</p>
            </div>
            <div className="viewer-content" style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 18px rgba(0,0,0,.06)' }}>
              <div className="quiz-info-section" style={{ marginBottom: '2rem' }}>
                <div className="quiz-info-grid" id="quiz-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="quiz-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div className="quiz-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Grade</div>
                    <div className="quiz-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{resolvedCurrentQuiz.grade}</div>
                  </div>
                  <div className="quiz-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div className="quiz-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Class</div>
                    <div className="quiz-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{resolvedCurrentQuiz.class}</div>
                  </div>
                  <div className="quiz-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div className="quiz-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Start Date</div>
                    <div className="quiz-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{resolvedCurrentQuiz.startDate ? new Date(resolvedCurrentQuiz.startDate).toLocaleDateString() : 'Not set'}</div>
                  </div>
                  <div className="quiz-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div className="quiz-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Questions</div>
                    <div className="quiz-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{resolvedCurrentQuiz.questions_data ? resolvedCurrentQuiz.questions_data.length : 0}</div>
                  </div>
                  <div className="quiz-info-item" style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div className="quiz-info-label" style={{ fontSize: '.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.25rem' }}>Scheduled</div>
                    <div className="quiz-info-value" style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>{new Date(resolvedCurrentQuiz.datetime).toLocaleDateString()} at {new Date(resolvedCurrentQuiz.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div id="quiz-description-display" style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  {resolvedCurrentQuiz.description ? <p style={{ fontSize: '.875rem', color: '#0c4a6e', margin: 0 }}>{resolvedCurrentQuiz.description}</p> : null}
                </div>
              </div>
              <div className="questions-display" id="questions-display">
                {resolvedCurrentQuiz.questions_data && resolvedCurrentQuiz.questions_data.length > 0 ? (
                  resolvedCurrentQuiz.questions_data.map((question, index) => (
                    <div key={index} className="question-display-item" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '0.75rem', boxShadow: '0 4px 14px rgba(0,0,0,.06)' }}>
                      <div className="question-display-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.5rem' }}>
                        <h4 style={{ margin: 0 }}>Question {index + 1} {typeof question.marks !== 'undefined' ? `(Marks: ${question.marks})` : ''}</h4>
                        <span className={`question-type-badge type-${question.type}`} style={{ padding: '.25rem .5rem', borderRadius: '999px', border: '1px solid #e5e7eb', fontSize: '.75rem', fontWeight: 700 }}>{question.type === 'mcq' ? 'Multiple Choice' : question.type === 'true_false' ? 'True/False' : 'Fill in the Blank'}</span>
                      </div>
                      <div className="question-stem" style={{ padding: '.5rem .75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '.75rem' }} dangerouslySetInnerHTML={{ __html: renderRichText(question.question) }} />
                      {question.type === 'mcq' && question.options ? (
                        <div className="options-display" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className={`option-display-item ${question.correct === optionIndex ? 'correct' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff' }}>
                              <div className={`option-indicator ${question.correct === optionIndex ? 'correct' : ''}`} style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: question.correct === optionIndex ? '#dcfce7' : '#f9fafb', fontWeight: 700 }}>{String.fromCharCode(65 + optionIndex)}</div>
                              <span dangerouslySetInnerHTML={{ __html: renderRichText(option) }} />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {question.type === 'true_false' ? (
                        <div className="true-false-display" style={{ display: 'flex', gap: '1rem' }}>
                          <div className={`tf-option ${question.correct === true ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === true ? '#dcfce7' : '#fff' }}>True</div>
                          <div className={`tf-option ${question.correct === false ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === false ? '#dcfce7' : '#fff' }}>False</div>
                        </div>
                      ) : null}
                      {question.type === 'fill_blank' ? (
                        <div className="fill-blank-answer" style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}><strong>Answer:</strong> <span dangerouslySetInnerHTML={{ __html: renderRichText(question.correct) }} /></div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 2rem', color: '#6b7280' }}>
                    <svg className="empty-icon" viewBox="0 0 24 24" style={{ width: '48px', height: '48px', fill: '#d1d5db', marginBottom: '1rem' }}>
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                    </svg>
                    <h3 className="empty-title" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#374151', margin: '0 0 0.5rem 0' }}>No questions added yet</h3>
                    <p className="empty-description" style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>This exam doesn't have any questions</p>
                  </div>
                )}
              </div>
              <div className="submit-section" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" className="back-btn" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={() => showSection('my-quizzes')}>← Back to Exams</button>
              </div>
            </div>
          </div>
        )
      case 'quiz-editor':
        return (
          <div id="quiz-editor" className="quiz-editor active" style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
            <div className="editor-header" style={{ marginBottom: '2rem' }}><h1 className="editor-title" id="editor-title" style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>{currentQuizId ? 'Edit Exam' : 'Create New Exam'}</h1><p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>Design your exam with multiple question types</p></div>
            <div className="editor-content" style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 18px rgba(0,0,0,.06)', overflow: 'visible', position: 'relative' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label className="form-label" htmlFor="quiz-title" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Exam Title <span className="required" style={{ color: '#dc2626' }}>*</span></label><input type="text" id="quiz-title" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none' }} placeholder="Enter exam title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                  <div><label className="form-label" htmlFor="quiz-description" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Description</label><input type="text" id="quiz-description" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none' }} placeholder="Enter exam description" value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label className="form-label" htmlFor="quiz-grade" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Grade <span className="required" style={{ color: '#dc2626' }}>*</span></label><select id="quiz-grade" className="form-select" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none' }} value={quizForm.gradeId || ''} onChange={(e) => {
                    const newGradeId = e.target.value
                    console.log('📚 Grade changed to:', newGradeId)
                    setQuizForm({
                      ...quizForm,
                      gradeId: newGradeId,
                      grade: e.target.options[e.target.selectedIndex].text,
                      classIds: [] // Clear classes when grade changes
                    })
                  }} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'}><option value="">Select grade</option>{dbGrades.map(g => (<option key={g.id} value={g.id}>{g.gradeName}</option>))}</select></div>
                  <div style={{ position: 'relative', zIndex: 1000 }}>
                    <MultiSelectDropdown
                      id="quiz-class"
                      label="Classes"
                      placeholder={quizForm.gradeId ? "Select classes" : "Select grade first"}
                      options={(dbClasses || []).filter(c => Number(c.gradeId) === Number(quizForm.gradeId)).map(c => ({ id: Number(c.id), label: c.className, value: Number(c.id) }))}
                      selectedIds={(quizForm.classIds || []).map(Number)}
                      onChange={(newIds) => setQuizForm({ ...quizForm, classIds: newIds })}
                      disabled={!quizForm.gradeId}
                    />
                  </div>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label className="form-label" htmlFor="quiz-start-date" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>Start Date & Time <span className="required" style={{ color: '#dc2626' }}>*</span></label><input type="datetime-local" id="quiz-start-date" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none' }} value={quizForm.startDate} onChange={(e) => setQuizForm({ ...quizForm, startDate: e.target.value })} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                  <div><label className="form-label" htmlFor="quiz-datetime" style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}>End Date & Time <span className="required" style={{ color: '#dc2626' }}>*</span></label><input type="datetime-local" id="quiz-datetime" className="form-input" style={{ width: '100%', padding: '.75rem', border: '2px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', background: 'white', outline: 'none' }} value={quizForm.datetime} onChange={(e) => setQuizForm({ ...quizForm, datetime: e.target.value })} onFocus={(e) => e.target.style.borderColor = '#3b82f6'} onBlur={(e) => e.target.style.borderColor = '#d1d5db'} /></div>
                </div>
              </div>
              <div className="questions-section" style={{ marginTop: '2rem' }}>
                <div className="questions-header" style={{ marginBottom: '1.5rem' }}><h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1f2937', margin: 0 }}>Questions (<span id="quiz-question-count">{currentQuizQuestions.length}</span>)</h3></div>
                <div id="questions-container" style={{ minHeight: '200px', border: '2px dashed #e5e7eb', borderRadius: '8px', padding: '2rem', textAlign: currentQuizQuestions.length === 0 ? 'center' : 'left', marginBottom: '1.5rem' }}>{currentQuizQuestions.length === 0 ? <div style={{ color: '#6b7280', fontSize: '1rem' }}>No questions added yet<br />Add questions from your question banks</div> : renderQuizEditorQuestions()}</div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="add-question-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={openQuestionBankSelector}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                    Add Questions from Bank
                  </button>
                  <div className="upload-button-container">
                    <button
                      className="add-question-btn upload-file"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', padding: '.75rem 1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setShowFileUpload(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                      Upload Questions File
                    </button>
                  </div>
                </div>
              </div>
              <div className="editor-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}><button className="save-btn" style={{ padding: '.75rem 2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={saveQuiz}>Save Exam</button><button className="cancel-btn" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={cancelEdit}>Cancel</button></div>
            </div>
            {showFileUpload ? (
              <FileUpload
                onQuestionsExtracted={handleFileUploadQuestions}
                onClose={() => setShowFileUpload(false)}
              />
            ) : null}
          </div>
        )
      case 'question-bank-selector':
        return (
          <div id="question-bank-selector-view" className="question-bank-selector-view active">
            <div className="selector-header"><h1 className="selector-title">Select Questions from Banks</h1><p>Choose questions from your existing question banks to add to this exam.</p></div>
            <div className="selector-content">
              <div id="selectable-question-banks-list" className="selectable-banks-grid">{renderSelectableQuestionBanks()}</div>
              <div className="selector-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}><button className="selector-btn selector-btn-secondary" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={backToQuizEditor}>← Back to Exam Editor</button></div>
            </div>
          </div>
        )
      case 'question-bank-questions-selector':
        return currentBank && (
          <div id="question-bank-questions-selector-view" className="question-bank-questions-selector-view active">
            <div className="selector-header"><h1 className="selector-title" id="selectable-bank-title">{currentBank.title}</h1><p id="selectable-bank-description">{currentBank.description || 'Choose questions from this bank.'}</p></div>
            <div className="selector-content">
              <div id="selectable-questions-list">
                {currentBank.questions && currentBank.questions.length > 0 ? (
                  currentBank.questions.map((question, index) => (
                    <div
                      key={index}
                      className="question-display-item"
                      style={{
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 4px 14px rgba(0,0,0,.06)'
                      }}
                      onClick={(e) => {
                        // Avoid toggling when clicking the checkbox directly
                        if (e.target && (e.target.tagName === 'INPUT' || e.target.closest('input'))) return;
                        const currently = isQuestionSelected(currentBank.id, index)
                        toggleQuestionSelection(currentBank.id, index, !currently)
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'start', gap: '0.75rem' }}>
                        <input type="checkbox" id={`select-q-${currentBank.id}-${index}`} value={`${currentBank.id}::${index}`} checked={isQuestionSelected(currentBank.id, index)} onChange={(e) => toggleQuestionSelection(currentBank.id, index, e.target.checked)} />
                        <div>
                          <div className="question-display-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem', marginBottom: '.5rem' }}>
                            <h4 style={{ margin: 0 }}>Question {index + 1} {typeof question.marks !== 'undefined' ? `(Marks: ${question.marks})` : ''}</h4>
                            <span className={`question-type-badge type-${question.type}`} style={{ padding: '.25rem .5rem', borderRadius: '999px', border: '1px solid #e5e7eb', fontSize: '.75rem', fontWeight: 700 }}>{question.type === 'mcq' ? 'Multiple Choice' : question.type === 'true_false' ? 'True/False' : 'Fill in the Blank'}</span>
                          </div>
                          <div className="question-stem" style={{ padding: '.5rem .75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '.75rem' }} dangerouslySetInnerHTML={{ __html: renderRichText(question.question) }} />
                          {question.type === 'mcq' && question.options ? (
                            <div className="options-display" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                              {question.options.map((option, optionIndex) => (
                                <div key={optionIndex} className={`option-display-item ${question.correct === optionIndex ? 'correct' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#ffffff' }}>
                                  <div className={`option-indicator ${question.correct === optionIndex ? 'correct' : ''}`} style={{ width: '24px', height: '24px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', background: question.correct === optionIndex ? '#dcfce7' : '#f9fafb', fontWeight: 700 }}>{String.fromCharCode(65 + optionIndex)}</div>
                                  <span dangerouslySetInnerHTML={{ __html: renderRichText(option) }} />
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {question.type === 'true_false' ? (
                            <div className="true-false-display" style={{ display: 'flex', gap: '1rem' }}><div className={`tf-option ${question.correct === true ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === true ? '#dcfce7' : '#fff' }}>True</div><div className={`tf-option ${question.correct === false ? 'correct' : ''}`} style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: question.correct === false ? '#dcfce7' : '#fff' }}>False</div></div>
                          ) : null}
                          {question.type === 'fill_blank' ? (
                            <div className="fill-blank-answer" style={{ padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}><strong>Answer:</strong> <span dangerouslySetInnerHTML={{ __html: renderRichText(question.correct) }} /></div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state"><h3 className="empty-title">No questions in this bank</h3></div>
                )}
              </div>
              <div className="selector-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}><button className="selector-btn selector-btn-primary" style={{ padding: '.75rem 2rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={addSelectedQuestionsToQuiz}>Add Selected Questions</button><button className="selector-btn selector-btn-secondary" style={{ padding: '.75rem 2rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={backToQuestionBankSelector}>← Back to Banks</button></div>
            </div>
          </div>
        )
      case 'students':
      case 'students':
      case 'classes':
      case 'class-students':
        console.log('🏗️ RENDERING students grid case')
        return (
          <StudentsDataGrid
            students={students}
            allExams={quizzes}
            initialExamId={studentFilterExamId}
            initialGrade={studentFilterGrade}
            onStudentClick={showStudentDetail}
          />
        )
      case 'student-detail':
        return selectedStudentId && (() => {
          const student = students.find((s) => s.id === selectedStudentId)
          if (!student) return null

          const scores = Object.values(student.quizScores || {})
          const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
          const completedExams = scores.length
          const highestScore = scores.length > 0 ? Math.max(...scores) : 0
          const lowestScore = scores.length > 0 ? Math.min(...scores) : 0

          return (
            <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
              <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header with Back Button */}
                <button
                  onClick={() => showStudentsForClass(currentClass?.grade || currentGrade, currentClass?.class || '')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <svg style={{ width: '16px', height: '16px', fill: 'white' }} viewBox="0 0 24 24">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                  </svg>
                  Back to Students
                </button>

                {/* Student Profile Card */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)', marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2rem' }}>
                    <div style={{
                      width: '96px',
                      height: '96px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: '700',
                      color: 'white',
                      boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)'
                    }}>
                      {student.initials || student.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>{student.name}</h1>
                      <p style={{ fontSize: '1.125rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>{student.grade} - {student.class}</p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: '0.875rem', color: '#0c4a6e', marginBottom: '0.5rem', fontWeight: '600' }}>Exams Completed</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0369a1' }}>{completedExams}</div>
                    </div>
                    <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '1.5rem', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.875rem', color: '#14532d', marginBottom: '0.5rem', fontWeight: '600' }}>Average Score</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#15803d' }}>{avgScore}%</div>
                    </div>
                    <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '1.5rem', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '0.5rem', fontWeight: '600' }}>Highest Score</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#b45309' }}>{highestScore}%</div>
                    </div>
                    <div style={{ background: '#fee2e2', borderRadius: '12px', padding: '1.5rem', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '0.5rem', fontWeight: '600' }}>Lowest Score</div>
                      <div style={{ fontSize: '2rem', fontWeight: '700', color: '#991b1b' }}>{lowestScore}%</div>
                    </div>
                  </div>
                </div>

                {/* Exam History Card */}
                <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '1.5rem' }}>Exam History</h2>

                  {Object.entries(student.quizScores || {}).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                      <svg style={{ width: '64px', height: '64px', fill: '#d1d5db', margin: '0 auto 1rem' }} viewBox="0 0 24 24">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                      </svg>
                      <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151' }}>No exams completed yet</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {Object.entries(student.quizScores || {}).map(([quizId, score]) => {
                        const quiz = quizzes.find((q) => q.id == quizId)
                        if (!quiz) return null

                        let bgColor = '#fee2e2'
                        let borderColor = '#fecaca'
                        let textColor = '#991b1b'
                        let badgeBg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'

                        if (score >= 90) {
                          bgColor = '#dcfce7'
                          borderColor = '#bbf7d0'
                          textColor = '#15803d'
                          badgeBg = 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                        } else if (score >= 75) {
                          bgColor = '#fef3c7'
                          borderColor = '#fde68a'
                          textColor = '#b45309'
                          badgeBg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                        }

                        return (
                          <div
                            key={quizId}
                            style={{
                              background: bgColor,
                              border: `1px solid ${borderColor}`,
                              borderRadius: '12px',
                              padding: '1.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <div>
                              <h4 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, margin: 0 }}>{quiz.title}</h4>
                              <div style={{ fontSize: '0.875rem', color: textColor, marginTop: '0.25rem', opacity: 0.8 }}>
                                Completed on {new Date(quiz.created).toLocaleDateString()}
                              </div>
                            </div>
                            <div style={{
                              background: badgeBg,
                              color: 'white',
                              padding: '0.75rem 1.5rem',
                              borderRadius: '999px',
                              fontSize: '1.5rem',
                              fontWeight: '700',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                              minWidth: '100px',
                              textAlign: 'center'
                            }}>
                              {score}%
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()
      case 'profile':
        return (
          <UserProfile
            userRole={userRole || 'Teacher'}
            onBack={() => showSection('main')}
          />
        )
      default:
        return null
    }
  }, [
    currentSection,
    currentBankId,
    currentQuizId,
    quizzes,
    questionBanks,
    students,
    currentSubject,
    activeQuizSession,
    currentGrade,
    currentClass,
    selectedStudentId,
    resolvedCurrentQuiz,
    currentBankSnapshot,
    isSuperAdminView,
    selectedTeacherData,
    teacherName,
    bankForm,
    bankEditorQuestions,
    showFileUpload,
    quizForm,
    currentQuizQuestions,
    selectedBankQuestions,
    userRole,
    filters // REQUIRED for filtering to work!
  ])

  return (
    <ErrorBoundary>
      <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          isExamActive={activeQuizSession !== null}
          currentSection={currentSection}
          showSection={showSection}
          handleLogout={handleLogout}
          userRole={userRole || 'Teacher'}
        />
        <div className="main-content section-transition" style={{ flex: 1, overflowY: 'auto' }}>
          {/* Welcome Card */}
          {currentSection !== 'profile' && (
            <div style={{ padding: '1.5rem 2rem 0' }}>
              <div style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                padding: '1.5rem 2rem',
                borderRadius: '16px',
                color: 'white',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Hello, {teacherName}! 👋</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
                    You are logged in as a <span style={{ color: '#ffffff', fontWeight: 700 }}>{userRole || 'Teacher'}</span>
                  </p>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'right'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.7 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                </div>
              </div>
            </div>
          )}
          {/* Debug Indicator - Hidden in production but helps us confirm routing */}
          <div style={{ display: 'none' }} data-section={currentSection}></div>
          {currentView}
        </div>

        {/* Modal */}
        <QuizModal
          title={modalTitle}
          message={modalMessage}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isActive={isModalActive}
        />
      </div>
    </ErrorBoundary>
  )
}