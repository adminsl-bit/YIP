# Yi Parliament Hub - Agent Source of Truth

Welcome, AI Agent! If you are working on this project, this file is your central source of truth. Please read and adhere to these guidelines strictly.

## 1. Project Context
This is the **Yi Parliament Hub**, an MVP SaaS application for managing regional and national rounds of the Young Indians Parliament. 

The application is built around three core user flows:
1.  **Student:** Event registration, profile setup, voting, and posting to the civic wall.
2.  **Organizer:** Administrative control over sessions, members, and event settings.
3.  **Jury:** Evaluation and judging tools.

You are expected to follow the `ship-saas-mvp` methodology: build fast, ensure robust functionality, and maintain high-fidelity design standards.

## 2. Design & UI Guidelines (Read `DESIGN.md`)
We have a highly specific and premium design system called **"The Civic Canvas."**
*   **Source of Truth:** You MUST read and follow `DESIGN.md` before creating or modifying any UI components.
*   **Key Rules:** 
    *   No 1px solid borders for sectioning. Use Tonal Layering.
    *   Use Glassmorphism for floating elements.
    *   Typography: *Plus Jakarta Sans* for headings, *Manrope* for body.
    *   Never use flat hex black `#000000` for text. Use `on-surface` or `on-background`.

## 3. Database & Backend Guidelines (Supabase)
This project uses **Supabase** for backend, authentication, and database services.

We have installed specialized Agent Skills to help you. Before making changes to the database schema, RLS policies, or authentication flow, you **MUST** refer to the installed skills in the `.agents/skills/` directory:
1.  **Supabase General Skill:** Guides you on auth, storage, and general Supabase client usage.
2.  **Postgres Best Practices:** Guides you on schema design, RLS (Row Level Security), and performance tuning.

*   Always ensure Row Level Security (RLS) is enabled and properly configured for all new tables.
*   Use the official `@supabase/supabase-js` client.

## 4. Development Workflow & Testing
1.  **Verify Before Building:** Before adding a new feature, verify if a similar component or database table already exists. Do not duplicate code.
2.  **Role-Based Access:** Always ensure that views and data access are strictly segregated by role (Student vs. Organizer vs. Jury).
3.  **Unit Testing (Mandatory):** 
    *   Write unit tests for all new business logic, utility functions, and complex UI components before considering a task complete.
    *   Ensure tests cover edge cases, particularly for permission checks and registration flows.
4.  **Self-Healing & Debugging:** 
    *   As an AI agent, you must **self-heal**. If a build fails, a test fails, or a linter throws an error, do not immediately stop and ask for help. 
    *   Read the error logs, diagnose the issue, apply the fix, and re-run the validation to ensure it passes.

## 5. Code Quality & Architecture
*   **Tech Stack:** React, TypeScript, and Vite.
*   **TypeScript Strictness:** Always use proper TypeScript types and interfaces. Avoid using `any`. If you are unsure of a type, define a strict interface for it.
*   **Atomic Commits:** If performing Git operations, ensure commits are atomic, logically grouped, and use descriptive conventional commit messages (e.g., `feat:`, `fix:`, `refactor:`).
*   **Context Gathering:** Always read the relevant existing files (especially types and shared utilities) using your tools before attempting to rewrite or modify complex logic.
