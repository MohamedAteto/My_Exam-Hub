import { describe, expect, it } from 'vitest';
import { getStudentAverageScore, getStudentExamCount } from './studentPerformance';

describe('student performance calculations', () => {
  it('keeps no attempts distinct from a zero score', () => {
    expect(getStudentAverageScore({ quizScores: {} })).toBeNull();
    expect(getStudentAverageScore({ quizScores: { 1: 0 } })).toBe(0);
  });

  it('calculates averages for selected exams only', () => {
    const student = { quizScores: { 1: 80, 2: 60, 3: 100 } };
    expect(getStudentAverageScore(student, ['1', '2'])).toBe(70);
  });

  it('counts only attempts in the selected exams', () => {
    const student = { quizScores: { 1: 0, 3: 90 } };
    expect(getStudentExamCount(student)).toBe(2);
    expect(getStudentExamCount(student, ['1', '2', '3'])).toBe(2);
  });
});