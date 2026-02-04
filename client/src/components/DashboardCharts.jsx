import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'

export default function DashboardCharts({ dashboardData, userRole, selectedExamId = null, filters = {} }) {
    const roleNorm = String(userRole || '').toLowerCase()

    if (!dashboardData) return null

    // Use data directly from dashboardData (backend now handles filtering by examId)
    const passPercentage = dashboardData.passPercentage || 0
    const failPercentage = dashboardData.failPercentage || 0

    let lineChartData = []
    if (roleNorm === 'student') {
        const recent = dashboardData.recentExams || []
        lineChartData = recent.map(exam => ({
            Title: exam.title,
            StudentScore: exam.studentScore,
            AverageScore: exam.averageScore
        }))
    } else {
        // For teachers/admins: show breakdown of exams (if filtered by one, only one shows)
        const breakdown = dashboardData.examBreakdown || []
        lineChartData = breakdown.map(exam => ({
            Title: exam.examTitle || exam.title,
            AverageScore: exam.averageScore || 0
        }))
    }

    // Prepare bar chart data (score distribution) - filter by selected exam if applicable
    // Note: Score distribution filtering by exam would ideally need backend support
    // For now, we'll use the filtered data if available
    const barChartData = (dashboardData.scoreDistribution || []).map(item => ({
        Name: item.name,
        Value: item.value
    }))

    console.log('[DashboardCharts] Dashboard data:', dashboardData)
    console.log('[DashboardCharts] Selected exam ID:', selectedExamId)
    console.log('[DashboardCharts] Filters:', filters)
    console.log('[DashboardCharts] Line chart data:', lineChartData)
    console.log('[DashboardCharts] Bar chart data:', barChartData)

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1.5rem',
            marginTop: '2rem'
        }}>
            <StatsPieChart
                passPercentage={passPercentage}
                failPercentage={failPercentage}
                title="Pass vs Fail Overview"
            />

            <StatsLineChart
                data={lineChartData}
                title={roleNorm === 'student' ? "My Performance Trend" : "Class Performance (Average Score)"}
                userRole={roleNorm}
                selectedExamId={selectedExamId}
            />

            <StatsBarChart
                data={barChartData}
                title="Score Distribution"
            />
        </div>
    )
}
