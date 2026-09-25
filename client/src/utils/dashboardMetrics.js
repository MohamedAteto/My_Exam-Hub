const FAILING_BUCKETS = new Set(['<50%', '0-50%', '0-50']);

const readNumber = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      const value = Number(source[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
};

const getExamId = (exam) => exam?.examId ?? exam?.ExamId ?? exam?.id ?? exam?.Id;

export function getDashboardKpis(data, selectedExamId = null, userRole = '', leaderboard = []) {
  const role = String(userRole || '').toLowerCase();
  const isStudent = role === 'student';
  const selectedExam = selectedExamId
    ? data?.examBreakdown?.find(exam => String(getExamId(exam)) === String(selectedExamId))
    : null;
  const selectedStudentExam = selectedExamId && isStudent
    ? data?.recentExams?.find(exam => String(getExamId(exam)) === String(selectedExamId))
    : null;

  let averageScore = 0;
  if (selectedStudentExam) {
    averageScore = Number(selectedStudentExam.studentScore ?? selectedStudentExam.StudentScore ?? 0);
  } else if (selectedExam) {
    averageScore = Number(selectedExam.averageScore ?? selectedExam.AverageScore ?? 0);
  } else {
    const apiAverage = readNumber(data, ['averageScore', 'AverageScore']);
    if (apiAverage !== null) {
      averageScore = apiAverage;
    } else if (isStudent && data?.recentExams?.length) {
      const scores = data.recentExams
        .map(exam => Number(exam.studentScore ?? exam.StudentScore))
        .filter(Number.isFinite);
      averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    } else if (data?.examBreakdown?.length) {
      const breakdown = data.examBreakdown;
      const totalParticipants = breakdown.reduce((sum, exam) => sum + Number(exam.totalStudents ?? exam.TotalStudents ?? 0), 0);
      averageScore = totalParticipants > 0
        ? breakdown.reduce((sum, exam) => sum + Number(exam.averageScore ?? exam.AverageScore ?? 0) * Number(exam.totalStudents ?? exam.TotalStudents ?? 0), 0) / totalParticipants
        : 0;
    }
  }

  let hasResults = false;
  if (selectedStudentExam) {
    hasResults = selectedStudentExam.studentScore != null || selectedStudentExam.StudentScore != null;
  } else if (selectedExam) {
    hasResults = Number(selectedExam.totalStudents ?? selectedExam.TotalStudents ?? 0) > 0;
  } else {
    hasResults = (data?.scoreDistribution || []).some(bucket => Number(bucket.Value ?? bucket.value ?? 0) > 0) ||
      Number(data?.totalExamsTaken ?? data?.TotalExamsTaken ?? data?.totalStudentsWhoTookExams ?? data?.TotalStudentsWhoTookExams ?? 0) > 0;
  }

  let passPercentage = 0;
  if (selectedStudentExam) {
    const score = Number(selectedStudentExam.studentScore ?? selectedStudentExam.StudentScore ?? 0);
    passPercentage = score >= 50 ? 100 : 0;
  } else if (selectedExam) {
    passPercentage = Number(selectedExam.passPercentage ?? selectedExam.PassPercentage ?? 0);
  } else {
    const apiPass = readNumber(data, ['passPercentage', 'PassPercentage', 'averagePassPercentage', 'AveragePassPercentage', 'overallPassPercentage', 'OverallPassPercentage']);
    passPercentage = apiPass ?? getPassFailFromScoreDistribution(data?.scoreDistribution || []).passPercentage;
  }
  passPercentage = Math.max(0, Math.min(100, passPercentage));
  const roundedPassPercentage = Math.round(passPercentage);

  const totalExams = selectedExamId ? 1 : Number(
    data?.totalExams ?? data?.TotalExams ?? data?.totalExamsTaken ?? data?.TotalExamsTaken ?? data?.totalExamsCreated ?? data?.TotalExamsCreated ?? 0
  );

  return {
    totalExams,
    averageScore: Number.isFinite(averageScore) ? averageScore : 0,
    passPercentage: roundedPassPercentage,
    failPercentage: hasResults ? 100 - roundedPassPercentage : 0,
    hasResults
  };
}

export function getDashboardTrendData(data, userRole = '', selectedExamId = null) {
  const isStudent = String(userRole || '').toLowerCase() === 'student';
  let exams = isStudent ? data?.recentExams || [] : data?.examBreakdown || [];
  if (selectedExamId) exams = exams.filter(exam => String(getExamId(exam)) === String(selectedExamId));
  exams = exams.filter(exam => isStudent
    ? (exam.studentScore ?? exam.StudentScore) != null
    : Number(exam.totalStudents ?? exam.TotalStudents ?? 0) > 0);

  return exams
    .map(exam => ({
      Title: exam.title ?? exam.Title ?? exam.examTitle ?? exam.ExamTitle ?? 'Exam',
      StudentScore: Number(exam.studentScore ?? exam.StudentScore ?? 0),
      AverageScore: Number(exam.averageScore ?? exam.AverageScore ?? 0),
      timestamp: new Date(exam.date ?? exam.Date ?? exam.examDate ?? exam.ExamDate ?? Number.NaN).getTime()
    }))
    .sort((left, right) => {
      const leftTime = Number.isFinite(left.timestamp) ? left.timestamp : 0;
      const rightTime = Number.isFinite(right.timestamp) ? right.timestamp : 0;
      return leftTime - rightTime;
    })
    .slice(-20)
    .map(({ timestamp, ...point }) => point);
}

export function getPassFailFromScoreDistribution(distribution = []) {
  const total = distribution.reduce((sum, bucket) => sum + Number(bucket.Value ?? bucket.value ?? 0), 0);
  if (total <= 0) return { passPercentage: 0, failPercentage: 0 };

  const failed = distribution
    .filter((bucket) => FAILING_BUCKETS.has(String(bucket.Name ?? bucket.name ?? '').trim()))
    .reduce((sum, bucket) => sum + Number(bucket.Value ?? bucket.value ?? 0), 0);
  const failPercentage = Math.round((failed / total) * 100);
  return { passPercentage: 100 - failPercentage, failPercentage };
}

export function normalizePassFailPercentages(passPercentage, failPercentage, distribution = []) {
  let pass = Number(passPercentage) || 0;
  let fail = Number(failPercentage) || 0;
  const total = pass + fail;

  if (total === 0) return getPassFailFromScoreDistribution(distribution);
  if (pass > 0 && fail === 0) return { passPercentage: pass, failPercentage: 100 - pass };
  if (fail > 0 && pass === 0) return { passPercentage: 100 - fail, failPercentage: fail };
  if (total !== 100) {
    pass = Math.round((pass / total) * 100);
    fail = 100 - pass;
  }

  return { passPercentage: pass, failPercentage: fail };
}
