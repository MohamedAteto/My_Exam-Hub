export function getStudentAverageScore(student, selectedExamIds = []) {
  const scoresByExam = student?.quizScores || {};
  const scores = selectedExamIds.length > 0
    ? selectedExamIds.map((id) => scoresByExam[String(id)])
    : Object.values(scoresByExam);
  const validScores = scores.filter((score) => score !== null && score !== undefined && Number.isFinite(Number(score)));

  if (validScores.length === 0) return null;
  return Math.round(validScores.reduce((total, score) => total + Number(score), 0) / validScores.length);
}

export function getStudentExamCount(student, selectedExamIds = []) {
  const scoresByExam = student?.quizScores || {};
  if (selectedExamIds.length === 0) return Object.keys(scoresByExam).length;

  return selectedExamIds.filter((id) => scoresByExam[String(id)] !== null && scoresByExam[String(id)] !== undefined).length;
}