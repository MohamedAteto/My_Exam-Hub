const EXAM_REPORT_COLUMNS = [
  { key: 'examTitle', label: 'Exam', width: 32, type: 'text' },
  { key: 'subjectName', label: 'Subject', width: 22, type: 'text' },
  { key: 'examDate', label: 'Exam Date', width: 22, type: 'date' },
  { key: 'totalStudents', label: 'Results', width: 12, type: 'integer' },
  { key: 'passedStudents', label: 'Passed', width: 12, type: 'integer' },
  { key: 'failedStudents', label: 'Failed', width: 12, type: 'integer' },
  { key: 'passPercentage', label: 'Pass Rate', width: 14, type: 'percentage' },
  { key: 'averageScore', label: 'Average Score', width: 16, type: 'score' }
]

const STUDENT_REPORT_COLUMNS = [
  { key: 'examTitle', label: 'Exam', width: 32, type: 'text' },
  { key: 'subjectName', label: 'Subject', width: 22, type: 'text' },
  { key: 'examDate', label: 'Exam Date', width: 22, type: 'date' },
  { key: 'studentScore', label: 'My Score', width: 14, type: 'score' },
  { key: 'averageScore', label: 'Class Average', width: 16, type: 'score' },
  { key: 'result', label: 'Result', width: 14, type: 'text' }
]

const getExamId = (exam) => exam?.examId ?? exam?.ExamId ?? exam?.id ?? exam?.Id

export function buildDashboardReport(data, { userRole = '', selectedExamId = null } = {}) {
  const isStudent = String(userRole).toLowerCase() === 'student'
  const source = isStudent ? data?.recentExams || [] : data?.examBreakdown || []
  const selectedRows = selectedExamId
    ? source.filter(exam => String(getExamId(exam)) === String(selectedExamId))
    : source

  if (isStudent) {
    const rows = selectedRows.map(exam => {
      const studentScore = exam.studentScore ?? exam.StudentScore ?? null
      return {
        examTitle: exam.title ?? exam.Title ?? 'Exam',
        subjectName: exam.subjectName ?? exam.SubjectName ?? 'N/A',
        examDate: exam.date ?? exam.Date ?? null,
        studentScore,
        averageScore: exam.averageScore ?? exam.AverageScore ?? null,
        result: studentScore == null ? 'No result' : Number(studentScore) >= 50 ? 'Passed' : 'Failed'
      }
    })
    const scoredRows = rows.filter(row => row.studentScore != null)
    const passed = scoredRows.filter(row => Number(row.studentScore) >= 50).length
    const scoreTotal = scoredRows.reduce((sum, row) => sum + Number(row.studentScore), 0)
    return {
      id: 'student-performance',
      title: 'Student Performance Report',
      description: 'Exam scores and class averages for the applied Dashboard filters.',
      columns: STUDENT_REPORT_COLUMNS,
      rows,
      summary: [
        { label: 'Exams', value: rows.length },
        { label: 'Scored Results', value: scoredRows.length },
        { label: 'Average Score', value: scoredRows.length ? `${(scoreTotal / scoredRows.length).toFixed(2)}%` : 'N/A' },
        { label: 'Pass Rate', value: scoredRows.length ? `${((passed / scoredRows.length) * 100).toFixed(2)}%` : 'N/A' }
      ]
    }
  }

  const rows = selectedRows.map(exam => {
    const totalStudents = Number(exam.totalStudents ?? exam.TotalStudents ?? 0)
    const passedStudents = Number(exam.passedStudents ?? exam.PassedStudents ?? 0)
    return {
      examTitle: exam.examTitle ?? exam.ExamTitle ?? 'Exam',
      subjectName: exam.subjectName ?? exam.SubjectName ?? 'N/A',
      examDate: exam.examDate ?? exam.ExamDate ?? null,
      totalStudents,
      passedStudents,
      failedStudents: Number(exam.failedStudents ?? exam.FailedStudents ?? Math.max(0, totalStudents - passedStudents)),
      passPercentage: exam.passPercentage ?? exam.PassPercentage ?? (totalStudents ? (passedStudents / totalStudents) * 100 : 0),
      averageScore: exam.averageScore ?? exam.AverageScore ?? 0
    }
  })
  const resultCount = rows.reduce((sum, row) => sum + row.totalStudents, 0)
  const passedCount = rows.reduce((sum, row) => sum + row.passedStudents, 0)
  const scoreTotal = rows.reduce((sum, row) => sum + row.averageScore * row.totalStudents, 0)
  return {
    id: 'exam-performance',
    title: 'Exam Performance Report',
    description: 'Per-exam results, pass rates, and average scores for the applied Dashboard filters.',
    columns: EXAM_REPORT_COLUMNS,
    rows,
    summary: [
      { label: 'Exams', value: rows.length },
      { label: 'Student-Exam Results', value: resultCount },
      { label: 'Average Score', value: resultCount ? `${(scoreTotal / resultCount).toFixed(2)}%` : 'N/A' },
      { label: 'Pass Rate', value: resultCount ? `${((passedCount / resultCount) * 100).toFixed(2)}%` : 'N/A' }
    ]
  }
}

export function buildAppliedDashboardFilters({ filters = {}, selectedExamId, grades = [], classes = [], subjects = [], allExams = [], recentExams = [] }) {
  const labels = []
  const findById = (items, id) => items.find(item => String(item.id ?? item.Id ?? item.examId ?? item.ExamId) === String(id))

  if (filters.gradeId) {
    const grade = findById(grades, filters.gradeId)
    labels.push(`Grade: ${grade?.gradeName ?? grade?.name ?? filters.gradeId}`)
  }
  if (filters.classId) {
    const classItem = findById(classes, filters.classId)
    labels.push(`Class: ${classItem?.className ?? classItem?.name ?? filters.classId}`)
  }
  if (filters.subjectId) {
    const subject = findById(subjects, filters.subjectId)
    labels.push(`Subject: ${subject?.statusName ?? subject?.subjectName ?? filters.subjectId}`)
  }
  if (selectedExamId) {
    const exam = findById(allExams.length ? allExams : recentExams, selectedExamId)
    labels.push(`Exam: ${exam?.title ?? exam?.Title ?? selectedExamId}`)
  }
  if (filters.startDate) labels.push(`From: ${new Date(filters.startDate).toLocaleString()}`)
  if (filters.endDate) labels.push(`Through: ${new Date(filters.endDate).toLocaleString()}`)

  return labels.length ? labels : ['All Dashboard data']
}