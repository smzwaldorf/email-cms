# UX/UI Audit and Design System Proposal

## Scope

This audit focuses on the authentication entry point and shared admin styling patterns:

- `src/pages/LoginPage.tsx`
- `src/components/GoogleButton.tsx`
- `src/components/MagicLinkForm.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/pages/AdminDashboardPage.tsx`

## Executive Findings

### P0 - Consistency and trust gap on first-touch login

The login page used a visual language (gray/blue utility palette) that diverged from the Waldorf palette and elevation model used in admin pages. This made the first-touch experience feel like a separate product.

### P1 - Weak method hierarchy and context

Authentication methods were selectable but lacked supporting guidance. Users could choose a path without understanding speed, intent, or security implications.

### P1 - Accessibility and feedback polish gaps

Error messaging did not consistently announce as live status, and segmented controls lacked explicit pressed-state semantics.

### P2 - Missing system-level UI spec

The project had strong implementation detail but no single source of truth documenting component behavior, visual tokens, and acceptance criteria for consistent UI delivery.

## Design System Foundations (v0.1)

Leverage the existing Tailwind extension in `tailwind.config.ts` as source tokens.

### Color Roles

- `surface/base`: `waldorf-cream-50` to `waldorf-cream-100`
- `surface/card`: white with subtle cream border (`waldorf-cream-200`)
- `text/primary`: `waldorf-clay-800`
- `text/secondary`: `waldorf-clay-500`
- `action/primary`: gradient `waldorf-peach-500` -> `waldorf-peach-600`
- `action/primary-hover`: `waldorf-peach-600` -> `waldorf-peach-700`
- `feedback/error`: `waldorf-rose-50` with `waldorf-rose-200/700`
- `feedback/success`: `waldorf-sage-50` with `waldorf-sage-200/700`

### Typography

- Display headings: `font-display`, semibold
- Core UI copy: `font-sans`
- Information density:
  - Page title: `text-3xl` to `text-4xl`
  - Section heading: `text-lg` to `text-xl`
  - Body: `text-sm` to `text-base`
  - Helper text: `text-xs`

### Layout and Spacing

- Card radius: `rounded-2xl` or `rounded-3xl` for top-level shells
- Control radius: `rounded-lg`
- Vertical rhythm: 16 / 24 / 32 px (Tailwind 4 / 6 / 8 spacing steps)
- Max auth container width: `max-w-5xl` for desktop split layout

### Motion and Interaction

- Keep transitions short (150-200ms)
- Use color/elevation shifts for hover, avoid large transforms
- Use pressed state for segmented controls (`aria-pressed`)

## Implemented UI Spec (Login Flow)

### Auth Shell

- Desktop: two-panel layout (trust/benefit panel + auth controls)
- Mobile: single-panel auth card, no information loss for login controls
- Background: soft gradient and radial accents to match brand system

### Method Selection

- Segmented control replacing underline tabs
- Clear helper text under selector:
  - Password mode: account credentials path
  - Magic link mode: one-time email link path

### Form Controls

- Inputs use Waldorf border/focus styles
- Added `autoComplete` hints for email and password
- Unified primary CTA style with peach gradient

### Feedback and Accessibility

- Errors use semantic alert treatment with `role="alert"` and `aria-live="polite"`
- Method toggles expose state with `aria-pressed`
- Google button gets explicit loading-aware `aria-label`

## Engineering Acceptance Criteria

- Login view uses Waldorf token palette for all primary surfaces and actions
- Authentication method state is visually and semantically clear
- Error states are announced to assistive tech
- Existing auth behavior remains unchanged:
  - Password flow still redirects to latest published week
  - Magic link flow still supports cached redirect and explicit `redirectTo`
  - Dev quick-fill still works

## Next UI Work (Recommended)

1. Extract shared primitives (`Button`, `Input`, `Alert`, `SegmentedControl`) to reduce repeated class strings.
2. Standardize admin tab/navigation states with keyboard-visible focus rings.
3. Add Storybook or a docs-driven component gallery for visual regression review.
4. Add visual regression tests for login and admin dashboard key states.

## QA Checklist

- Verify keyboard-only login flow (Google button, tab switch, submit)
- Verify screen reader announcement of login errors
- Verify mobile and desktop spacing parity
- Verify quick-fill remains functional in development mode
- Verify loading and disabled states prevent duplicate submission
