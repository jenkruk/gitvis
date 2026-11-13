import { studioControlsColumn, studioGrid, studioPreviewColumn } from "@/components/ui/recipes";

/**
 * The studio's loading state, drawn in the shapes of the Design step it becomes: the step
 * navigation, the step title and lede, then controls on the left and the preview on the right.
 */
export function StudioSkeleton() {
  const block = "rounded-control bg-surface-hover motion-safe:animate-pulse";
  return (
    <div className="space-y-8" aria-busy="true">
      <p role="status" className="sr-only">
        Loading the studio…
      </p>
      <div aria-hidden="true" className="flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`${block} size-7 rounded-full`} />
            <div className={`${block} h-4 w-16`} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="space-y-2.5">
        <div className={`${block} h-8 w-64 max-w-full`} />
        <div className={`${block} h-4 w-96 max-w-full`} />
      </div>
      <div aria-hidden="true" className={studioGrid}>
        <div className={`${studioPreviewColumn} space-y-2`}>
          <div className={`${block} h-9 w-72 max-w-full`} />
          <div className={`${block} aspect-[840/420] rounded-stage`} />
        </div>
        <div className={`${studioControlsColumn} space-y-7`}>
          <div className="space-y-2.5">
            <div className={`${block} h-5 w-24`} />
            <div className={`${block} h-[4.5rem] rounded-card`} />
            <div className={`${block} h-[4.5rem] rounded-card`} />
          </div>
          <div className="space-y-2.5">
            <div className={`${block} h-5 w-20`} />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`${block} h-[4.5rem] rounded-card`} />
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            <div className={`${block} h-5 w-20`} />
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`${block} h-[4.75rem] rounded-card`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
