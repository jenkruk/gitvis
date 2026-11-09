# Contributing to GitVis

Thanks for helping! GitVis is a small project maintained by one person, so a little preparation goes a long way.

## Before you start

- **Bugs:** open an issue with the bug report template. Include the card URL (the `/api/card?...` link) or a screenshot.
- **Features and larger changes:** open an issue first so we can agree on the approach before you spend time on it.
- **Small fixes** (typos, docs, obvious bugs): a pull request is fine straight away.
- **Security issues:** don't open an issue. Follow [SECURITY.md](SECURITY.md).

## Setup

Requires Node 22+.

```bash
git clone https://github.com/<your-username>/gitvis.git
cd gitvis
npm install
cp .env.example .env.local
npm run dev
```

Live data needs a `GITHUB_TOKEN` in `.env.local`: a fine-grained personal access token with **public repositories read-only** access and no other permissions. Never commit it. Without a token you can still work on the studio with sample data.

## Making a change

1. Fork the repo and create a branch from `main` (for example `fix/heatmap-tooltip`).
2. Make your change, with tests next to the code (`*.test.ts(x)`).
3. Run the checks:

   ```bash
   npm run check          # lint + typecheck + unit tests (required)
   npm run format:check   # formatting (run `npm run format` to fix)
   npm run test:e2e       # browser tests, for UI or published-image changes
   ```

4. Open a pull request against `main` and fill in the template. CI runs the same checks.

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/): one line, `type: what changed`, for example

- `feat: add a weekly streak stat`
- `fix: keep the year card total on one line`
- `docs: explain the GitLab 12-month limit`

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Project rules

The full rules are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). The ones that matter most:

- **Published image URLs are a public contract.** Old README links must keep rendering. New URL parameters must be optional, with a golden-URL test (`src/publish/card-params.ts`).
- **Data honesty.** Say "contributions", never "commits". Days a platform doesn't report are unknown, not zero. Never present sample or partial data as real totals.
- **Self-contained SVG.** Renderers use inline attributes only (no CSS classes, `<style>` or `<script>`) and must work with `renderToStaticMarkup`.
- **Accessibility is a requirement** (WCAG 2.2 AA), including keyboard and screen-reader behavior in component tests.
- **Tokens stay on the server.** Never in client code, URLs or responses.
- **Dependencies:** add one only with a clear purpose, and say why in the pull request.

## Review

The maintainer reviews pull requests as time allows. Changes may be requested, and not every proposal will fit the project's scope. Thanks for understanding.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and that you'll follow the [Code of Conduct](CODE_OF_CONDUCT.md).
