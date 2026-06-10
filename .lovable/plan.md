This is a large two-part request. Here's what I'll implement, grouped so we can verify each piece.

## Part A — Authentication feedback & validation

1. **Auth page rewrite (`src/routes/auth.tsx`)**
   - Add zod-based inline validation for Sign In / Create Account (email format, password ≥ 8, confirm password matches).
   - Disable buttons while submitting; show "Signing in..." / "Creating account..." spinners.
   - Wrap every Supabase call in try/catch, surface real error messages via sonner toasts (success = green, error = red, etc.).
   - On signup success: toast "Account created successfully. Please check your email to verify your account." (since auto-confirm is off).
   - On sign-in success: toast "Signed in successfully." then redirect by role (admin → /admin, else /dashboard).
   - Forgot password: toast on success ("Password reset link has been sent to your email.") and on failure (real error).
   - Add `aria-live="polite"` region; refocus offending field on validation errors.
2. **Reset password page (`src/routes/reset-password.tsx`)** — same toast + validation treatment, ensure loading state always cleared.
3. **Toast positioning** — configure `<Toaster />` in `__root.tsx` with `position="top-right"` and a mobile-friendly fallback (`top-center` via responsive prop).
4. **auth_logs table** — new migration: `public.auth_logs(id, timestamp, action, user_email, error_message)`, RLS admin-only read, insert allowed to anon+authenticated (no PII beyond email). Log failures from auth page via a tiny `logAuthError` helper.

## Part B — Admin/feature fixes

5. **Members management** (rename/expand existing Admin Users tab)
   - Server fns in `admin.functions.ts`: `listAllMembers`, `updateMemberRole(userId, role)` supporting roles `admin | faculty | student | coordinator`, `deactivateMember`, `activateMember`, `deleteMember` (removes auth user + cascades).
   - Add `app_role` enum values `faculty`, `coordinator` if missing; add `status` column to `profiles` (`active|inactive`).
   - UI table with avatar, name, email, role, department, created date, status; filters + search; confirm dialog before deletion.
6. **Assignments**
   - Admin download: generate signed URL via server fn using `supabaseAdmin.storage.from('cic-files').createSignedUrl(path, 300)`; surface progress + toasts.
   - Ensure Document Management query excludes assignment-linked rows (filter `documents` where `category != 'assignment'` or by source table).
   - Student lock-after-review: enforce in RLS — students can `UPDATE/DELETE` assignments only when `review_status = 'pending'`; admins always allowed. Mirror in UI (hide Delete/Re-upload buttons once reviewed; show "Reviewed (Locked)").
7. **Coordinators / Faculty CRUD**
   - Verify admin RLS policies for INSERT/UPDATE/DELETE on `coordinators` (+ a `faculty` table if separate — will check; otherwise reuse coordinators with `type` column).
   - Wire admin UI forms with proper mutations + toasts; ensure landing page re-fetches after change.
8. **Profiles editable again**
   - Re-enable profile editing (revert read-only) with avatar upload to `cic-files/avatars/<uid>` (5 MB max, JPG/PNG/WEBP), fields: name, phone, department, semester, roll, bio, address. Email read-only.
   - Restore `UPDATE` grant on `profiles` with RLS `auth.uid() = id`.
   - Show avatar everywhere (nav, members list, coordinators, faculty) with initials fallback (existing `Avatar` component).
9. **Toast coverage** — wire success/error toasts for every mutation listed in the brief.

## Technical notes

- Stack: TanStack Start + Supabase. Server fns in `src/lib/*.functions.ts` with `requireSupabaseAuth` + admin role check; `supabaseAdmin` imported inside handlers.
- New migration covers: `app_role` additions, `profiles.status`, `profiles.phone/department/semester/roll_number/bio/address/avatar_url` (only if missing), `auth_logs` table+grants+RLS, refreshed RLS for `assignments`, `coordinators`, `profiles` (UPDATE self), and `auth_logs`.
- All RLS: admin via `has_role(auth.uid(), 'admin')`; students restricted to own rows; assignments lock on `review_status != 'pending'`.
- Storage: ensure `cic-files` has policies for avatars (owner write, public read of avatars/ prefix only if needed — otherwise signed URL).

## Out of scope

- Email verification provider config (auto_confirm stays as currently set).
- Real-time presence / activity feed.
- Marketing/landing visual changes beyond reflecting coordinator/faculty edits.

Approve and I'll execute the migration first (you'll review it), then ship the code in one pass.