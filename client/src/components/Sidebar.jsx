import { useState, useEffect } from "react";
import {
  BarChart3,
  User,
  FileText,
  LogOut,
  Settings,
  Users,
  TrendingUp,
  ScrollText,
  PlusCircle,
  ArrowRight,
  ArrowDown,
  Eye,
  CalendarCheck,
  PartyPopper,
  Shield,
  Menu,
  X,
  PlusSquare,
  ListTodo,
  Database,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { isStudent, isTeacher, isSuperAdmin } from "../utils/roleUtils";
import "./Sidebar.css";

const COLLAPSE_KEY = "sidebar_collapsed";

const Sidebar = ({
  currentSection,
  showSection,
  handleLogout,
  userRole,
  isExamActive,
  availableExamsCount
}) => {
  const [isOpen, setIsOpen] = useState(window.innerWidth > 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });

  // Presentation only: expand/collapse the desktop sidebar
  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  // Close sidebar when clicking on a nav item on mobile
  const handleNavClick = (section) => {
    if (isExamActive) return; // Prevent navigation during exam
    showSection(section);
    if (windowWidth <= 768) {
      setIsOpen(false);
    }
  };

  // Handle responsiveness
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const role = userRole ? userRole.toLowerCase() : '';
  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'board';
  const collapsed = windowWidth > 768 && isCollapsed;

  return (
    <>
      {/* Mobile Overlay */}
      {windowWidth <= 768 && isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}

      {/* Hamburger Menu Button */}
      <button
        className="hamburger-menu"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle sidebar"
        style={{ display: windowWidth <= 768 ? 'flex' : 'none' }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`sidebar ${isOpen ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon-wrapper">
              <img
                src="/logo.png"
                className="logo-img"
                alt="Exams Hub Logo"
              />
            </div>
            <div className="logo-text">
              <span className="brand-name">Exams <span className="highlight">Hub</span></span>
              <span className="brand-tagline">Academic Excellence</span>
            </div>
          </div>

          {/* Collapse toggle — top header row, beside the logo/brand (desktop only) */}
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Menu</div>
          {/* Dashboard - Always 'main' for Teacher/Admin, 'dashboard' for Student */}
          <div
            className={`nav-item ${(currentSection === 'main' || currentSection === 'dashboard') ? 'active' : ''}`}
            onClick={() => handleNavClick(isStudent ? 'dashboard' : 'main')}
            data-label="Dashboard"
          >
            <div className="nav-item-content">
              <BarChart3 size={20} />
              <span>Dashboard</span>
            </div>
          </div>

          {/* Student Specific */}
          {isStudent && (
            <>
              <div
                className={`nav-item ${currentSection === 'available' ? 'active' : ''}`}
                onClick={() => handleNavClick('available')}
                data-label="Available Exams"
              >
                <div className="nav-item-content">
                  <ScrollText size={20} />
                  <span>Available Exams</span>
                </div>
                {availableExamsCount > 0 && (
                  <span className="count-badge">{availableExamsCount}</span>
                )}
              </div>
              <div
                className={`nav-item ${currentSection === 'completed' ? 'active' : ''}`}
                onClick={() => handleNavClick('completed')}
                data-label="Completed Exams"
              >
                <div className="nav-item-content">
                  <CalendarCheck size={20} />
                  <span>Completed Exams</span>
                </div>
              </div>
            </>
          )}

          {/* Teacher Specific */}
          {isTeacher && (
            <>
              <div className="nav-section-label">Teaching</div>
              <div
                className={`nav-item ${currentSection === 'my-quizzes' ? 'active' : ''}`}
                onClick={() => handleNavClick('my-quizzes')}
                data-label="Manage Exams"
              >
                <div className="nav-item-content">
                  <ListTodo size={20} />
                  <span>Manage Exams</span>
                </div>
              </div>
              <div
                className={`nav-item ${currentSection === 'question-banks' ? 'active' : ''}`}
                onClick={() => handleNavClick('question-banks')}
                data-label="Question Banks"
              >
                <div className="nav-item-content">
                  <Database size={20} />
                  <span>Question Banks</span>
                </div>
              </div>
              <div
                className={`nav-item ${currentSection === 'students' ? 'active' : ''}`}
                onClick={() => handleNavClick('students')}
                data-label="Students"
              >
                <div className="nav-item-content">
                  <Users size={20} />
                  <span>Students</span>
                </div>
              </div>
            </>
          )}

          {/* Admin Specific */}
          {isAdmin && (
            <>
              <div className="nav-section-label">Administration</div>
              <div
                className={`nav-item ${currentSection === 'my-quizzes' ? 'active' : ''}`}
                onClick={() => handleNavClick('my-quizzes')}
                data-label="All Exams"
              >
                <div className="nav-item-content">
                  <ListTodo size={20} />
                  <span>All Exams</span>
                </div>
              </div>
              <div
                className={`nav-item ${currentSection === 'teachers' ? 'active' : ''}`}
                onClick={() => handleNavClick('teachers')}
                data-label="Teachers"
              >
                <div className="nav-item-content">
                  <Shield size={20} />
                  <span>Teachers</span>
                </div>
              </div>
              <div
                className={`nav-item ${currentSection === 'students' ? 'active' : ''}`}
                onClick={() => handleNavClick('students')}
                data-label="Students"
              >
                <div className="nav-item-content">
                  <Users size={20} />
                  <span>Students</span>
                </div>
              </div>
            </>
          )}

        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
