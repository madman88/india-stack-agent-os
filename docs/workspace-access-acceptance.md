# Workspace access acceptance

Local built-Worker coverage: `npm run build && npm run test:sites-access`.
This uses synthetic dispatcher identities and a migrated temporary database. It
does not verify ChatGPT login, deployed configuration, or dispatcher header stripping.
The full `npm test` also runs this check after building the Worker.

## Hosted checks requiring real accounts

Use the existing workspace:
https://india-stack-agent-os.madhusudan-prahlad.chatgpt.site/workspace

Use separate browser profiles for the configured owner, a reviewer, and an
uninvited account. Do not share cookies, tokens, credentials, or raw bank data
in the acceptance record. No invitation email is sent by the app.

1. Signed out, open the workspace. Expect a sign-in prompt and no private data.
2. Sign in as the configured owner. Expect workspace access and reviewer controls.
3. Sign in as the uninvited account. Expect access denial and no private evidence.
4. As owner, grant the reviewer account's email. Expect an active invitation.
5. As reviewer, sign in and load the workspace. Expect reviewer access, scoped
   history and no permission-management or session-creation capability. An expired
   consent or provider outage may block fresh evidence; that is not a login failure.
6. As owner, revoke the reviewer. In the reviewer's still-signed-in profile,
   refresh and attempt another private read. Expect denial without signing out first.
7. As owner, check audit history for the grant/revoke and the actor roles.
8. Sign out as owner and refresh. Expect private access to be denied again.

Record each result with date, deployed version, account role (no credentials),
expected/actual behavior, and pass/fail. Use “not run” for any incomplete check.
Do not mark hosted acceptance complete based on the local tests. Fresh consent
and general business onboarding remain the following engineering milestone.

## Current evidence

October 8, 2026: local built-Worker acceptance passed with synthetic identities.
Owner and real reviewer hosted sign-in acceptance remain **not run** in this
session; the agent has no authenticated browser sessions for these accounts.
