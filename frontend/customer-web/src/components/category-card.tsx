import Link from "next/link";
import { ServiceCategory } from "@/lib/types";
import { ICON_MAP } from "@/lib/icon-map";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

export function CategoryCard({ category }: { category: ServiceCategory }) {
  const Icon = ICON_MAP[category.iconKey];
  return (
    <Link href={`/services/${category.slug}`} className="group block h-full">
      <Card className="h-full transition-all duration-200 hover:shadow-popover hover:-translate-y-0.5 hover:border-gold-300">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-start justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-secondary">
              {Icon && <Icon className="h-5 w-5" />}
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <h3 className="mt-4 font-semibold text-foreground">{category.name}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed flex-1">{category.description}</p>
          <p className="mt-4 text-sm font-medium text-primary">From ₹{category.baseHourlyRate}/hr</p>
        </CardContent>
      </Card>
    </Link>
  );
}
