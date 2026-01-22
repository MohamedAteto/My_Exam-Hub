import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'

export default function DashboardCharts({ dashboardData, userRole, selectedExamId = null, filters = {} }) {
    const roleNorm = String(userRole || '').toLowerCase()

    if (!dashboardData) return null

    // Filter data based on selected exam
    let filteredExamBreakdown = dashboardData.examBreakdown || []
    let filteredRecentExams = dashboardData.recentExams || []
    
    if (selectedExamId) {
        filteredExamBreakdown = filteredExamBreakdown.filter(exam => 
            String(exam.examId) === String(selectedExamId)
        )
        filteredRecentExams = filteredRecentExams.filter(exam => 
            String(exam.examId) === String(selectedExamId)
        )
    }

    // Prepare Pass vs Fail data - filter by selected exam if applicable
    let passPercentage = dashboardData.passPercentage || 0
    let failPercentage = dashboardData.failPercentage || 0
    
    if (selectedExamId && filteredExamBreakdown.length > 0) {
        const selectedExam = filteredExamBreakdown[0]
        passPercentage = selectedExam.passPercentage || 0
        failPercentage = selectedExam.failPercentage || 0
    }

    // Prepare Class Performance chart data (average scores)
    // When no exam selected: show average scores for all exams
    // When exam selected: show average score for that specific exam
    let lineChartData = []
    if (roleNorm === 'student') {
        // For students: show their performance trend
        lineChartData = filteredRecentExams.map(exam => ({
            Title: exam.title,
            StudentScore: exam.studentScore,
            AverageScore: exam.averageScore
        }))
    } else {
        // For teachers/admins: show class performance (average scores)
        if (selectedExamId && filteredExamBreakdown.length > 0) {
            // Show average score for the selected exam
            const selectedExam = filteredExamBreakdown[0]
            lineChartData = [{
                Title: selectedExam.examTitle || selectedExam.title || 'Selected Exam',
                AverageScore: selectedExam.averageScore || 0
            }]
        } else {
            // Show average scores for all exams (default behavior)
            lineChartData = (dashboardData.examBreakdown || []).map(exam => ({
                Title: exam.examTitle || exam.title,
                AverageScore: exam.averageScore || 0
            }))
        }
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
