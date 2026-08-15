import { getCategories } from "@/lib/api";
import { toServiceCategory } from "@/lib/mappers";
import { CategoryCard } from "@/components/category-card";

export default async function ServicesPage() {
  const apiCategories = await getCategories();
  const categories = apiCategories.map(toServiceCategory);

  return (
    <div className="container py-14">
      <div className="max-w-xl mb-10">
        <h1 className="text-3xl font-semibold text-foreground">All services</h1>
        <p className="mt-2 text-muted-foreground">
          Choose a service to see verified, available workers near you in Siliguri.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
}
