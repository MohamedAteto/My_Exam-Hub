import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DashboardFilters from './DashboardFilters'

describe('Dashboard grade and class filters', () => {
  it('emits database IDs and offers only classes linked to the selected grade', async () => {
    const onFilterChange = vi.fn()
    const { container } = render(
      <DashboardFilters
        onFilterChange={onFilterChange}
        grades={[
          { id: 31, gradeName: 'Junior' },
          { id: 47, gradeName: 'Wheeler' }
        ]}
        classes={[
          { id: 103, className: 'J1', gradeId: 31 },
          { id: 204, className: 'W1', gradeId: 47 }
        ]}
      />
    )

    const gradeFilter = container.querySelectorAll('.modern-select')[0]
    fireEvent.click(within(gradeFilter).getByRole('button', { name: 'All Grades' }))
    fireEvent.click(within(gradeFilter).getByText('Junior'))

    const classFilter = container.querySelectorAll('.modern-select')[1]
    fireEvent.click(within(classFilter).getByRole('button', { name: 'All Classes' }))
    expect(within(classFilter).getByText('J1')).toBeTruthy()
    expect(within(classFilter).queryByText('W1')).toBeNull()
    fireEvent.click(within(classFilter).getByText('J1'))

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ gradeId: 31, classId: 103 }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }))
    await waitFor(() => {
      expect(onFilterChange).toHaveBeenLastCalledWith({
        gradeId: null,
        classId: null,
        subjectId: null,
        startDate: null,
        endDate: null,
        groupBy: 'Student'
      })
    })
  })

  it('locks Student filters to the assigned class and merges completed exams into exam options', () => {
    const { container } = render(
      <DashboardFilters
        userRole="Student"
        onFilterChange={() => {}}
        grades={[
          { id: 1, gradeName: 'Junior' },
          { id: 2, gradeName: 'Wheeler' }
        ]}
        classes={[
          { id: 11, gradeId: 1, className: 'J1' },
          { id: 21, gradeId: 2, className: 'W1' }
        ]}
        subjects={[{ id: 7, statusName: 'Math' }]}
        allExams={[{ examId: 202, title: 'Upcoming W1', gradeId: 2, classIds: [21], subjectId: 7, startDate: '2026-09-30T10:00:00Z' }]}
        recentExams={[{ examId: 101, title: 'Completed J1', gradeId: 1, classIds: [11], subjectId: 7, date: '2026-09-20T10:00:00Z', studentScore: 80 }]}
        currentFilters={{ gradeId: 1, classId: 11, subjectId: 7, groupBy: 'Student' }}
      />
    )

    const gradeFilter = container.querySelectorAll('.modern-select')[0]
    fireEvent.click(within(gradeFilter).getByRole('button', { name: 'Junior' }))
    expect(within(gradeFilter).queryByText('All Grades')).toBeNull()
    expect(within(gradeFilter).queryByText('Wheeler')).toBeNull()

    const classFilter = container.querySelectorAll('.modern-select')[1]
    fireEvent.click(within(classFilter).getByRole('button', { name: 'J1' }))
    expect(within(classFilter).queryByText('All Classes')).toBeNull()
    expect(within(classFilter).queryByText('W1')).toBeNull()

    const examFilter = [...container.querySelectorAll('.modern-select')].find(select => select.textContent.includes('Selected Exam'))
    fireEvent.click(within(examFilter).getByRole('button', { name: 'All Exams' }))
    expect(within(examFilter).getByText('Completed J1')).toBeTruthy()
    expect(within(examFilter).queryByText('Upcoming W1')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }))
    expect(within(gradeFilter).getByRole('button', { name: 'Junior' })).toBeTruthy()
    expect(within(classFilter).getByRole('button', { name: 'J1' })).toBeTruthy()
  })
})