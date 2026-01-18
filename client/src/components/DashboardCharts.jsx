import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'

export default function DashboardCharts({ dashboardData, userRole }) {
    const roleNorm = String(userRole || '').toLowerCase()

    // Prepare line chart data
    const lineChartData = roleNorm === 'teacher'
        ? (dashboardData?.examBreakdown || []).map(exam => ({
            Title: exam.examTitle,
            AverageScore: exam.averageScore
        }))
        : (dashboardData?.recentExams || [])

    console.log('[DashboardCharts] Dashboard data:', dashboardData)
    console.log('[DashboardCharts] Line chart data:', lineChartData)
    console.log('[DashboardCharts] Score distribution:', dashboardData?.scoreDistribution)

    if (!dashboardData) return null

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem',
            marginTop: '2rem'
        }}>
            <StatsPieChart
                passPercentage={dashboardData.passPercentage}
                failPercentage={dashboardData.failPercentage}
                title="Pass vs Fail Overview"
            />

            <StatsLineChart
                data={lineChartData}
                title={roleNorm === 'student' ? "My Performance Trend" : "Class Performance Trend"}
                userRole={roleNorm}
            />

            <StatsBarChart
                data={dashboardData.scoreDistribution || []}
                title="Score Distribution"
            />
        </div>
    )
}
