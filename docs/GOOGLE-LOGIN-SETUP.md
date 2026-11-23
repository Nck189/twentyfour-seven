# Google sign-in — one-time setup (Minnie, about 10 minutes)

The button is built and switched off. It shows on the login page only when `NEXT_PUBLIC_GOOGLE_LOGIN=1`, and never inside LINE's or Instagram's own browser (Google refuses to sign people in there; the email code still works).

Nothing here goes in git or in chat: the client secret is pasted straight into the Supabase dashboard.
Menu names in Google Cloud and Supabase change now and then; look for the nearest match.

## 1. Google Cloud: create the sign-in client
1. Open console.cloud.google.com and create a project (any name, e.g. "24-7").
2. **APIs & Services → OAuth consent screen**: External, app name "24/7", your email as support and developer contact. Scopes: leave the defaults (email, profile). Publish the app ("In production"), or only test users you add can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` (the project ref is in the Supabase dashboard URL).
4. Keep the page open: you need the **Client ID** and **Client secret** in the next step.

## 2. Supabase: turn the provider on
1. Supabase dashboard → **Authentication → Sign In / Providers → Google**.
2. Enable it, paste the Client ID and Client secret, save.
3. **Authentication → URL Configuration**: the redirect list must include `https://twentyfour-seven.vercel.app/auth/callback` (it should already be there for the email link).

## 3. Vercel: show the button
1. Project → **Settings → Environment Variables**: add `NEXT_PUBLIC_GOOGLE_LOGIN` = `1` for Production.
2. **Deployments → ⋯ → Redeploy** (a `NEXT_PUBLIC_` value is baked in at build time).

## 4. Check before telling anyone
Do steps 1 and 2 **before** step 3. With the switch on but the provider not enabled in Supabase, the button leads to a bare error page.
- [ ] On a phone in Safari or Chrome: "Continue with Google" → you land on Today.
- [ ] **In the installed Home Screen app on the iPhone** (it keeps its own sign-in, separate from Safari): the same.
- [ ] **Same account, not a second one.** Sign in with Google using the same address as your existing email-code account: your farm, streak and plans must be there. Supabase should link a Google sign-in to an existing account with the same verified email; this could not be tested or looked up from the build environment, so check it with your own account first. If you land on an empty farm, turn the switch off (step 3, value `0`, redeploy) and tell the builder.
- [ ] Back out of Google's screen: the login page says the sign-in was cancelled.
- [ ] Open the app's link inside LINE: the button is not shown, and the page suggests Safari or Chrome.
- [ ] In Supabase → Authentication → URL Configuration, read the redirect list yourself: `https://twentyfour-seven.vercel.app/auth/callback` (or a pattern that covers it) must be on it.

## Turning it off
Set `NEXT_PUBLIC_GOOGLE_LOGIN` to `0` (or delete it) on Vercel and redeploy. Accounts made with Google keep working through the email code for the same address.

## LINE and Apple sign-in
Not built. Apple needs a paid Apple Developer account. LINE isn't one of Supabase's built-in providers as far as the builder knows; that needs checking in the current Supabase docs before promising it.
