export function getDashboardGrades(grades = []) {
  return grades;
}

export function getDashboardClasses(classes = [], grades = []) {
  const gradeIds = new Set(grades.map((grade) => String(grade.id ?? grade.Id)));
  return classes.filter((classItem) => gradeIds.has(String(classItem.gradeId ?? classItem.GradeId)));
}

export function filterDashboardExams(exams = [], filters = {}) {
  return exams.filter((exam) => {
    const examGradeId = exam.gradeId ?? exam.GradeId;
    if (filters.gradeId && String(examGradeId) !== String(filters.gradeId)) return false;

    const examSubjectId = exam.subjectId ?? exam.SubjectId;
    if (filters.subjectId && String(examSubjectId) !== String(filters.subjectId)) return false;

    if (filters.classId) {
      const rawClassIds = exam.classes ?? exam.Classes ?? exam.classIds ?? exam.ClassIds ?? [];
      const classIds = Array.isArray(rawClassIds) ? rawClassIds.map(String) : [];
      const legacyClassIds = String(exam.classId ?? exam.ClassId ?? '').split(/[,\[\]"\s]+/).filter(Boolean);
      if (!classIds.includes(String(filters.classId)) && !legacyClassIds.includes(String(filters.classId))) return false;
    }

    if (filters.startDate || filters.endDate) {
      const examDate = new Date(exam.startDate ?? exam.StartDate ?? exam.endDate ?? exam.EndDate ?? Number.NaN).getTime();
      if (!Number.isFinite(examDate)) return false;
      if (filters.startDate && examDate < new Date(filters.startDate).getTime()) return false;
      if (filters.endDate && examDate >= new Date(filters.endDate).getTime() + 60_000) return false;
    }

    return true;
  });
}
