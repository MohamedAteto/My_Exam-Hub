import { describe, expect, it } from 'vitest';
import { filterDashboardExams, getDashboardClasses, getDashboardGrades } from './dashboardOptions';

const grades = [
  { id: 1, gradeName: 'Junior' },
  { id: 2, gradeName: 'Wheeler' },
  { id: 3, gradeName: 'Senior' },
  { id: 4, gradeName: 'Graduate_2026' }
];

const classes = [
  { id: 11, gradeId: 1, className: 'J1' },
  { id: 12, gradeId: 1, className: 'J4' },
  { id: 21, gradeId: 2, className: 'W2' },
  { id: 31, gradeId: 3, className: 'S3' },
  { id: 41, gradeId: 4, className: 'G1' },
  { id: 42, gradeId: 1, className: 'Class_Trainees' }
];

describe('dashboard database options', () => {
  it('uses grade records returned by the database lookup without a frontend whitelist', () => {
    expect(getDashboardGrades(grades).map((grade) => grade.gradeName))
      .toEqual(['Junior', 'Wheeler', 'Senior', 'Graduate_2026']);
  });

  it('uses database class IDs and retains only classes attached to supplied grade IDs', () => {
    expect(getDashboardClasses(classes, grades).map((classItem) => classItem.className))
      .toEqual(['J1', 'J4', 'W2', 'S3', 'G1', 'Class_Trainees']);
  });

  it('filters exam options by combined DB filters and includes the selected end minute', () => {
    const exams = [
      { examId: 101, gradeId: 1, classIds: [11], subjectId: 8, startDate: '2026-09-30T10:30:59.999Z' },
      { examId: 102, gradeId: 1, classIds: [11], subjectId: 8, startDate: '2026-09-30T10:31:00.000Z' },
      { examId: 103, gradeId: 1, classIds: [11], subjectId: 9, startDate: '2026-09-30T10:30:00.000Z' },
      { examId: 104, gradeId: 2, classIds: [21], subjectId: 8, startDate: '2026-09-30T10:30:00.000Z' }
    ];

    expect(filterDashboardExams(exams, {
      gradeId: 1,
      classId: 11,
      subjectId: 8,
      startDate: '2026-09-30T09:00:00.000Z',
      endDate: '2026-09-30T10:30:00.000Z'
    }).map((exam) => exam.examId)).toEqual([101]);
  });
});
