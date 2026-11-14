# Contributing to GitVis

Thanks for your interest in contributing! GitVis is maintained by one person, so please open an issue before starting larger changes.

## Before you start

- **Bugs:** Open an issue using the bug report template. Include the card URL (`/api/card?...`) or a screenshot if possible.
- **Features and larger changes:** Open an issue first so we can discuss the approach.
- **Small fixes:** Typos, documentation updates, and straightforward bug fixes can go straight to a pull request.
- **Security issues:** Please don't open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Setup

Requires Node.js 22 or later.

Fork the repository, then clone your fork:

```bash
git clone https://github.com/<your-username>/gitvis.git
cd gitvis
npm install
cp .env.example .env.local
npm run dev
```

Live data requires a `GITHUB_TOKEN` in `.env.local`. Use a fine-grained personal access token with read-only access to public repositories and no additional permissions. Never commit it.

You can work on the studio with sample data without a token.

## Making a change

1. Create a branch from `main` (for example, `fix/heatmap-tooltip`).
2. Make your changes and add or update tests (`*.test.ts` or `*.test.tsx`).
3. Run the checks:

   ```bash
   npm run check          # lint, typecheck, unit tests
   npm run format:check   # formatting; use npm run format to fix
   npm run test:e2e       # browser tests for UI or published-image changes
   ```

4. Open a pull request against `main` and fill in the template.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a short, descriptive subject:

- `feat: add a weekly streak stat`
- `fix: keep the year card total on one line`
- `docs: explain the GitLab 12-month limit`

Common types include `feat`, `fix`, `docs`, `refactor`, `test`, and `chore`.

## Project rules

See [Architecture](docs/ARCHITECTURE.md) and [Design System](docs/DESIGN_SYSTEM.md) for more detail. The most important rules are:

- **Published URLs must keep working.** New URL parameters must be optional. Add or update regression tests when changing published URL behavior.
- **Keep contribution data accurate.** Contributions aren't necessarily commits. Missing data is unknown, not zero. Label sample and partial data clearly.
- **SVGs must be self-contained.** Use inline attributes, not CSS classes, `<style>`, or `<script>`. Renderers must work with `renderToStaticMarkup`.
- **Accessibility matters.** Follow WCAG 2.2 AA and test keyboard and screen-reader behavior.
- **Keep tokens server-side.** Never expose tokens in client code, URLs, or responses.
- **Keep dependencies intentional.** Explain why a new dependency is needed in your pull request.
- **Keep comments useful.** Reserve code comments for non-obvious technical constraints. Document product decisions in `docs/`.

## Review

I'll review pull requests as time allows. I may request changes, and not every proposal will fit the project's scope.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
