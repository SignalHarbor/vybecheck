<wizard-report>
# PostHog post-wizard report

The wizard completed a frontend analytics pass on VybeCheck. The project already had strong PostHog coverage; this run fixed critical configuration issues and filled in four missing events.

**Key changes:**

- **`src/frontend/utils/analytics.ts`** — Removed the hardcoded fallback token (`|| 'phc_...'`); key is now read exclusively from `VITE_POSTHOG_KEY`. Changed `capture_pageview` from `true` to `false` to avoid double-counting the initial pageview (the app manually tracks `$pageview` on every tab change in App.tsx).
- **`.env`** — Fixed `VITE_POSTHOG_KEY` (typo: was `hc_` prefix, now correctly `phc_`). Filled in `POSTHOG_KEY` server-side (was placeholder `phc_...`).
- **`src/frontend/App.tsx`** — Added `session_started` and `session_terminated` capture calls in the WebSocket message handler.
- **`src/frontend/pages/LobbyPage.tsx`** — Added analytics import and `session_link_copied` / `session_link_shared` capture calls.

## Event inventory

| Event | Description | File |
|---|---|---|
| `$pageview` | Tab navigation (SPA page views) | `src/frontend/App.tsx` |
| `sign_in_initiated` | User taps "Sign in with Twitter" | `src/frontend/store/authStore.ts` |
| `sign_in_completed` | OAuth callback succeeds; also calls `posthog.identify()` | `src/frontend/store/authStore.ts` |
| `sign_in_failed` | OAuth flow throws an error | `src/frontend/store/authStore.ts` |
| `signed_out` | User signs out; also calls `posthog.reset()` | `src/frontend/store/authStore.ts` |
| `session_created` | Host successfully creates a new session | `src/frontend/App.tsx` |
| `session_joined` | Participant or host joins an existing session | `src/frontend/App.tsx` |
| `session_started` | ✨ **New** — Host starts the quiz | `src/frontend/App.tsx` |
| `session_terminated` | ✨ **New** — Session is terminated by the host | `src/frontend/App.tsx` |
| `session_results_released` | Host releases match results to participants | `src/frontend/App.tsx` |
| `session_link_copied` | ✨ **New** — Host copies the join link to clipboard | `src/frontend/pages/LobbyPage.tsx` |
| `session_link_shared` | ✨ **New** — Host shares the join link via native share or clipboard | `src/frontend/pages/LobbyPage.tsx` |
| `question_added` | Owner adds a question to their draft set | `src/frontend/pages/LabPage.tsx` |
| `questions_published` | Owner publishes draft questions to an active session | `src/frontend/pages/LabPage.tsx` |
| `question_limit_upgrade_initiated` | Owner initiates the question-limit upgrade | `src/frontend/pages/LabPage.tsx` |
| `ai_generation_requested` | Owner uploads audio for AI question generation | `src/frontend/pages/LabPage.tsx` |
| `ai_generation_completed` | AI successfully generates questions from audio | `src/frontend/pages/LabPage.tsx` |
| `response_submitted` | Participant submits an answer to a question | `src/frontend/pages/QuizPage.tsx` |
| `quiz_completed` | Participant answers all questions in the session | `src/frontend/pages/QuizPage.tsx` |
| `matches_viewed` | User views an already-unlocked match tier | `src/frontend/pages/QuizPage.tsx` |
| `match_unlock_attempted` | User taps a locked match tier button | `src/frontend/pages/QuizPage.tsx` |
| `matches_unlocked` | Match results arrive for a paid tier | `src/frontend/App.tsx` |
| `purchase_flow_started` | User initiates a Vybes pack purchase | `src/frontend/pages/VybesPage.tsx` |
| `purchase_completed_client` | Stripe payment verified; Vybes credited | `src/frontend/pages/PurchaseSuccess.tsx` |
| `onboarding_started` | First-time onboarding overlay appears | `src/frontend/pages/OnboardingPage.tsx` |
| `onboarding_step_viewed` | User views a specific onboarding slide | `src/frontend/pages/OnboardingPage.tsx` |
| `onboarding_completed` | User finishes the onboarding flow | `src/frontend/pages/OnboardingPage.tsx` |
| `onboarding_skipped` | User skips onboarding early | `src/frontend/pages/OnboardingPage.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics dashboard](/dashboard/1594026)
- [Sign-in to Session Funnel](/insights/tr5Kz2Cs) — conversion from sign-in initiation through auth completion to session creation
- [Session Activity Over Time](/insights/1LRHHlN9) — daily trend of sessions created, joined, and started
- [Purchase Conversion Funnel](/insights/RAgj93Ut) — conversion from Vybes purchase start to completed credit
- [Match Unlocks Over Time](/insights/1FPqxvTX) — monetization engagement via match tier unlocks
- [Quiz Completion Rate](/insights/QUHh9bDs) — funnel from session join to full quiz completion

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
