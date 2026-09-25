import { describe, expect, it } from 'vitest';
import { getDashboardKpis, getDashboardTrendData, getPassFailFromScoreDistribution, normalizePassFailPercentages } from './dashboardMetrics';

describe('dashboard score distribution metrics', () => {
  it('uses the 50 percent passing threshold and all passing buckets', () => {
    expect(getPassFailFromScoreDistribution([
      { Name: '0-50%', Value: 2 },
      { Name: '50-70%', Value: 3 },
      { Name: '70-85%', Value: 1 },
      { Name: '85-100%', Value: 4 }
    ])).toEqual({ passPercentage: 80, failPercentage: 20 });
  });

  it('supports camel-case bucket properties', () => {
    expect(getPassFailFromScoreDistribution([
      { name: '0-50%', value: 1 },
      { name: '50-70%', value: 1 }
    ])).toEqual({ passPercentage: 50, failPercentage: 50 });
  });

  it('recognizes the explicit under-50 bucket label', () => {
    expect(getPassFailFromScoreDistribution([
      { name: '<50%', value: 1 },
      { name: '50-<70%', value: 3 }
    ])).toEqual({ passPercentage: 75, failPercentage: 25 });
  });

  it('returns zero percentages for no scored students', () => {
    expect(getPassFailFromScoreDistribution([])).toEqual({ passPercentage: 0, failPercentage: 0 });
  });

  it('derives the complement when one chart percentage is missing', () => {
    expect(normalizePassFailPercentages(65, 0)).toEqual({ passPercentage: 65, failPercentage: 35 });
    expect(normalizePassFailPercentages(0, 25)).toEqual({ passPercentage: 75, failPercentage: 25 });
  });

  it('normalizes inconsistent percentages and preserves an empty state', () => {
    expect(normalizePassFailPercentages(30, 30)).toEqual({ passPercentage: 50, failPercentage: 50 });
    expect(normalizePassFailPercentages(0, 0)).toEqual({ passPercentage: 0, failPercentage: 0 });
  });

  it('uses the backend aggregate average for All Exams', () => {
    expect(getDashboardKpis({
      totalExamsCreated: 2,
      averageScore: 75,
      averagePassPercentage: 75,
      scoreDistribution: [{ name: '<50%', value: 1 }, { name: '85-100%', value: 3 }]
    }, null, 'Teacher')).toEqual({
      totalExams: 2,
      averageScore: 75,
      passPercentage: 75,
      failPercentage: 25,
      hasResults: true
    });
  });

  it('uses the selected student exam score instead of the class average', () => {
    expect(getDashboardKpis({
      averageScore: 72,
      passPercentage: 60,
      failPercentage: 40,
      recentExams: [{ examId: 42, studentScore: 35, averageScore: 80 }]
    }, 42, 'Student')).toMatchObject({
      totalExams: 1,
      averageScore: 35,
      passPercentage: 0,
      failPercentage: 100,
      hasResults: true
    });
  });

  it('returns zero metrics for an empty dashboard result set', () => {
    expect(getDashboardKpis({ averageScore: 0, passPercentage: 0, scoreDistribution: [] }, null, 'Teacher'))
      .toMatchObject({ averageScore: 0, passPercentage: 0, failPercentage: 0, hasResults: false });
  });

  it('sorts chart data chronologically and limits Student selected-exam charts', () => {
    const data = {
      recentExams: [
        { examId: 2, title: 'Later', date: '2026-09-02T00:00:00Z', studentScore: 60, averageScore: 70 },
        { examId: 1, title: 'Earlier', date: '2026-09-01T00:00:00Z', studentScore: 40, averageScore: 50 }
      ]
    };

    expect(getDashboardTrendData(data, 'Student').map(point => point.Title)).toEqual(['Earlier', 'Later']);
    expect(getDashboardTrendData(data, 'Student', 2)).toEqual([
      { Title: 'Later', StudentScore: 60, AverageScore: 70 }
    ]);
  });

  it('omits exams with no scored participants from performance trends', () => {
    expect(getDashboardTrendData({ examBreakdown: [
      { examId: 1, examTitle: 'Empty', totalStudents: 0, averageScore: 0 },
      { examId: 2, examTitle: 'Scored', totalStudents: 1, averageScore: 75 }
    ] }, 'Teacher')).toEqual([
      { Title: 'Scored', StudentScore: 0, AverageScore: 75 }
    ]);
  });
});
