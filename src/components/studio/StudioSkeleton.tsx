export function StudioSkeleton() {
  const block = "rounded-xl bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800";
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading the studio…
      </p>
      <div aria-hidden="true" className="space-y-2">
        <div className={`${block} h-8 w-3/4 max-w-md`} />
        <div className={`${block} h-4 w-2/3 max-w-sm`} />
      </div>
      <div aria-hidden="true" className={`${block} h-48`} />
      <div aria-hidden="true" className="grid gap-8 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <div className={`${block} h-96 lg:col-start-2 lg:row-start-1`} />
        <div className={`${block} h-96 lg:col-start-1 lg:row-start-1`} />
      </div>
    </div>
  );
}
