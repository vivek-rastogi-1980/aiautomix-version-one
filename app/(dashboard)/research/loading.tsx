import { Skeleton } from "@/components/ui/skeleton";

export default function ResearchLoading() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-label="Loading market research"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
