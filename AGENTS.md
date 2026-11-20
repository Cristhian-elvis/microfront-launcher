# Repository Guidelines

## Project Structure & Module Organization

The Node.js launcher API lives in `microfront-launcher-api/`: request handlers are in `handlers/`, orchestration services in `services/`, and shared configuration/runtime utilities in `lib/`. Runtime-only state belongs in `storage/`; local machine configuration is `data/config.json` and must not contain secrets.

The UI is the Angular application in `microfront-launcher/`. Keep feature pages in `src/app/features/`, shell/layout components in `src/app/layout/`, shared UI in `src/app/shared/`, and HTTP/state boundaries in `src/app/core/`.

## Build, Test, and Development Commands

- `npm start` (repository root): starts the API and Angular development server together.
- `npm run start:api` (repository root): starts only the Node API.
- `npm run start:web` (repository root): starts only Angular.
- `npm start` (from `microfront-launcher/`): starts Angular development server.
- `npm run build` (from `microfront-launcher/`): production Angular build; run after UI or TypeScript changes.
- `npm test` (from `microfront-launcher/`): runs Angular/Vitest unit tests.
- `npm --prefix microfront-launcher-api run check`: validates the API bootstrap without opening its HTTP port.
- `node --check microfront-launcher-api/server.js`: quick syntax check for backend changes. Check every edited API module similarly.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes in TypeScript, and the surrounding file’s style in JavaScript. Name Angular components as `*-page.component.ts` or `*-component.ts`; colocate their HTML/CSS files where present. Use standalone Angular components, `OnPush` change detection, signals/computed values for local state, and native `@if`/`@for` control flow. Keep API calls in core services rather than page templates.

Before building custom controls, check whether PrimeNG already provides the needed component and prefer it when it fits the interaction and accessibility requirements (for example, `p-button`, `p-dialog`, `p-select`, `p-table`, and `p-toast`). Use native HTML only when PrimeNG has no suitable component or semantic markup is the better fit.

Use Tailwind utility classes for straightforward layout, spacing, and responsive styling. When a utility list becomes long, repeated, or obscures the template’s structure, group it into a meaningful class in the component’s CSS file instead of leaving an oversized inline class string.

Use camelCase for variables/functions, PascalCase for classes/interfaces, and kebab-case for filenames. Preserve the existing Spanish user-facing copy unless a task asks for translation.

## Testing Guidelines

Add or update `*.spec.ts` tests beside the affected Angular unit when behavior changes. Test user-visible states: initial setup, bootstrap failures, and start/stop actions. There is no stated coverage threshold; do not lower existing coverage or skip a relevant build.

## Commit & Pull Request Guidelines

Recent history is inconsistent (`fix: ...`, `ref`, `new-version`). Prefer concise Conventional Commit-style subjects, e.g. `fix: validate published MOVA version`. Keep commits focused. PRs should describe behavior changes, list verification commands, link the issue when available, and include screenshots for UI changes.

## Configuration & Safety

Do not commit `data/config.json`, `storage/`, generated `dist/`, or machine paths. Validate configuration changes through `/api/bootstrap`; setup responses must stay minimal until initial setup is complete.
