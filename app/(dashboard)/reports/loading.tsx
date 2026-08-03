import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-label="Loading reports"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
