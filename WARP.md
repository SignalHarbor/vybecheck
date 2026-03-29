# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## General Idea and Goals

• Concept: an online, near-live quiz generated from Twitter Spaces discussions, using rapid-fire true/false questions tied to speakers' stances.
• Engagement: timed answering (5-10 seconds) so responses can keep pace with the conversation and results can feed back into the space.
• Long-running Quizzes: Quizzes remain active for 2-3 months after the Twitter Space ends, allowing new participants to join and take the quiz asynchronously.
• Matching Logic: There are no correct/incorrect answers. Participants are matched based on answer agreement - the more questions two participants answer the same way (both True or both False), the higher their similarity score.
• Monetization: Multiple display options for viewing matches, with premium visualizations and detailed match insights locked behind credit system; sell credits (example given: $5 for 20 credits) and charge non-space users for participation/insights.
• Visualization: Multiple result display modes including radar/spider charts, with some display options requiring credits to unlock.

## Development Commands

### Build & Run
```bash
npm run build     # Compile TypeScript to dist/
npm run dev       # Build and start server (development mode)
npm start         # Start production server (requires prior build)
```

### Testing
```bash
npm test                    # Run all tests with Vitest
npm test -- --ui            # Run tests with UI
npm test -- --coverage      # Run with coverage report
npm test QuizSession        # Run specific test file
```

### Development Server
After running `npm run dev`, access the app at `http://localhost:3000`

## Tech Stack
- Node.js + Express (REST API for payments, vybes balance/history)
- WebSockets for real-time game sessions only (quiz create/join, questions, responses, matches)
- React + Vite (frontend SPA)
- Zustand for client state management
- Stripe for payment processing
- TypeScript (ES2022 modules, strict mode)
- Vitest for testing

## Development Plan

### Phase 1: Foundation ✅
- Set up basic web server
- Create simple HTML/CSS frontend
- Establish WebSocket connection between client and server
- Test basic message passing (ping/pong)

### Phase 2: Quiz Session & Participant Management ✅
**Status: COMPLETED** - Backend implementation with 96 passing tests

Built using vertical slicing approach (Slices 1-6):

#### Slice 1: Session Creation with Owner ✅
- QuizSession class with unique session IDs (timestamp-based)
- Owner participant tracking with `isOwner` flag
- Session lifecycle: `live` → `active` → `expired` (3-month duration)
- Owner permission validation (`canAddQuestion`)
- 19 unit tests

#### Slice 2: Dynamic Question Addition ✅
- Question model: id, prompt, options (exactly 2), timer (optional), addedAt
- Question validation: exactly 2 options enforced, no duplicates, non-empty fields
- Questions stored in order (`quiz` array tracks question IDs)
- Owner-only question addition with server-side validation
- 19 unit tests

#### Slice 3: Multiple Participants Join ✅
- Participant model: id, username, connection, isOwner, joinedAt, lastActiveAt, isActive
- Participant management: add, remove, retrieve by ID, count
- Active/inactive participant tracking
- Multiple owners prevented (validation enforced)
- 15 integration tests

#### Slice 4: Response Submission ✅
- Response model: id, participantId, questionId, sessionId, optionChosen, answeredAt
- Flat array storage (not nested) for efficient querying
- Comprehensive validation:
  - Participant must exist
  - Question must exist
  - Option must be valid for that question
  - No duplicate responses (one answer per question per participant)
- Response retrieval by participant with question ordering
- Completion tracking (`hasParticipantCompletedQuiz`)
- 20 unit tests

#### Slice 5: Match Calculation ✅
- MatchingService with agreement-based matching algorithm
- `getResponseValues()`: Extract responses in question order
- `calculateMatch()`: Calculate percentage agreement between participants
- `getMatchesForParticipant()`: Get all matches sorted by similarity (highest first)
- Handles partial responses (participants with different completion levels)
- Ignores unanswered questions in calculations
- 16 unit tests

#### Slice 6: Dynamic Match Updates ✅
- Questions can be added after participants have answered
- Matches automatically recalculate with new responses
- Rankings update when new questions change relative percentages
- Example: 0% match (0/3) → 25% match (1/4) when both answer new question
- 7 integration tests

#### Implementation Notes
- **96 total tests passing** across all slices
- Participant IDs: timestamp + random string generation
- Strict TypeScript: no `any` types
- ES2022 modules throughout
- Models in `src/server/models/`
- Services in `src/server/services/`
- Tests in `tests/unit/` and `tests/integration/`

### Phase 3: UI & WebSocket Integration ✅
**Status: COMPLETED** - Full React SPA with WebSocket game sessions

#### Frontend Architecture ✅
- React SPA with Vite, served via Express in production
- Pages: StartPage, LabPage (owner), QuizPage (participant), LobbyPage, VybesPage
- Purchase flow pages: PurchaseSuccess, PurchaseCancel, PurchaseError
- Zustand stores: websocketStore, authStore, quizStore, uiStore, draftStore
- Components: Header, BottomNav, QuestionCard, DraftQuestionCard, MatchCard, ParticipantList, ConfirmDialog, LoadingScreen

#### WebSocket Usage (Game Sessions Only) ✅
WebSockets are used **exclusively** for real-time quiz session communication. All non-session operations (payments, vybes balance queries) use REST APIs.

Messages defined in `src/shared/types.ts`:

**Client → Server:**
- `session:create` - Owner creates new quiz
- `session:join` - Participant joins with sessionId
- `question:add` - Owner adds new question (with optional ownerResponse)
- `question:unlock-limit` - Owner unlocks higher question limit
- `response:submit` - Submit answer to question
- `matches:get` - Request match results (with optional tier)
- `credits:balance` - Request current Vybes balance
- `credits:history` - Request transaction history
- `ping` - Keepalive

**Server → Client:**
- `session:created` - Returns sessionId, participantId, vybesBalance
- `session:joined` - Confirms join with participant info and vybesBalance
- `quiz:state` - Full quiz state sync
- `question:added` - New question notification
- `question:limit-reached` - Question limit hit (with upgrade cost)
- `question:limit-unlocked` - Limit upgraded (with new limit and balance)
- `participant:joined/left` - Participant updates
- `response:recorded` - Response confirmation
- `matches:result` - Tiered match results with cost and balance
- `credits:balance` / `credits:history` / `credits:insufficient` - Vybes updates
- `notification` / `error` / `pong` - System messages

#### REST API Endpoints ✅
- `POST /api/checkout` - Create Stripe checkout session
- `GET /api/checkout/verify` - Verify checkout session status
- `GET /api/packs` - List available Vybe packs
- `POST /api/webhooks/stripe` - Stripe webhook (raw body)
- `GET /api/vybes/balance` - Get Vybes balance for participant
- `GET /api/vybes/history` - Get transaction history for participant
- `GET /health` - Health check

### Phase 4: Results Visualization & Matching
**Status: Backend COMPLETE, UI PENDING**

#### Participant Matching Algorithm ✅
- Calculate response agreement percentage between all participant pairs (number of matching responses / total questions)
- Rank matches from highest to lowest similarity (highest agreement = best match)
- Matches work across participants who completed at different times
- Handles partial responses (participants who haven't answered all questions)
- Implemented in `MatchingService` with full test coverage

#### Results UI (TODO)
- Display match results to participants
- Show match percentages and rankings
- Later: add tiered visualization modes (free/standard/premium)

### Phase 5: AI Question Generation
**Status: NOT STARTED**

Integrate AI to generate questions from Twitter Spaces audio.

#### Question Generation Service
- Create src/services/questionGenerator.ts
- Integrate OpenAI API or similar high-quality LLM
- Design prompt template: analyze transcript → generate questions with exactly 2 options
- Implement question validation and quality filtering
- Add human review workflow for generated questions before going live

#### Audio/Transcript Processing
- Set up audio transcription pipeline (e.g., Whisper API)
- Parse Twitter Spaces audio data
- Extract speaker information and timestamps
- Feed transcript chunks to question generator
- Store generated questions in database

#### Pre-generated Question System
- Create question review dashboard (admin interface)
- Implement question approval workflow
- Build reviewed question database/storage
- Use approved questions for initial launch

### Phase 6: Tiered Results Display System
**Status: BACKEND COMPLETE** - Tiered match access with Vybes billing implemented

#### Implemented Tiers ✅
**PREVIEW Tier (Free, 0 Vybes):**
- 2 matches from the middle of the ranked list
- No names revealed

**TOP3 Tier (2 Vybes):**
- Top 3 matches with usernames

**ALL Tier (5 Vybes):**
- Full match list with all usernames and percentages

**Question Limit Unlock (3 Vybes):**
- Owner can unlock expanded question limit per session

#### Billing Infrastructure ✅
- BillingService with idempotent `purchaseOrVerifyAccess()` (no double-charging)
- VybeLedger: append-only transaction ledger with balance calculation
- ParticipantUnlockManager: tracks feature unlocks per participant per resource
- QuotaManager: enforces question limits, checks unlock status
- Initial grant of 10 Vybes per participant on session join

#### UI (TODO)
- Add charting library (Chart.js or D3.js)
- Radar/spider chart visualizations for premium tiers
- Export results as shareable image for social media
- Locked/preview state for premium features

### Phase 7: Authentication & Twitter Integration
Add user authentication with Twitter OAuth.

#### Twitter OAuth Setup
- Register Twitter Developer app and obtain API keys
- Add passport and passport-twitter packages
- Create src/auth/twitter.ts authentication strategy
- Implement OAuth callback handling
- Store user tokens securely (environment variables/secrets manager)

#### User Session Management
- Add session middleware (express-session)
- Create User model: twitterId, username, displayName, profileImage, credits
- Link WebSocket connections to authenticated users
- Implement guest user flow (limited features)
- Store user data in database

#### Feature Gating
- Allow non-signed-in users to view public stats only
- Require Twitter auth for quiz participation
- Implement credit check before revealing closest match

### Phase 8: Payment & Monetization ✅
**Status: COMPLETED** - Stripe integration with Vybes currency

#### Stripe Integration ✅
- StripeService (`src/server/services/StripeService.ts`): checkout sessions, webhook handling, session verification
- Payment routes (`src/server/routes/payment.ts`): POST /api/checkout, GET /api/checkout/verify, GET /api/packs
- Webhook endpoint at POST /api/webhooks/stripe (raw body parsing before express.json)
- Idempotent credit processing (tracks processed session IDs to prevent duplicates)
- Session verification also credits Vybes if paid but not yet processed (handles server restart)

#### Vybe Packs ✅
- Starter Pack: 20 Vybes / $5
- Pro Pack: 50 Vybes / $10
- Ultimate Pack: 120 Vybes / $20
- Stripe Price IDs configured via environment variables (STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_ULTIMATE)

#### Vybes System ✅
- "Credits" renamed to "Vybes" throughout the codebase
- VybeLedger: append-only ledger with balance calculation
- BillingService: idempotent purchase/access orchestration
- VybesPage in frontend for balance display and pack purchase
- Purchase flow: VybesPage → Stripe Checkout → PurchaseSuccess/PurchaseCancel pages
- REST endpoints for balance/history: GET /api/vybes/balance, GET /api/vybes/history
- StripeService shares VybeLedger instance with WebSocketHandler

#### Environment Variables Required
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO` / `STRIPE_PRICE_ULTIMATE` - Stripe Price IDs
- `APP_URL` - Application URL for checkout redirects (defaults to http://localhost:5173)

#### Pricing for Non-Space Users (TODO)
- Add participation fee for non-Twitter Space users
- Charge Vybes for quiz entry
- Display pricing information clearly

### Phase 9: Public Statistics Dashboard
Build analytics dashboard for non-authenticated users.
Non-signed-in users can view general platform statistics including:
- Total participation numbers
- Questions generated
- Questions rated
- And more engagement metrics

#### Statistics Collection
- Track metrics: total participants, questions generated, questions rated, quiz completions
- Create src/services/analytics.ts
- Store aggregate statistics (not individual user data)
- Update stats in real-time or batch processing

#### Dashboard UI
- Create public-stats.html or dedicated route
- Display key metrics with visualizations
- Show trending topics and popular questions
- Add real-time participant count
- Make stats publicly accessible without login

### Phase 10: Database & Persistence
Add database layer for data persistence.

#### Database Setup
- Choose database (PostgreSQL or MongoDB recommended)
- Add database driver (pg or mongoose)
- Create src/db/schema.ts with models: Users, Questions, QuizSessions (with status and expirationDate), Responses, Matches
- Implement connection pooling and error handling
- Add indexing for efficient querying of long-running quizzes and historical data

#### Data Persistence
- Store users, questions, and quiz sessions persistently with status tracking
- Save participant responses and match results with timestamps
- Track historical matching data and response patterns
- Support querying active quizzes (available for new participants)
- Archive expired quizzes (older than 2-3 months) but keep data accessible
- Add database migrations system
- Implement efficient queries for matching participants across different completion times

### Phase 11: Production Readiness
Prepare for deployment and scale.

#### Infrastructure
- Set up production environment variables
- Configure HTTPS/WSS for secure connections
- Add rate limiting and DDoS protection
- Implement logging (Winston or Pino)
- Add error tracking (Sentry)

#### Deployment
- Containerize with Docker
- Set up CI/CD pipeline
- Choose hosting provider (AWS, Railway, Render)
- Configure database backups
- Set up monitoring and alerts

#### Testing
- Add unit tests for quiz logic
- Add integration tests for WebSocket flows
- Test payment flows in sandbox mode
- Load test with multiple concurrent users
- Test Twitter OAuth flow end-to-end

#### Documentation
- Write API documentation
- Create deployment guide
- Document environment variables
- Add contributing guidelines

## Important Implementation Notes

### Question Constraints
**CRITICAL:** Quiz questions must have **exactly 2 options**. No more, no less.
- Type system enforces: `options: [string, string]` (tuple type)
- Runtime validation: Rejects questions with < 2 or > 2 options
- Error message: "Question must have exactly 2 options"
- Examples: Yes/No, Agree/Disagree, A/B, True/False

### Owner Permission Validation
Always validate owner permissions **server-side** for sensitive operations:
- Adding questions (`question:add`)
- Managing session lifecycle
- Accessing participant data

### Response Storage Pattern
Store responses in a **flat array** structure, not nested within participants. This design choice optimizes for:
- Efficient database queries
- Easier match calculations
- Simpler response aggregation

### Long-Running Quiz Sessions
- Quizzes remain active for 2-3 months after creation
- New participants can join and complete quizzes asynchronously
- Status transitions: `live` (during Twitter Space) → `active` (open for new users) → `expired`
- Match calculations work across participants who completed at different times

### Monetization Model (Vybes)
Vybes is the in-app currency. Participants receive 10 Vybes on first joining a session.
- PREVIEW tier (free): 2 matches from the middle of the list
- TOP3 tier (2 Vybes): Top 3 matches with names
- ALL tier (5 Vybes): Full match list
- Question limit unlock (3 Vybes): Owner can add more questions
- Vybes purchased via Stripe checkout (Starter $5/20, Pro $10/50, Ultimate $20/120)
- Non-Space users pay for quiz participation (TODO)

### TypeScript Standards
- Strict mode enabled
- No `any` types allowed
- ES2022 module syntax
- All interfaces and types in `shared/types.ts` for client/server consistency

### WebSocket Architecture
WebSockets are used **only** for real-time game session communication (quiz flow, responses, matches, credits within sessions). All other operations (payment checkout, pack listing, vybes balance/history) use standard REST API endpoints. This separation allows WebSocket scaling independently of API scaling.

Plan for Redis pub/sub when scaling WebSocket to multiple server instances in production phases.

## Testing Strategy

### Unit Tests (`tests/unit/`)
- QuizSession.test.ts - Session creation, owner permissions
- QuestionAddition.test.ts - Question validation, exactly 2 options
- ResponseSubmission.test.ts - Response recording, validation
- MatchingService.test.ts - Match calculation, ranking
- BillingService.test.ts - Idempotent purchases, balance checks
- VybeLedger.test.ts - Append-only ledger, transaction history
- ParticipantUnlock.test.ts - Feature unlock tracking
- QuotaManager.test.ts - Question limits, unlock checks

### Integration Tests (`tests/integration/`)
- WebSocketHandler.test.ts - WebSocket message handling
- WebSocketFlow.test.ts - Full session flows
- ParticipantJoining.test.ts - Join/leave flows
- DynamicMatchUpdates.test.ts - Match recalculation
- PurchaseFlow.test.ts - End-to-end purchase flow
- CacheBehavior.test.ts - Idempotency and caching

### Edge Case Tests (`tests/edge-cases/`)
- EdgeCases.test.ts - Boundary conditions and error handling

### Manual Testing Checklist
1. Owner creates session and sees owner badge
2. Multiple participants join (3-4 browser tabs)
3. Participant count updates in real-time
4. Non-owners cannot see "add question" controls
5. Owner adds questions dynamically
6. All participants receive question notifications
7. Participants submit responses
8. Match percentages calculate correctly
9. New question addition updates match percentages
10. Disconnection handled gracefully

Run manual tests by starting dev server and opening multiple browser tabs to `http://localhost:3000`.

## File References

When making changes, key files to reference:
- Server entry: `src/server.ts`
- Server models: `src/server/models/` (QuizSession, Question, Response, Participant, VybeLedger, ParticipantUnlock, QuotaManager)
- Server services: `src/server/services/` (WebSocketHandler, MatchingService, BillingService, StripeService)
- Server routes: `src/server/routes/` (payment.ts, vybes.ts)
- Shared types: `src/shared/types.ts`
- Frontend entry: `src/frontend/App.tsx`
- Frontend pages: `src/frontend/pages/`
- Frontend stores: `src/frontend/store/` (websocketStore, authStore, quizStore, uiStore, draftStore)
- Frontend components: `src/frontend/components/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/edge-cases/`
- Build output: `dist/`
- Configuration: `tsconfig.json`, `package.json`, `.env`
