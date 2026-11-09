# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report it privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability**, or open [this form](https://github.com/jenkruk/gitvis/security/advisories/new) directly. Only the maintainer can see the report.

Please include:

- what the problem is and what an attacker could do with it,
- steps to reproduce (a URL or request is ideal),
- any suggested fix.

You can expect an acknowledgement within a week. Once the issue is fixed, you'll be credited in the advisory unless you'd rather stay anonymous.

## What's in scope

- The hosted site and its API (`/api/card`, `/api/label`, `/api/contributions`, `/api/avatar`).
- Anything that could expose the server's tokens, let someone make GitVis fetch arbitrary URLs, inject content or scripts into a published image, or show one user's data as another's.

Out of scope: rate limiting by GitHub or GitLab themselves, reports that need a compromised device, and issues in dependencies without a way to exploit them in GitVis (Dependabot covers those).

## Supported versions

Only the current deployment and the `main` branch are supported.
