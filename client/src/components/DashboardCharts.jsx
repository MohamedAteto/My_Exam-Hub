import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'
import { getDashboardTrendData, normalizePassFailPercentages } from '../utils/dashboardMetrics'

export default function DashboardCharts({ dashboardData, userRole, selectedExamId = null, filters = {} }) {
    const roleNorm = String(userRole || '').toLowerCase()

    if (!dashboardData) return null

    // Use data directly from dashboardData (backend now handles filtering by examId)
    // Handle case-insensitive property access for PascalCase backend DTOs
    const getValue = (obj, ...keys) => {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
        }
        return null
    }

    const passPercentage = getValue(dashboardData, 'passPercentage', 'PassPercentage', 'averagePassPercentage', 'AveragePassPercentage', 'overallPassPercentage', 'OverallPassPercentage') || 0
    const failPercentage = getValue(dashboardData, 'failPercentage', 'FailPercentage', 'averageFailPercentage', 'AverageFailPercentage', 'overallFailPercentage', 'OverallFailPercentage') || 0

    // Build normalized score distribution (case-insensitive)
    const dist = (dashboardData.scoreDistribution || [])
        .map(d => ({ Name: d.Name || d.name || '', Value: d.Value !== undefined ? d.Value : d.value }))

    const { passPercentage: displayPass, failPercentage: displayFail } =
        normalizePassFailPercentages(passPercentage, failPercentage, dist)

    const lineChartData = getDashboardTrendData(dashboardData, roleNorm, selectedExamId)

    // Prepare bar chart data (score distribution) - normalize field names
    const hasDistributionResults = dist.some(item => Number(item.Value) > 0)
    const barChartData = (hasDistributionResults ? dist : []).map(item => ({
        Name: item.Name,
        Value: item.Value
    }))

    console.log('[DashboardCharts] Dashboard data:', dashboardData)
    console.log('[DashboardCharts] Selected exam ID:', selectedExamId)
    console.log('[DashboardCharts] Filters:', filters)
    console.log('[DashboardCharts] passPercentage:', passPercentage, 'failPercentage:', failPercentage)
    console.log('[DashboardCharts] Line chart data:', lineChartData)
    console.log('[DashboardCharts] Bar chart data:', barChartData)
    console.log('[DashboardCharts] displayPass:', displayPass, 'displayFail:', displayFail)

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem',
            marginTop: '2rem'
        }}>
            <div className="animate-card stagger-1">
                <StatsPieChart
                    passPercentage={displayPass}
                    failPercentage={displayFail}
                    title="Pass vs Fail Overview"
                />
            </div>

            <div className="animate-card stagger-2">
                <StatsLineChart
                    data={lineChartData}
                    title={roleNorm === 'student' ? "My Performance Trend" : "Class Performance (Average Score)"}
                    userRole={roleNorm}
                    selectedExamId={selectedExamId}
                />
            </div>

            <div className="animate-card stagger-3">
                <StatsBarChart
                    data={barChartData}
                    title="Score Distribution (Exam Results)"
                />
            </div>
        </div>
    )
}
