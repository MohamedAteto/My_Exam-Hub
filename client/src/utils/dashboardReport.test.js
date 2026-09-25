import { describe, expect, it } from 'vitest'
import { buildAppliedDashboardFilters, buildDashboardReport } from './dashboardReport'

describe('Dashboard report definitions', () => {
  it('builds an exam report and weighted summary from filtered exam breakdown rows', () => {
    const report = buildDashboardReport({
      examBreakdown: [
        { examId: 1, examTitle: 'Math', subjectName: 'Math', totalStudents: 2, passedStudents: 1, failedStudents: 1, passPercentage: 50, averageScore: 50 },
        { examId: 2, examTitle: 'Science', subjectName: 'Science', totalStudents: 2, passedStudents: 2, failedStudents: 0, passPercentage: 100, averageScore: 100 }
      ]
    })

    expect(report.rows).toHaveLength(2)
    expect(report.summary).toContainEqual({ label: 'Student-Exam Results', value: 4 })
    expect(report.summary).toContainEqual({ label: 'Average Score', value: '75.00%' })
    expect(report.summary).toContainEqual({ label: 'Pass Rate', value: '75.00%' })
  })

  it('uses the student score, not class average, and honors selected exam', () => {
    const report = buildDashboardReport({
      recentExams: [
        { examId: 1, title: 'Math', studentScore: 40, averageScore: 90, date: '2026-09-25T10:00:00Z' },
        { examId: 2, title: 'Science', studentScore: 80, averageScore: 60, date: '2026-09-26T10:00:00Z' }
      ]
    }, { userRole: 'Student', selectedExamId: 2 })

    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]).toMatchObject({ examTitle: 'Science', studentScore: 80, averageScore: 60, result: 'Passed' })
  })

  it('formats active filters from DB lookup records', () => {
    expect(buildAppliedDashboardFilters({
      filters: { gradeId: 1, classId: 11, subjectId: 5 },
      grades: [{ id: 1, gradeName: 'Junior' }],
      classes: [{ id: 11, className: 'J1' }],
      subjects: [{ id: 5, statusName: 'Mathematics' }]
    })).toEqual(['Grade: Junior', 'Class: J1', 'Subject: Mathematics'])
  })
})