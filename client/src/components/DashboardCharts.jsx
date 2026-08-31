import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'

function ChartSkeleton({ height }) {
    return (
        <div className="dash-card chart-card" style={{ minHeight: height }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.5rem' }}>
                <div className="dash-skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div style={{ flex: 1 }}>
                    <div className="dash-skeleton" style={{ height: 14, width: '45%', marginBottom: 8 }} />
                    <div className="dash-skeleton" style={{ height: 10, width: '70%' }} />
                </div>
            </div>
            <div className="dash-skeleton" style={{ flex: 1, minHeight: height - 140, borderRadius: 12 }} />
        </div>
    )
}

export default function DashboardCharts({ dashboardData, userRole, selectedExamId = null, loading = false }) {
    const roleNorm = String(userRole || '').toLowerCase()

    // Initial load: skeleton chart cards (visual only — no API change)
    if (loading && !dashboardData) {
        return (
            <div className="charts-grid">
                <ChartSkeleton height={420} />
                <ChartSkeleton height={420} />
                <ChartSkeleton height={360} />
            </div>
        )
    }

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
    // Pass/fail are complementary in the backend (fail = 100 - pass). Use them directly;
    // only derive from the score distribution when BOTH are absent.
    let displayPass = passPercentage
    let displayFail = failPercentage
    // If both pass and fail are missing, derive them from the score distribution.
    if (passPercentage === 0 && failPercentage === 0) {
        // Fallback: derive pass/fail from the score distribution. Pass threshold is
        // 50%, so "50-70%", "70-85%", "85-100%" are pass; "0-50%" is fail.
        const totalVal = dist.reduce((sum, d) => sum + (d.Value || 0), 0)
        if (totalVal > 0) {
            const passVal = dist
                .filter(d => d.Name.includes('50-70') || d.Name.includes('70-85') || d.Name.includes('85-100'))
                .reduce((sum, d) => sum + (d.Value || 0), 0)
            displayPass = Math.round((passVal / totalVal) * 100)
            displayFail = 100 - displayPass
        }
    } else {
        // Backend pass% + fail% are complementary; just guard the relationship.
        if (failPercentage === 0) displayFail = 100 - displayPass
        if (passPercentage === 0) displayPass = 100 - displayFail
    }

    let lineChartData = []
    if (roleNorm === 'student') {
        const recent = dashboardData.recentExams || []
        lineChartData = recent
            .map(exam => ({
                Title: exam.title || exam.Title || 'Exam',
                StudentScore: exam.studentScore || exam.StudentScore || 0,
                AverageScore: exam.averageScore || exam.AverageScore || 0
            }))
            .slice(-20)
    } else {
        // For teachers/admins: limit to latest 20 exams (approximate by taking last 20 entries)
        const breakdown = dashboardData.examBreakdown || []
        lineChartData = breakdown
            .map(exam => ({
                Title: exam.examTitle || exam.title || exam.Title || 'Exam',
                AverageScore: exam.averageScore || exam.AverageScore || 0
            }))
            .slice(-20)
    }

    // Prepare bar chart data (score distribution) - normalize field names
    const barChartData = dist.map(item => ({
        Name: item.Name,
        Value: item.Value
    }))
    // pass/fail and chart data are derived above from dashboardData (subject-filtered)

    // Layout: trend (wide) + donut | distribution (full width) — stacks on ≤1024px
    return (
        <div className="charts-grid">
            <StatsLineChart
                className="chart-card-line"
                data={lineChartData}
                title={roleNorm === 'student' ? "My Performance Trend" : "Class Performance (Average Score)"}
                userRole={roleNorm}
                selectedExamId={selectedExamId}
            />

            <StatsPieChart
                className="chart-card-pie"
                passPercentage={displayPass}
                failPercentage={displayFail}
                title="Pass vs Fail Overview"
            />

            <StatsBarChart
                className="chart-card-bar"
                data={barChartData}
                title="Score Distribution"
            />
        </div>
    )
}
