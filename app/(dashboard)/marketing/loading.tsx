import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingsLoading() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-label="Loading marketing plans"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
