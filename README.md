# GitVis

**Every contribution counts.** GitVis combines your GitHub and GitLab contribution calendars into one customizable graphic for your GitHub profile README.

## Use it

1. Open **[gitvis.vercel.app](https://gitvis.vercel.app)**.
2. **Connect:** enter your GitHub and/or GitLab username (public data only; no sign-in).
3. **Design:** pick a layout, palette, light or dark mode, profile header, the stats to show and up to three years of history.
4. **Publish:** copy the snippet into your profile README. The image refreshes about every 12 hours on its own.

## How it works

- GitHub data comes from GitHub's GraphQL API; GitLab data from each profile's public contribution calendar. Each platform's yearly total matches the number on that profile.
- The graphic is a self-contained SVG rendered on the server and cached, so READMEs stay fast and nothing runs in the reader's browser.
- Nothing private is read: GitVis only uses public contribution counts, and tokens stay on the server.

## Run it locally

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # then add a GITHUB_TOKEN (see below)
npm run dev                  # http://localhost:3000
```

`GITHUB_TOKEN` is a fine-grained personal access token with **public repositories read-only** access and no other permissions. GitLab needs no token. The sample-data preview works without one.

| Command             | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `npm run check`     | Lint, typecheck and unit tests (run before every pull request)                   |
| `npm run test:e2e`  | Browser tests against a production build and a fake upstream (no real API calls) |
| `npm run format`    | Prettier                                                                         |
| `npm run storybook` | Component explorer                                                               |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security issue, see [SECURITY.md](SECURITY.md); please don't open a public issue.

## Docs

- [Product](docs/PRODUCT.md): vision, users, scope
- [Architecture](docs/ARCHITECTURE.md): modules, data flow, platform API findings, security
- [Roadmap](docs/ROADMAP.md): phases and acceptance criteria
- [Design system](docs/DESIGN_SYSTEM.md): layouts, palettes, accessibility
- [Deployment](docs/DEPLOYMENT.md): environment variables and Vercel setup

## A note on counts

GitHub and GitLab count different activities (for example, GitLab counts comments and MR approvals). GitVis reports **contributions as each platform defines them**, not raw commits, and combined totals aren't deduplicated.

## License

GitVis is open source under the [MIT License](LICENSE). © 2026 Jennifer Kruk.
