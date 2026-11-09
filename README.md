# GitVis

**Every contribution counts.** GitVis combines GitHub and GitLab contribution calendars into one customizable graphic you can embed in your GitHub profile README.

> Status: early development (Roadmap Phase 1). The studio currently previews clearly labeled **sample data**. Live data (Connect) and embedding (Publish) are next.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # lint + typecheck + tests
npm run build
```

Requires Node 22+. Copy `.env.example` to `.env.local` when live data lands; tokens are server-only.

## Docs

- [Product](docs/PRODUCT.md): vision, users, V1 scope
- [Architecture](docs/ARCHITECTURE.md): modules, data flow, platform API findings, security
- [Roadmap](docs/ROADMAP.md): phases and acceptance criteria
- [Design system](docs/DESIGN_SYSTEM.md): layouts, palettes, accessibility

## A note on counts

GitHub and GitLab count different activities (for example, GitLab counts comments and MR approvals). GitVis reports **contributions as each platform defines them**, not raw commits, and combined totals aren't deduplicated.

## License

GitVis is open source under the [MIT License](LICENSE). © 2026 Jennifer Kruk.
