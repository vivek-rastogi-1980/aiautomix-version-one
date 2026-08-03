import { Skeleton } from "@/components/ui/skeleton";

export default function ReportLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading report"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-64 rounded-3xl" />
      <Skeleton className="h-11 rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
