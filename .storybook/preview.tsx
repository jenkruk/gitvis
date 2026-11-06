import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    // Fail the a11y panel (and test runs) on any axe violation, matching our WCAG 2.2 AA gate.
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
