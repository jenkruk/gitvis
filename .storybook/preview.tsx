import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { type ReactNode, useEffect } from "react";
import { fontVariables } from "../src/app/fonts";
import "../src/app/globals.css";

/**
 * Stories render like the app: the same Geist Sans / Geist Mono setup (src/app/fonts.ts) on
 * <html>, the canvas background and body text. The toolbar's "Theme" switches the studio between
 * the OS scheme, light and dark (data-theme on <html>; tokens are light-dark() pairs).
 */
function StudioFrame({ theme, children }: { theme?: string; children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add(...fontVariables.split(" "), "antialiased");
    if (theme === "light" || theme === "dark") html.dataset.theme = theme;
    else delete html.dataset.theme;
    document.body.classList.add("bg-canvas", "font-sans", "text-body", "text-fg");
  }, [theme]);
  return children;
}

const withStudioFrame: Decorator = (Story, context) => (
  <StudioFrame theme={context.globals.theme as string | undefined}>
    <Story />
  </StudioFrame>
);

const preview: Preview = {
  decorators: [withStudioFrame],
  globalTypes: {
    theme: {
      description: "Studio color scheme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "system" },
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    a11y: {
      test: "error",
      options: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } },
    },
    viewport: {
      options: {
        phoneSmall: { name: "Phone 320", styles: { width: "320px", height: "720px" }, type: "mobile" },
        phone: { name: "Phone 375", styles: { width: "375px", height: "812px" }, type: "mobile" },
        tablet: { name: "Tablet 768", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        desktop: { name: "Desktop 1280", styles: { width: "1280px", height: "900px" }, type: "desktop" },
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
