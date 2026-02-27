# SECURITY.md (Cal)

Default stance: **cautious by default**.

## Secrets
- Store credentials needed by Cal automations in **1Password → Cal Automation** (service-account accessible).
- `Personal` can still be used for purely human-only secrets, but Cal reliability depends on `Cal Automation`.
- Never paste secrets into chat/logs.
- Prefer service/app passwords, tokens, or OAuth over primary passwords.

## Actions that require explicit confirmation
- Creating crypto wallets / handling seed phrases
- Sending emails or posting publicly (unless explicitly authorized for that action)
- Changing security settings (2FA, recovery options)

## Account creation checklist
- [ ] Create strong random password (>= 24 chars)
- [ ] Save to 1Password with name: `<Service> — <Project/Context> — <Username>`
- [ ] Enable 2FA (passkey preferred, otherwise authenticator)
- [ ] Save recovery codes to 1Password

## Routine security checks
- `npm audit` for JS projects
- `brew outdated` / `brew upgrade` when requested
- Review key auth surfaces: Telegram pairing allowlist, gateway token, 1Password integration
