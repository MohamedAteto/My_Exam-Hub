---
kind: frontend_style
name: CSS-Only Red-Themed Design System with CSS Variables and Global Styles
category: frontend_style
scope:
    - '**'
source_files:
    - client/src/index.css
    - client/src/components/Sidebar.css
    - client/postcss.config.cjs
    - client/package.json
---

## Approach

The Exam-Hub React client uses a **plain CSS design system** built on CSS custom properties (variables), with no CSS-in-JS, no Tailwind, no component library styling framework. Styling is centralized in two files: `client/src/index.css` (global theme + shared UI primitives) and `client/src/components/Sidebar.css` (sidebar-specific overrides). Components reference these styles via class names; there are no inline style objects used for theming.

## Theme & Design Tokens

All visual tokens live in `:root` inside `index.css`:
- **Primary palette**: red-based (`--primary: #EF4444`, `--primary-hover: #DC2626`, `--primary-light: #FEF2F2`, `--primary-dark: #B91C1C`) — the brand accent is consistently applied to buttons, headers, badges, and active states.
- **Semantic colors**: `--success`, `--error`, `--warning`, `--info` each with light/background variants for status feedback.
- **Surface hierarchy**: `--bg-main`, `--bg-surface`, `--bg-surface-hover`, `--bg-elevated` define layered backgrounds.
- **Typography**: font stack defaults to `'Inter', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`.
- **Spacing**: `--spacing-xs` through `--spacing-xl` (0.25rem → 2rem).
- **Radius scale**: `--radius-sm` (8px) → `--radius-full` (9999px).
- **Shadows**: five-tier scale from `--shadow-xs` to `--shadow-2xl`.
- **Transitions**: three timing curves (`--transition-fast/base/slow`).

A second token set in `Sidebar.css` (`--primary-red`, `--bg-sidebar`, `--shadow-premium`) extends the palette specifically for the sidebar component.

## Architecture & File Organization

- **Global stylesheet** (`index.css`, ~3100 lines): defines the root variables, global reset, animations (`fadeIn`, `slideUp`, `popIn`, `shake`, `shimmer`, `pulse`), modal/overlay patterns, quiz interface styles, dashboard layout classes (`.dashboard-container`, `.main-content`, `.content-header`), and all reusable UI primitives (buttons, inputs, cards, tables, charts containers).
- **Component-scoped stylesheet** (`components/Sidebar.css`): encapsulates the navigation sidebar, hamburger menu, mobile overlay, and responsive breakpoints.
- **Per-component CSS modules**: none found — components use plain class names that resolve against the global stylesheet.
- **Empty `App.css`**: kept only as a placeholder to remove Vite/CRA demo styles.
- **PostCSS config** (`postcss.config.cjs`): empty plugins array — no autoprefixer or other transforms configured.

## Conventions Observed

1. **Class-name convention**: BEM-like flat class names (e.g., `.quiz-card`, `.mcq-option`, `.nav-item`, `.modal-overlay`) without nesting or module scoping.
2. **Token usage**: All colors, spacing, radii, and shadows are referenced via CSS variables rather than hardcoded hex values, except in a few legacy/hardcoded spots (e.g., `#dc2626`, `#1f2937` still appear alongside variable references).
3. **Responsive strategy**: Mobile-first media queries at `768px` / `769px` boundaries control sidebar visibility and main content margins; grid layouts use `auto-fill, minmax(300px, 1fr)` for adaptive card columns.
4. **Animation pattern**: Shared `@keyframes` in `index.css` plus utility classes like `.shimmer-effect`; transitions use the defined `--transition-*` variables.
5. **Iconography**: Icons come from the `lucide-react` package (no SVGs embedded in CSS); icons are styled via inline `width`/`height` props on `<svg>` elements.
6. **No CSS framework**: No Tailwind, Bootstrap, Material UI, or similar — the entire visual layer is hand-authored CSS.
7. **Modal/dialog pattern**: A consistent `.modal-overlay` + `.modal-content` structure with backdrop blur, `z-index: 10000`, and slide-up animation is reused across confirmations and quizzes.

## Constraints

- The project has no automated style linting beyond ESLint for JS/JSX (`eslint.config.js` targets JavaScript rules only); there is no stylelint configuration.
- There is no CSS-in-JS runtime dependency; all styling is static CSS loaded once at app bootstrap.
- The PostCSS pipeline is effectively disabled (empty plugin list), so no vendor prefixing or modern CSS features are transformed.