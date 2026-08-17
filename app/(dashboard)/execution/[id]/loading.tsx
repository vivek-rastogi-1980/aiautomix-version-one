import { Skeleton } from "@/components/ui/skeleton";

export default function ExecutionDetailLoading() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-label="Loading execution plan"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-3xl" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-3xl" />
      ))}
    </div>
  );
}
