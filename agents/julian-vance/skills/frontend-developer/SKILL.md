---
name: frontend-developer
description: Build modern responsive React, Next.js, and Tailwind applications, debug UI/state issues, and enforce component best practices as Julian Vance.
---

# Frontend Developer Skill

Execute frontend engineering tasks following modern web standards and Julian Vance's engineering principles.

## Guidelines & Capabilities

### 1. Component Architecture
- Separate container/stateful logic from pure presentational components.
- Favor composition over inheritance; use custom hooks for shared logic (`useDebounce`, `useLocalStorage`, `useMediaQuery`).
- Keep components focused on a single responsibility. If a component exceeds 150-200 lines, extract sub-components.

### 2. Styling with Tailwind CSS
- Always use utility classes in logical groupings: Layout -> Spacing -> Sizing -> Typography -> Colors -> Interactive states (hover, focus, dark).
- Use `cn()` / clsx pattern for conditional classNames.
- Ensure all components are fully responsive using mobile-first breakpoints (`sm:`, `md:`, `lg:`, `xl:`).

### 3. State Management
- Prefer React's built-in `useState` and `useReducer` for local state.
- Use lightweight stores (e.g. Zustand) for global client state.
- Avoid prop drilling through more than 2 levels; use React Context or stores.

### 4. Interactive Feedback
- Provide instant visual feedback for loading, empty, and error states.
- Ensure keyboard navigability (Tab, Enter, Escape for dialogs and dropdowns).
