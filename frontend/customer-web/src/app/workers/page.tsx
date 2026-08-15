"use client";

import { useEffect, useMemo, useState } from "react";
import { getCategories, getWorkers, ApiServiceCategory, ApiWorkerPublic } from "@/lib/api";
import { toServiceCategory, toWorkerSummary } from "@/lib/mappers";
import { WorkerCard } from "@/components/worker-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export default function WorkersPage() {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [apiCategories, setApiCategories] = useState<ApiServiceCategory[]>([]);
  const [apiWorkers, setApiWorkers] = useState<ApiWorkerPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCategories(), getWorkers()])
      .then(([cats, workers]) => {
        setApiCategories(cats);
        setApiWorkers(workers);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => apiCategories.map(toServiceCategory), [apiCategories]);
  const workers = useMemo(() => apiWorkers.map(toWorkerSummary), [apiWorkers]);

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      const matchesCategory = category === "all" || w.categorySlugs.includes(category);
      const matchesQuery = w.fullName.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [workers, category, query]);

  return (
    <div className="container py-14">
      <div className="max-w-xl mb-8">
        <h1 className="text-3xl font-semibold text-foreground">Find help</h1>
        <p className="mt-2 text-muted-foreground">Browse verified workers and book instantly.</p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={category} onValueChange={setCategory}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c.slug} value={c.slug}>
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No workers match your search.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((w) => (
            <WorkerCard key={w.id} worker={w} />
          ))}
        </div>
      )}
    </div>
  );
}
