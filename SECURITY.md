# Security

GO PRIMAL handles provider OAuth tokens and competitive game state.

## Never commit secrets

Do not commit `.env.local`, provider secrets, service-role credentials, access tokens, refresh tokens or encryption keys.

If a secret is accidentally committed:

1. Rotate it at the provider immediately.
2. Remove it from the repository and Git history.
3. Replace the local/deployment environment variable.
4. Review provider logs for unexpected use.

## Competitive integrity

Client input is never treated as authoritative for balances, rewards, raids or verification.

Security issues should be handled privately before public disclosure.
