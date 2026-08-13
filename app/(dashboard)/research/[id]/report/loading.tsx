import { Skeleton } from "@/components/ui/skeleton";

export default function ResearchReportLoading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading the market research report"
    >
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-44 rounded-3xl" />
      <Skeleton className="h-11 rounded-2xl" />
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-52 rounded-3xl" />
      ))}
    </div>
  );
}
