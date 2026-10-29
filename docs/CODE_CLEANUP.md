# Unused-code cleanup — October 29, 2026

The cleanup was limited to files and symbols without active application references. Active face verification, legacy database compatibility fields, tests, the attachment migration script, and deployment tooling were retained.

Removed files:

- `frontend/src/components/ui/BadgeItem.jsx`
- `frontend/src/components/ui/KpiCard.jsx`
- `frontend/src/components/ui/CompactStat.jsx`
- `frontend/src/components/ui/Timeline.jsx`
- `frontend/src/components/ui/ProgressRing.jsx`
- `frontend/src/__faceprobe.jsx`
- `frontend/__faceprobe.html`
- `frontend/tmp-faceprobe.cjs`
- `frontend/tmp-facee2e.cjs`
- `backend/tmp-face-seed.cjs`
- `backend/tmp-face-cleanup.cjs`

The five UI primitives were exported but never consumed. The six face-test files were temporary manual probes/seeding utilities, separate from the maintained automated tests. Recoverable originals are saved in the chat workspace under `work/unused-code-cleanup-backup/`.

Also removed eight unused UI barrel exports, four unused icon imports, and the unreferenced `notifyStaff` helper. Sparkline, breadcrumbs and command-palette components remain active through direct imports.

Validation: no broken frontend imports or unreachable application source modules; ESLint, frontend authentication checks, production build, and all 164 backend tests passed.


Archived 18 diagram documentation files outside the project: docs/diagrams/ (Draw.io output, page generators, preview and validation tools), docs/context-diagram.md, and docs/data-flow-diagram.md. No application, package script or deployment file referenced them. The originals remain recoverable in the chat workspace under work/archived-diagram-documents/.
