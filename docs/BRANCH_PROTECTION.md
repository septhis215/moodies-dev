# Branch Protection

Recommended protection for `trunk`:

- Require pull requests before merging.
- Require the `PR checks / verify` workflow.
- Require the `Staging deploy verification / verify-deploy` workflow for pushes to `trunk`.
- Require CODEOWNERS review for security-sensitive paths.
- Dismiss stale approvals when new commits are pushed.
- Block force pushes and branch deletion.
- Require conversation resolution before merge.

Security-sensitive paths:

- `server/src/auth/**`
- `server/src/common/guards/**`
- `server/prisma/**`
- `client/app/auth/**`
- `.github/**`
- Environment/deployment documentation
