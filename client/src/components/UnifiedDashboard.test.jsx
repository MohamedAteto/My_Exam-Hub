import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import UnifiedDashboard from './UnifiedDashboard'
import api from '../api/axios'

vi.mock('../api/axios', () => ({
    default: { get: vi.fn() }
}))

vi.mock('./DashboardFilters', () => ({ default: () => null }))
vi.mock('./DashboardCards', () => ({ default: () => null }))
vi.mock('./DashboardLeaderboard', () => ({ default: () => null }))
vi.mock('./charts/StatsPieChart', () => ({ default: () => null }))
vi.mock('./charts/StatsLineChart', () => ({ default: () => null }))
vi.mock('./charts/StatsBarChart', () => ({ default: () => null }))
vi.mock('./DashboardCharts', () => ({ default: () => null }))
vi.mock('./LoadingSpinner', () => ({ default: () => null }))

describe('UnifiedDashboard', () => {
    it('shows unavailable grade data and skips grade-based requests when grades are empty', () => {
        render(<UnifiedDashboard userRole="Teacher" userId="7863" grades={[]} />)

        expect(screen.getByRole('status')).toHaveTextContent('Grade data is unavailable')
        expect(api.get).not.toHaveBeenCalled()
    })
})