# Feature Flags Configuration & Management

Vybecheck uses a lightweight, custom feature flagging system to gate work-in-progress features, hide premium capabilities before launch, and provide admin-only tools.

## How It Works

A feature is considered **enabled** on the frontend if ANY of the following conditions are met:

1. The feature is explicitly set to `true` in the global config.
2. The application is running in local development mode (i.e. running `npm run dev`).
3. The authenticated user is an Admin (their Twitter handle is listed in the `ADMIN_USERS` array).

## Configuration Source

All feature flags and admin users are defined in a single source of truth:
**`src/shared/features.ts`**

```typescript
export const FEATURE_FLAGS = {
  enablePayments: false,
  enableAIGeneration: false,
} as const;

export const ADMIN_USERS = ["@twitter_username"];
```

---

## Managing Existing Flags

### Turning a feature on for everyone

To release a feature to **all users** in production, change its value from `false` to `true` in `src/shared/features.ts`.

### Managing Admin Users

To grant admin privileges (which automatically bypasses feature flags and unlocks admin-only UI like the Vybes issuer), add the user's Twitter handle (including the `@` symbol) to the `ADMIN_USERS` array in `src/shared/features.ts`.

---

## Adding a New Feature Flag

Follow these 3 steps to gate a new feature behind a flag:

### 1. Add the flag to the shared config

Open `src/shared/features.ts` and add your new flag to the `FEATURE_FLAGS` object:

```typescript
export const FEATURE_FLAGS = {
  enablePayments: false,
  enableAIGeneration: false,
  enableNewDashboard: false, // <-- Your new flag
} as const;
```

### 2. Expose the flag in the React Hook

Open `src/frontend/utils/features.ts` and update the return object to include your new flag. Be sure to apply the fallback logic (`|| isAdmin || isDev`) so it behaves correctly in development and for admins:

```typescript
export function useFeatures() {
  const { twitterUsername } = useAuthStore();
  const isAdmin = Boolean(
    twitterUsername && ADMIN_USERS.includes(twitterUsername),
  );
  const isDev = import.meta.env.DEV;

  return {
    isAdmin,
    enablePayments: FEATURE_FLAGS.enablePayments || isAdmin || isDev,
    enableAIGeneration: FEATURE_FLAGS.enableAIGeneration || isAdmin || isDev,
    enableNewDashboard: FEATURE_FLAGS.enableNewDashboard || isAdmin || isDev, // <-- Add here
  };
}
```

### 3. Gate your Frontend UI

Import the `useFeatures` hook in your React component and conditionally render your UI based on the flag:

```tsx
import { useFeatures } from "../utils/features";

export function DashboardPage() {
  const { enableNewDashboard } = useFeatures();

  // If the flag is false (and user isn't admin/dev), hide the new UI
  if (!enableNewDashboard) {
    return <p>Coming soon...</p>;
  }

  return <div>New Dashboard UI</div>;
}
```

### 4. Gate Backend API Routes (Optional)

If your feature introduces new backend logic that shouldn't be executed by standard users yet, you can protect the endpoint by importing the config directly:

```typescript
import { ADMIN_USERS, FEATURE_FLAGS } from "../../shared/features";

router.post("/api/new-action", (req, res) => {
  const { username } = req.body;

  // Check if feature is globally enabled OR if the user is an admin
  const isAllowed =
    FEATURE_FLAGS.enableNewDashboard || ADMIN_USERS.includes(username);

  if (!isAllowed) {
    res.status(403).json({ error: "Feature not enabled" });
    return;
  }

  // Proceed with the action...
});
```

---

### Important Note on Local Development

When you run the app locally using `npm run dev`, Vite sets `import.meta.env.DEV` to `true`. Our `useFeatures` hook uses this to automatically return `true` for all feature flags. This means **you will always see all features when developing locally**, regardless of whether you are signed in or what your username is.

To test how standard users will experience the app with disabled flags locally, you can temporarily comment out the `|| isDev` check in `src/frontend/utils/features.ts`.
