/** Browser-only helpers for downloading the published card as SVG or PNG. */

export class CardDownloadError extends Error {}

/** Fetches the exact published SVG (same endpoint GitHub uses). */
export async function fetchPublishedSvg(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new CardDownloadError(`The image endpoint responded with ${res.status}.`);
  const status = res.headers.get("X-GitVis-Status");
  if (status && status !== "ok") {
    throw new CardDownloadError("The published image is currently an error card, so there's nothing to download yet.");
  }
  return res.text();
}

export function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(href), 1_000);
}

/** Rasterizes an SVG string at `scale`× on a canvas (no dependencies; system fonts only). */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new CardDownloadError("This browser can't create PNG images.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new CardDownloadError("PNG encoding failed."))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
