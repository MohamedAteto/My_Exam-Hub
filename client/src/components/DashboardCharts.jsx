import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'

export default function DashboardCharts({ dashboardData, userRole }) {
    const roleNorm = String(userRole || '').toLowerCase()

    // Prepare line chart data
    const lineChartData = roleNorm === 'teacher'
        ? (dashboardData?.examBreakdown || []).map(exam => ({
            Title: exam.examTitle || exam.title,
            AverageScore: exam.averageScore
        }))
        : (dashboardData?.recentExams || []).map(exam => ({
            Title: exam.title,
            StudentScore: exam.studentScore,
            AverageScore: exam.averageScore
        }))

    // Prepare bar chart data key mapping (API sends camelCase, Recharts expectation setup in component)
    const barChartData = (dashboardData?.scoreDistribution || []).map(item => ({
        Name: item.name,
        Value: item.value
    }))

    console.log('[DashboardCharts] Dashboard data:', dashboardData)
    console.log('[DashboardCharts] Line chart data:', lineChartData)
    console.log('[DashboardCharts] Bar chart data:', barChartData)

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
                data={barChartData}
                title="Score Distribution"
            />
        </div>
    )
}
