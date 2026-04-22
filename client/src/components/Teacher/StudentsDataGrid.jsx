import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

// Import AG Grid styles - using Quartz theme for a more modern look
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import MultiSelectDropdown from '../MultiSelectDropdown'
import ModernSelect from '../ModernSelect'
import * as XLSX from 'xlsx'

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom Cell Renderers
const StudentInfoRenderer = (params) => {
    const student = params.data;
    if (!student) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', height: '100%' }}>
            <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.9rem',
                flexShrink: 0,
                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.2)'
            }}>
                {student.initials || (student.name ? student.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??')}
            </div>
            <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ 
                    fontWeight: 600, 
                    color: '#111827', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    fontSize: '0.95rem'
                }}>
                    {student.name}
                </div>
                <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: '#10b981' 
                    }}></span>
                    ID: {student.id}
                </div>
            </div>
        </div>
    );
};

const GradeClassRenderer = (params) => {
    const student = params.data;
    if (!student) return null;
    
    const hasGrade = student.grade && student.grade !== 'N/A';
    const hasClass = student.class && student.class !== 'N/A';

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', height: '100%' }}>
            {hasGrade ? (
                <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid #fee2e2',
                    whiteSpace: 'nowrap'
                }}>
                    {student.grade}
                </span>
            ) : (
                <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic', background: '#f9fafb', padding: '4px 8px', borderRadius: '6px' }}>No Grade</span>
            )}
            {hasClass ? (
                <span style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#fff5f5',
                    color: '#991b1b',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid #fed7d7',
                    whiteSpace: 'nowrap'
                }}>
                    Class {student.class}
                </span>
            ) : (
                <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic', background: '#f9fafb', padding: '4px 8px', borderRadius: '6px' }}>No Class</span>
            )}
        </div>
    );
};

const PerformanceRenderer = (params) => {
    const student = params.data;
    if (!student) return null;
    
    const scores = Object.values(student.quizScores || {});
    const avgScore = scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const examsCount = scores.length;

    return (
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', height: '100%' }}>
            <div style={{ minWidth: '45px' }}>
                <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 700, 
                    color: avgScore >= 75 ? '#059669' : avgScore >= 50 ? '#d97706' : '#dc2626',
                    lineHeight: '1'
                }}>
                    {avgScore}%
                </div>
                <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Avg</div>
            </div>
            <div style={{ height: '24px', width: '1px', background: '#e5e7eb' }}></div>
            <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4b5563', lineHeight: '1' }}>{examsCount}</div>
                <div style={{ fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Exams</div>
            </div>
        </div>
    );
};

const ExamScoreRenderer = (params) => {
    const score = params.value;
    if (score === null || score === undefined) {
        return (
            <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '100%' }}>
                Not Taken
            </div>
        );
    }
    
    const color = score >= 85 ? '#059669' : score >= 50 ? '#2563eb' : '#dc2626';
    const bg = score >= 85 ? '#ecfdf5' : score >= 50 ? '#eff6ff' : '#fef2f2';
    const border = score >= 85 ? '#10b98133' : score >= 50 ? '#3b82f633' : '#ef444433';

    return (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <div style={{
                padding: '4px 12px',
                borderRadius: '8px',
                background: bg,
                color: color,
                fontWeight: 700,
                fontSize: '0.85rem',
                border: `1px solid ${border}`,
                minWidth: '55px',
                textAlign: 'center'
            }}>
                {score}%
            </div>
        </div>
    );
};

const ActionRenderer = (params) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <button
                onClick={() => params.context.onStudentClick(params.data.id)}
                style={{
                    padding: '8px 16px',
                    background: '#fff',
                    border: '1.5px solid #fee2e2',
                    borderRadius: '10px',
                    color: '#dc2626',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.05)'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#dc2626';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#fee2e2';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.05)';
                }}
            >
                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
                View Profile
            </button>
        </div>
    );
};

export default function StudentsDataGrid({ students = [], allExams = [], initialExamId, initialGrade, onStudentClick }) {
    console.log('📊 StudentsDataGrid Props:', { 
        studentsCount: students?.length, 
        allExamsCount: allExams?.length, 
        initialExamId, 
        initialGrade 
    });

    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGrade, setSelectedGrade] = useState(initialGrade === 'N/A' ? '' : (initialGrade || ''))
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedExamIds, setSelectedExamIds] = useState(initialExamId ? [String(initialExamId)] : [])
    const [minScore, setMinScore] = useState(0)
    const [maxScore, setMaxScore] = useState(100)
    const gridRef = useRef();

    // Sync state with prop if it changes
    useEffect(() => {
        if (initialExamId !== undefined) {
            setSelectedExamIds(initialExamId ? [String(initialExamId)] : [])
        }
        if (initialGrade !== undefined) {
            setSelectedGrade(initialGrade === 'N/A' ? '' : initialGrade)
        }
    }, [initialExamId, initialGrade])

    // Get unique Grades and Classes for filters
    const grades = useMemo(() => {
        if (!students || !Array.isArray(students)) return [];
        const uniqueGrades = [...new Set(students.map(s => s.grade).filter(g => g && g !== 'N/A' && g !== 'n/a' && g !== 'None' && g !== 'null'))];
        
        // Custom sort order: Junior, Wheeler, Senior
        const sortOrder = { 'Junior': 1, 'Wheeler': 2, 'Senior': 3 };
        return uniqueGrades.sort((a, b) => (sortOrder[a] || 99) - (sortOrder[b] || 99));
    }, [students])

    const classes = useMemo(() => {
        if (!students || !Array.isArray(students)) return [];
        let filtered = students
        if (selectedGrade && selectedGrade !== 'all') {
            filtered = filtered.filter(s => s.grade === selectedGrade)
        }
        const uniqueClasses = [...new Set(filtered.map(s => s.class).filter(c => c && c !== 'N/A' && c !== 'n/a' && c !== 'None' && c !== 'null'))].sort()
        return uniqueClasses;
    }, [students, selectedGrade])

    // Column Definitions
    const columnDefs = useMemo(() => {
        const baseDefs = [
            {
                headerName: 'Student',
                field: 'name',
                cellRenderer: StudentInfoRenderer,
                pinned: 'left',
                minWidth: 250,
                flex: 1.5,
                sortable: true,
                filter: 'agTextColumnFilter',
                headerClass: 'red-header'
            },
            {
                headerName: 'Grade & Class',
                field: 'grade',
                cellRenderer: GradeClassRenderer,
                width: 180,
                sortable: true,
                comparator: (valueA, valueB) => {
                    const sortOrder = { 'Junior': 1, 'Wheeler': 2, 'Senior': 3 };
                    const a = sortOrder[valueA] || 99;
                    const b = sortOrder[valueB] || 99;
                    return a - b;
                },
                filter: 'agTextColumnFilter',
                filterParams: {
                    filterOptions: ['contains', 'notContains', 'equals', 'notEqual'],
                    textCustomComparator: (filter, value, filterText) => {
                        if (value === 'N/A') return false;
                        return value.toLowerCase().includes(filterText.toLowerCase());
                    }
                }
            },
            {
                headerName: 'Performance',
                field: 'avgScore',
                cellRenderer: PerformanceRenderer,
                width: 200,
                sortable: true,
                filter: 'agNumberColumnFilter',
                valueGetter: (params) => {
                    const scores = Object.values(params.data.quizScores || {});
                    return scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                }
            }
        ];

        // Dynamic columns for selected exams
        const examCols = allExams
            .filter(e => selectedExamIds.includes(String(e.id || e.examId)))
            .map(exam => ({
                headerName: exam.title,
                field: `quizScores.${exam.id || exam.examId}`,
                cellRenderer: ExamScoreRenderer,
                width: 150,
                sortable: true,
                filter: 'agNumberColumnFilter',
                valueGetter: (params) => {
                    const score = params.data.quizScores?.[String(exam.id || exam.examId)];
                    return score !== undefined ? score : null;
                }
            }));

        return [
            ...baseDefs,
            ...examCols,
            {
                headerName: 'Actions',
                cellRenderer: ActionRenderer,
                width: 140,
                pinned: 'right',
                sortable: false,
                filter: false
            }
        ];
    }, [allExams, selectedExamIds]);

    // Data filtering for AG Grid
    const rowData = useMemo(() => {
        if (!students || !Array.isArray(students)) {
            return [];
        }
        
        const filtered = students.filter(student => {
            const searchLower = searchQuery.toLowerCase().trim();
            const studentName = (student.name || '').toLowerCase();
            const studentEmail = (student.email || '').toLowerCase();
            const matchSearch = studentName.includes(searchLower) || studentEmail.includes(searchLower);
            
            if (!matchSearch) return false;
            
            if (selectedGrade && selectedGrade !== 'all' && student.grade !== selectedGrade) return false;
            if (selectedClass && selectedClass !== 'all' && student.class !== selectedClass) return false;

            const scores = Object.values(student.quizScores || {});
            const avg = scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

            if (selectedExamIds.length > 0) {
                const selectedScores = selectedExamIds
                    .map(id => student.quizScores?.[String(id)])
                    .filter(s => s !== undefined && s !== null);
                
                if (selectedScores.length > 0) {
                    const inRange = selectedScores.some(s => s >= minScore && s <= maxScore);
                    if (!inRange) return false;
                } else if (minScore > 0) {
                    return false;
                }
            } else if (avg < minScore || avg > maxScore) {
                return false;
            }

            return true;
        });

        return filtered;
    }, [students, searchQuery, selectedGrade, selectedClass, minScore, maxScore, selectedExamIds]);

    const handleExport = () => {
        if (!rowData || rowData.length === 0) {
            alert("No students to export based on current filters.");
            return;
        }

        const exportData = rowData.map(student => {
            const scores = Object.values(student.quizScores || {});
            const avg = scores.length === 0 ? 0 : Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            
            const row = {
                "Student Name": student.name,
                "ID": student.id,
                "Grade": student.grade || 'Unassigned',
                "Class": student.class || 'Unassigned',
                "Average Score": avg + '%',
                "Exams Taken": scores.length
            };

            const selectedExams = allExams.filter(e => selectedExamIds.includes(String(e.id || e.examId)));
            selectedExams.forEach(exam => {
                const score = student.quizScores?.[String(exam.id || exam.examId)];
                row[exam.title] = score !== undefined ? score + '%' : 'Not Taken';
            });

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

        let filename = "students_export";
        if (selectedClass && selectedClass !== 'all') filename += `_class-${selectedClass}`;
        const date = new Date().toISOString().split('T')[0];
        filename += `_${date}.xlsx`;

        XLSX.writeFile(workbook, filename);
    };

    const gridOptions = {
        context: { onStudentClick },
        rowHeight: 68,
        headerHeight: 52,
        pagination: true,
        paginationPageSize: 10,
        paginationPageSizeSelector: [10, 20, 50, 100],
        animateRows: true,
        enableCellTextSelection: true,
        suppressRowClickSelection: true,
        rowSelection: { 
            mode: 'multiRow',
            headerCheckbox: true,
        },
        defaultColDef: {
            resizable: true,
            sortable: true,
            filter: true,
            floatingFilter: false,
            flex: 1,
            minWidth: 100
        },
        onGridReady: (params) => {
            params.api.sizeColumnsToFit();
        },
        overlayLoadingTemplate: '<span class="ag-overlay-loading-center">Loading Students...</span>',
        overlayNoRowsTemplate: '<div style="padding: 20px; text-align: center; color: #6b7280;">No students found matching your criteria</div>'
    };

    return (
        <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <style>{`
                .ag-theme-quartz {
                    --ag-border-radius: 16px;
                    --ag-header-height: 52px;
                    --ag-row-height: 68px;
                    --ag-font-size: 14px;
                    --ag-font-family: 'Inter', sans-serif;
                    --ag-grid-size: 8px;
                    --ag-primary-color: #dc2626;
                    --ag-row-hover-color: #fef2f2;
                    --ag-selected-row-background-color: #fee2e2;
                    --ag-header-background-color: #ffffff;
                    --ag-header-foreground-color: #475569;
                    --ag-border-color: #e5e7eb;
                    --ag-input-focus-border-color: #dc2626;
                }
                .ag-header-cell-label {
                    font-weight: 700 !important;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-size: 0.75rem;
                }
                .ag-row {
                    border-bottom-color: #f1f5f9 !important;
                    transition: all 0.2s ease;
                }
                .ag-row-hover {
                    background-color: #fef2f2 !important;
                    transform: translateX(4px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .ag-cell {
                    display: flex;
                    align-items: center;
                }
                .red-header .ag-header-cell-label {
                    color: #dc2626;
                }
                .ag-paging-panel {
                    border-top: 1px solid #f1f5f9;
                    height: 50px;
                }
            `}</style>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: '#1f2937', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', letterSpacing: '-0.025em' }}>
                            <div style={{ background: '#dc2626', padding: '0.6rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)' }}>
                                <svg style={{ width: '28px', height: '28px', color: 'white' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                            Students Database
                        </h1>
                        <p style={{ fontSize: '1.1rem', color: '#6b7280', margin: 0, fontWeight: 500 }}>
                            Manage and analyze student performance across all exams
                        </p>
                    </div>

                    <button
                        onClick={handleExport}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.85rem 1.75rem',
                            background: 'white',
                            color: '#dc2626',
                            border: '2px solid #dc2626',
                            borderRadius: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            fontSize: '0.95rem'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = '#dc2626';
                            e.currentTarget.style.color = 'white';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.2)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#dc2626';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.08)';
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }} viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export Students Data
                    </button>
                </div>

                {/* Filters Bar */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                    marginBottom: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    border: '2px solid #e5e7eb',
                    position: 'relative',
                    zIndex: 10
                }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: '1 1 250px', position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Search Students</label>
                            <div style={{ position: 'relative' }}>
                                <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#9ca3af' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search by name, email or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '0.75rem 1rem 0.75rem 2.75rem', 
                                        border: '1.5px solid #e5e7eb', 
                                        borderRadius: '10px', 
                                        fontSize: '0.95rem',
                                        outline: 'none',
                                        transition: 'all 0.2s',
                                        background: '#f9fafb'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#dc2626';
                                        e.target.style.background = '#fff';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e5e7eb';
                                        e.target.style.background = '#f9fafb';
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ width: '180px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Grade</label>
                            <ModernSelect
                                options={[{ value: 'all', label: 'All Grades' }, ...grades.map(g => ({ value: g, label: g }))]}
                                value={selectedGrade || 'all'}
                                onChange={(e) => { 
                                    const val = e.target.value;
                                    setSelectedGrade(val === 'all' ? '' : val); 
                                    setSelectedClass(''); 
                                }}
                            />
                        </div>

                        <div style={{ width: '180px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Class</label>
                            <ModernSelect
                                options={[{ value: 'all', label: 'All Classes' }, ...classes.map(c => ({ value: c, label: `Class ${c}` }))]}
                                value={selectedClass || 'all'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedClass(val === 'all' ? '' : val);
                                }}
                                disabled={!selectedGrade || selectedGrade === 'all'}
                            />
                        </div>

                        <div style={{ flex: '1 1 250px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Filter by Exams</label>
                            <MultiSelectDropdown
                                options={allExams.map(e => ({ id: e.id || e.examId, title: e.title }))}
                                selectedIds={selectedExamIds}
                                onChange={setSelectedExamIds}
                                placeholder="Select Exams to Compare..."
                            />
                        </div>
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        gap: '2rem', 
                        padding: '1.25rem', 
                        background: '#fef2f2', 
                        borderRadius: '12px',
                        border: '1.5px solid #fee2e2',
                        alignItems: 'center'
                    }}>
                        <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                            </svg>
                            Score Range Filter:
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>Min Score: {minScore}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={minScore}
                                    onChange={(e) => setMinScore(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>Max Score: {maxScore}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={maxScore}
                                    onChange={(e) => setMaxScore(parseInt(e.target.value))}
                                    style={{ width: '100%', accentColor: '#dc2626', cursor: 'pointer' }}
                                />
                            </div>
                        </div>
                        <button 
                            onClick={() => { setMinScore(0); setMaxScore(100); }}
                            style={{
                                padding: '0.5rem 1.25rem',
                                background: 'white',
                                border: '1.5px solid #fee2e2',
                                borderRadius: '10px',
                                color: '#dc2626',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'white'; }}
                        >
                            Reset Range
                        </button>
                    </div>
                </div>

                {/* AG Grid Container with Card Styling */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                    border: '2px solid #e5e7eb',
                    height: 'calc(100vh - 420px)',
                    minHeight: '550px',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
                        <AgGridReact
                            ref={gridRef}
                            rowData={rowData}
                            columnDefs={columnDefs}
                            quickFilterText={searchQuery}
                            {...gridOptions}
                        />
                    </div>
                </div>

                <div style={{ padding: '1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#6b7280', fontSize: '0.9rem', fontWeight: '600' }}>
                    <div>Showing {rowData.length} of {students.length} students</div>
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#059669' }}></div> High Performance</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2563eb' }}></div> Average</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626' }}></div> Attention Needed</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
