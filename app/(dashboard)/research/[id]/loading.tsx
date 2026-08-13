import { Skeleton } from "@/components/ui/skeleton";

export default function ResearchDetailLoading() {
  return (
    <div
      className="flex flex-col gap-8"
      role="status"
      aria-label="Loading research project"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="h-56 rounded-3xl" />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-44" />
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
