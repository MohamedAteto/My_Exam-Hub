import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StudentsDataGrid from './StudentsDataGrid'

const grades = [
  { id: 1, gradeName: 'Junior' },
  { id: 2, gradeName: 'Wheeler' }
]

const classes = [
  { id: 11, gradeId: 1, className: 'J1' },
  { id: 21, gradeId: 2, className: 'W1' }
]

const students = [
  { id: 101, name: 'Junior Student', email: 'junior@example.com', initials: 'JS', grade: 'Junior', class: 'J1', gradeId: 1, classId: 11, quizScores: {} },
  { id: 103, name: 'Legacy Payload Student', email: 'legacy@example.com', initials: 'LP', grade: 'Junior', class: 'J1', quizScores: {} },
  { id: 102, name: 'Same Label Different ID', email: 'other@example.com', initials: 'SL', grade: 'Junior', class: 'J1', gradeId: 1, classId: 99, quizScores: {} },
  { id: 201, name: 'Wheeler Student', email: 'wheeler@example.com', initials: 'WS', grade: 'Wheeler', class: 'W1', gradeId: 2, classId: 21, quizScores: {} }
]

describe('Students grade and class filters', () => {
  it('uses DB IDs and only offers classes related to the selected grade', () => {
    const { container } = render(
      <StudentsDataGrid students={students} allExams={[]} grades={grades} classes={classes} onStudentClick={() => {}} />
    )

    const gradeFilter = container.querySelectorAll('.modern-select')[0]
    fireEvent.click(within(gradeFilter).getByRole('button', { name: 'All Grades' }))
    fireEvent.click(within(gradeFilter).getByText('Junior'))

    const classFilter = container.querySelectorAll('.modern-select')[1]
    fireEvent.click(within(classFilter).getByRole('button', { name: 'All Classes' }))
    expect(within(classFilter).getByText('J1')).toBeTruthy()
    expect(within(classFilter).queryByText('W1')).toBeNull()
    fireEvent.click(within(classFilter).getByText('J1'))

    expect(screen.getByText('Junior Student')).toBeTruthy()
    expect(screen.getByText('Legacy Payload Student')).toBeTruthy()
    expect(screen.queryByText('Same Label Different ID')).toBeNull()
    expect(screen.queryByText('Wheeler Student')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Export Report' }))
    const reportDialog = screen.getByRole('dialog', { name: 'Export Report' })
    expect(within(reportDialog).getByText('Grade: Junior')).toBeTruthy()
    expect(within(reportDialog).getByText('Class: J1')).toBeTruthy()
    expect(within(reportDialog).getByText('Junior Student')).toBeTruthy()
    expect(within(reportDialog).getByText('Legacy Payload Student')).toBeTruthy()
    expect(within(reportDialog).queryByText('Same Label Different ID')).toBeNull()
  })
})