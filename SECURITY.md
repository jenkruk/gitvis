# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report vulnerabilities privately through the repository's **Security** tab using **Report a vulnerability**, or [submit a report directly](https://github.com/jenkruk/gitvis/security/advisories/new).

Please include:

- A description of the problem and its potential impact.
- Steps to reproduce it (a URL or example request is helpful).
- A suggested fix, if you have one.

I'll aim to acknowledge reports within a week. If a report leads to a fix, I'm happy to credit you unless you'd prefer to remain anonymous.

## What's in scope

- The hosted GitVis site and its API (`/api/card`, `/api/label`, `/api/contributions`, `/api/avatar`).
- Vulnerabilities that could expose server-side tokens, trigger requests to arbitrary URLs, inject content into published images, or expose another user's data.

Out of scope: GitHub or GitLab's own rate limiting, issues requiring a compromised device, and dependency vulnerabilities without a demonstrated impact on GitVis.

## Supported versions

Only the current deployment and the `main` branch are supported.
