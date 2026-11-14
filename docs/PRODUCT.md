# GitVis — Product

> **Every contribution counts.**

## Problem

Developers split their work across GitHub, GitLab, and private repositories. A GitHub contribution calendar shows only one slice of that work, so a profile can look quiet even when the developer is busy elsewhere.

## Vision

GitVis combines public contribution calendars from several platforms into one visualization that the developer designs and embeds in a GitHub profile README. The embed updates itself, with no GitHub Actions setup required.

The differentiator is **the customization experience**. GitVis is a small design studio for developer activity, not a fixed stats card.

## Users

| User                                       | Need                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Developer with work split across platforms | One honest picture of activity across GitHub and GitLab                |
| Developer who cares about their profile    | A graphic that matches their personal aesthetic                        |
| Developer with mostly private work         | A way to show _that_ they are active, as counts only and never content |
| Hiring managers and readers                | A clear, readable, accurate summary with obvious platform attribution  |

## Experience

### Landing page

The home page shows what GitVis makes before asking for anything: a real GitVis graphic, drawn from clearly labelled sample data, beside a short headline and two ways in: **Create your graphic** and **Explore with sample data**. A few controls (graphic or profile card, three palettes, light or dark) give a feel for the range, and the chosen look carries into the studio. No sign-in is needed anywhere.

### The studio: Connect → Design → Publish

A guided, three-step studio. A step indicator shows where you are, completed steps can be revisited, and going back never loses a setting.

1. **Connect.** Enter a GitHub username, a GitLab username, or both (they can differ). GitVis reads only public contribution calendars. If one account can't be loaded, you can retry or continue with the one that worked. Visitors can also explore with sample data, which can't be published.
2. **Design.** Start from a **Contribution graphic** or a **Developer profile card**, then choose a layout, light or dark mode, and a palette. Everything else is optional and tucked away: identity, colors and background, which statistics to show, and display options. A live preview shows exactly what will be published.
3. **Publish.** See the real published image, copy the README Markdown in one click, or download SVG or PNG. An Edit link reopens the studio with every choice restored.

The defaults produce a good graphic with no customization. The design lives in the URL, so reloading or sharing a studio link restores everything.

## Customization

- **Layouts:** Minimal (a heatmap and a one-line summary), Dashboard (stat cards, heatmap and platform breakdown) and Data-rich (adds weekly trends and a monthly platform comparison). Switching layouts never discards other choices.
- **Statistics:** total contributions (always shown), active days, longest streak, best day, current streak, the GitHub/GitLab breakdown and activity trends, in an order the user chooses.
- **History:** the last 12 months, or up to three years. Earlier years come from GitHub only, because GitLab publishes just the last 12 months; the graphic says so.
- **Identity (optional):** a header with avatars, a display name and a professional title, in compact, full or centered styles.
- **Color:** 24 palettes, each with light and dark variants, six of them featured. Panels can be filled, outlined or borderless; backgrounds solid, gradient or transparent; and each platform can have its own color. Colors are checked and, if needed, adjusted for contrast, and platforms are always labelled, so color never carries meaning alone.
- **Density:** spacious or compact spacing.

[DESIGN_SYSTEM](DESIGN_SYSTEM.md) has the visual specification for each option.

## Publishing

The goal is to **paste one snippet into a GitHub README and never touch it again.**

- **A live image.** The snippet embeds an image whose URL holds the whole design. It shows current data, refreshed about every 12 hours, with no account, GitHub Actions, database or manual updates on the user's side. GitHub's image cache can delay when a refresh becomes visible.
- **Theme matching (optional).** The snippet can switch between light and dark variants to follow the reader's GitHub theme; transparent backgrounds always do.
- **Links under the image.** The image itself isn't a link. Below it, the snippet adds "Get Yours" (the GitVis site) and "open source on GitHub".
- **Credit.** Every graphic ends with a small "Made with GitVis · created by Jen Kruk" line.
- **Stability promise.** A published image URL keeps rendering the same design in future versions. Breaking changes require a new URL version, and old versions keep working. See [ARCHITECTURE "Published URL contract"](ARCHITECTURE.md#published-url-contract-v1).

## Honesty principles

- GitHub and GitLab count **different activities** (see [ARCHITECTURE "Platform semantics"](ARCHITECTURE.md#platform-semantics-why-combined--commits)). GitVis calls them **contributions**, never "commits".
- Combined totals are the sum of what each platform reports. They aren't deduplicated (mirrored repositories may count twice), and the graphic says so.
- Days a platform doesn't report are **unknown, not zero**. Missing history is labelled, and a combined total is never shown for a period one platform doesn't cover.
- If an account can't be loaded, a published image shows an explanatory message rather than a silently lower total. Older data, when shown during an outage, is labelled with its date.
- Every published graphic names the accounts its data comes from, and that attribution can't be removed.
- Private activity appears only as counts, and only when the user has opted in on that platform. Repository contents are never read.
- Sample data always carries a visible "Sample data" label and can't be published.

## V1 scope

**In scope:** GitHub and GitLab.com public contribution calendars; the landing page and the three-step studio; three layouts, configurable statistics, up to three years of history, 24 palettes with light and dark variants, optional identity headers, backgrounds, panel styles, custom platform colors and density; SVG, PNG and Markdown export; a stable, cached embed URL; accessibility (WCAG 2.2 AA for the app, text alternatives in every graphic) and responsive design.

**Out of scope for V1:** user accounts and sign-in, payments, self-hosted GitLab instances, Bitbucket (the data model allows for it), private-repository access via OAuth, and animated graphics.

Anonymous, aggregate usage analytics are under consideration. If they're added, they won't record usernames, generated URLs or anything else that identifies a person.

## Success criteria (launch goals)

- A user with only GitHub, only GitLab, or both can produce and embed a graphic in under two minutes.
- An embedded image shows data no more than about 13 hours old (12-hour refresh plus edge caching) without any action from its owner, while staying within GitHub's API rate limits.
- Every palette and mode passes the automated contrast checks.
- The studio passes automated WCAG 2.2 AA checks at phone, tablet and desktop widths.
