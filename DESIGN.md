# Design

## System Summary

The interface is a mobile-first academic study tool for surgery MCQs. It should feel like a quiet clinical study room: bright, legible, restrained, and efficient. Visual design serves comprehension, answer commitment, feedback, and topic navigation.

## Color

Color strategy: restrained product UI. The seed hue is green at 160 degrees, adapted into a clinical teal used sparingly for selection, primary actions, and progress. Backgrounds stay pure white to avoid the warm-paper AI default.

```css
:root {
  --bg: oklch(1 0 0);
  --surface: oklch(0.975 0.004 160);
  --surface-strong: oklch(0.945 0.012 160);
  --ink: oklch(0.205 0.025 235);
  --muted: oklch(0.455 0.022 235);
  --primary: oklch(0.49 0.105 160);
  --primary-strong: oklch(0.39 0.11 160);
  --accent: oklch(0.61 0.145 35);
  --success: oklch(0.48 0.12 150);
  --warning: oklch(0.72 0.14 80);
  --danger: oklch(0.56 0.16 25);
  --border: oklch(0.89 0.01 235);
  --focus: oklch(0.68 0.14 160);
}
```

## Typography

Use one UI family, preferably Geist Sans or system sans, with a tight product scale. Body copy should be 16px minimum on mobile, explanations 16-17px with comfortable line-height, and labels 12-14px. Use mono only for IDs, counts, or compact metadata.

## Layout

Mobile first. Use a persistent top study header, bottom navigation for the main sections, and a single-column question reader. Desktop can expand into a two-column layout with topic navigation on the left and the question session on the right. Avoid nested cards; repeated question rows may use simple bordered items.

## Components

- Study launcher with topic, mode, and progress summary.
- Question card with stem, optional figure, answer choices, and commit action.
- Feedback panel with correct answer, source explanation, external enrichment when present, and review controls.
- Topic browser with search and completion state.
- Review queue for missed and flagged questions.
- Statistics panel for accuracy, completed questions, and weak topics.

## Motion

Use short 150-200ms transitions for answer selection, feedback reveal, and navigation changes. Respect reduced motion. Do not gate content behind entrance animations.

## Interaction

Students must explicitly submit an answer before seeing the explanation. Correct and incorrect states require icon/text labels as well as color. Primary actions remain close to the thumb on mobile. The app should preserve progress locally and allow quick resume.
