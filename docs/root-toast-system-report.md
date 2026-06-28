# Root Toast System Report

## Summary

Implemented a root-level Moodies toast system using the app's existing custom toast UI. The new system provides a shared `appToast` API for success, error, warning, info, loading, promise, and dismiss behavior, backed by a small external store and rendered once at the app root.

## Library Used

No new toast library was installed. The project already had a custom `Toast` component and `ToastProvider`, and no Sonner or React Hot Toast dependency was present. The implementation keeps the existing dark premium Moodies styling and avoids multiple competing toast systems.

Context7 was used before implementation:

- `/vercel/next.js` for App Router root layout/provider mounting.
- `/reactjs/react.dev` for `useSyncExternalStore` external store subscription guidance.

## Root Mount Location

The single toaster root is mounted in:

```tsx
client/app/layout.tsx
```

```tsx
<ToastProvider>
  <AuthProvider>
    <AppErrorProvider>
      <ClientLayout>{children}</ClientLayout>
      <AppToaster />
    </AppErrorProvider>
  </AuthProvider>
</ToastProvider>
```

`ToastProvider` is now a compatibility wrapper only. It does not render a second toaster.

## Shared API

Use:

```ts
import { appToast } from "@/lib/toast";

appToast.success("Added to your watchlist.");
appToast.error("Could not update your watchlist. Please try again.");
appToast.warning("Sign in to save this to your watchlist.");
appToast.info("Removed from your watchlist.");

appToast.promise(saveAction(), {
  loading: "Saving...",
  success: "Saved.",
  error: "Could not save.",
});
```

The shared module lives in:

```txt
client/lib/toast/
  app-toast.ts
  toast-messages.ts
  toast-types.ts
  index.ts
```

The root renderer lives in:

```txt
client/components/providers/AppToaster.tsx
```

## Error Handler Integration

`handleAppError` now calls `appToast.error` directly with stable IDs for auth/session and network failures. `AppErrorProvider` remains responsible for centralized unauthorized-session side effects.

## Migration Done

Moved these high-traffic user-action flows to `appToast`:

- `client/hooks/useWatchlist.ts`
- `client/hooks/useLiked.ts`
- `client/hooks/useAuth.ts`
- `client/components/Navbar.tsx`
- `client/app/context/AuthProvider.tsx`
- `client/app/auth/AutoLogout.tsx`
- `client/app/auth/forgot-password/page.tsx`
- `client/app/auth/change-password/page.tsx`
- `client/app/auth/onboarding/page.tsx`
- `client/app/watchlist/page.tsx`
- `client/app/liked/page.tsx`
- `client/lib/errors/handle-app-error.ts`

## Testing Done

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
```

Manual flows to verify:

- Login success/failure.
- Forgot-password success/failure.
- Password reset success.
- Guest watchlist/favorite click.
- Logged-in watchlist/favorite add/remove.
- Watchlist/favorite API failure.
- Expired session.
- Desktop and mobile toast placement.
- Keyboard focus on close/action buttons.

## Remaining Notes

Review components still import `useToast`, but `useToast` now delegates to `appToast`, so they use the same root toaster. Those areas mix review-specific validation, reply/reaction actions, and local form state, so they should be migrated in a focused review-flow pass rather than folded into this root-system change.

Form validation remains local by design.
