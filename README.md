# Surgery Qbank

Private mobile-first study platform for surgery multiple-choice review. The app is built with Next.js and presents a focused student workflow: practice questions, immediate answer feedback, clinical notes, flagged review, topic navigation, and progress tracking.

## Local Development

```bash
npm install
npm run extract:pdf
npm run dev
```

Open `http://localhost:3000`.

## Private Study Data

The full extracted qbank is generated locally into `data/private/surgery-qbank.json`, with figures in `public/study-assets/private/`. Those files are intentionally ignored by Git so the public repository contains the application, extraction tooling, and demo fallback, not the private study dataset.

## Verification

```bash
npm run check
```

This runs linting, full qbank validation when the private data file is present, a production build, and Playwright UI checks across mobile and desktop viewports.
