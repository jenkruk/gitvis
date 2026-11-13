# GitVis — Presentation style

How GitVis presents itself outside the product: the README preview image and anywhere it's shown
beside Jennifer Kruk's portfolio (Studio-J). The product's own palettes and rules live in
`docs/DESIGN_SYSTEM.md`; nothing here changes them.

## The palette prompt

Use this prompt (with a designer, or an AI assistant) to create or revise the presentation palette.

> Create a color palette for presenting GitVis, an open-source tool that combines GitHub and
> GitLab contributions into one graphic. It will appear in GitVis's README and as an exhibit inside
> a portfolio whose palette is:
>
> - Parchment `#F6F4EF` (light canvas)
> - Jet Black `#253031` (ink, dark canvas)
> - Dark Slate `#315659` (structure)
> - Deep Eucalyptus `#5B8C83` (accent)
> - Terracotta `#AA5042` (the single point of emphasis)
>
> The palette must **complement** that portfolio, not replicate it. GitVis should feel like it
> belongs in the same room while remaining its own product.
>
> - Reuse the portfolio's color relationships (a deep green-black night, a warm paper-toned ink,
>   a cool green-grey accent, and one warm earthen accent), but use none of its exact values.
> - Design for a dark presentation first. It sits on the portfolio's dark surface (about
>   `#1B2123`), so its ground should be its own object: a little greener and deeper, never brighter.
> - Two accents, mapped to the two platforms: a cool one for GitHub and a warm one for GitLab,
>   distinct in hue and lightness, so the pair still reads without color.
> - Text colors must reach WCAG AA (at least 4.5:1) on the ground. Decorative tones (hairlines,
>   quiet logo tiles) are exempt and must never carry meaning.
> - The card in the image is real GitVis output. Its colors must come from an existing GitVis
>   palette plus GitVis's custom platform colors, so anyone could make the same card. Only the frame
>   around it uses the new palette.
> - Restraint: one ground, two text tones, two accents and one hairline. No gradients beyond a
>   faint glow, and no new hues.
>
> Return each color with its hex value, its role, and its contrast on the ground.

## Palette: Linen & Lichen

The result of the prompt above.

| Token    | Hex       | Role                                                                  | On ground |
| -------- | --------- | --------------------------------------------------------------------- | --------- |
| Ground   | `#141A18` | Image background: a greener, deeper night                             | —         |
| Glow     | `#1E2A26` | A faint radial lift behind the card                                   | —         |
| Hairline | `#2C3632` | Rules and outlines (decorative)                                       | 1.4:1     |
| Linen    | `#EEE9DF` | Wordmark and primary text (a warmer relative of Parchment)            | 14.6:1    |
| Muted    | `#A9B2AB` | Secondary text                                                        | 8.1:1     |
| Sage     | `#8FBDAF` | The cool accent and GitHub's color (a lighter relative of Eucalyptus) | 8.5:1     |
| Clay     | `#D08A6E` | The warm accent and GitLab's color (a softer relative of Terracotta)  | 6.3:1     |

The logo mark keeps GitVis's 3×3 tile pattern and its three strengths (35%, 60% and 100%), in
Sage.

**Typography** follows the portfolio's editorial voice:

- **Wordmark:** Lato 700. It keeps GitVis a sans-serif brand.
- **Headline:** Instrument Serif.
- **Body:** Lato 400.
- **Annotations and the footer line:** IBM Plex Mono.

## The card in the preview

The card is GitVis's own rendering of its sample data in the **Sage & Linen** palette, dark mode,
with custom platform colors set to Sage and Clay. Anyone can make it in the studio with this URL:

```
/?layout=data-rich&palette=sage-linen&mode=dark&f=heatmap,total,breakdown,trends,labels&hdr=centered&av=github,gitlab&name=Avery%20Chen&pc=github:8fbdaf,gitlab:d08a6e
```

Then choose "Try it with sample data". Its "Sample data" badge stays visible in the preview.

## The preview image (`docs/images/gitvis-preview.png`)

- **Size:** 1280×640, rendered at 2× (2560×1280).
- **Background:** Ground, with a faint Glow behind the card.
- **Left column:**
  - the logo mark and the wordmark;
  - the headline "Every contribution counts." in Sage;
  - one sentence of description in Muted;
  - a mono footer line: `gitvis.vercel.app · Open source · MIT`.
- **Right side:** the card, scaled to about 75% (640px wide), fully in frame with the Glow behind
  it.
- **Saved as:** an indexed PNG (256 colors), about 100 KB.

To regenerate it, run the studio locally with the URL above, take the card's SVG from the preview,
and set it in the frame. Copy only from GitVis's README and product docs, and never show data other
than the sample.
