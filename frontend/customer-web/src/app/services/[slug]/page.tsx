import { notFound } from "next/navigation";
import { ICON_MAP } from "@/lib/icon-map";
import { getCategories, getWorkers } from "@/lib/api";
import { toServiceCategory, toWorkerSummary } from "@/lib/mappers";
import { WorkerCard } from "@/components/worker-card";

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const apiCategories = await getCategories();
  const apiCategory = apiCategories.find((c) => c.slug === slug);
  if (!apiCategory) notFound();
  const category = toServiceCategory(apiCategory);

  const apiWorkers = await getWorkers({ categoryId: apiCategory.id });
  const workers = apiWorkers.map(toWorkerSummary);
  const Icon = ICON_MAP[category.iconKey];

  return (
    <div className="container py-14">
      <div className="flex items-start gap-4 mb-10">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-secondary">
          {Icon && <Icon className="h-6 w-6" />}
        </span>
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{category.name}</h1>
          <p className="mt-2 text-muted-foreground max-w-xl">{category.description}</p>
          <p className="mt-2 text-sm font-medium text-primary">Starting from ₹{category.baseHourlyRate}/hr</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">
        {workers.length} worker{workers.length !== 1 ? "s" : ""} available
      </h2>
      {workers.length === 0 ? (
        <p className="text-muted-foreground">No workers available in this category right now — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {workers.map((w) => (
            <WorkerCard key={w.id} worker={w} />
          ))}
        </div>
      )}
    </div>
  );
}
