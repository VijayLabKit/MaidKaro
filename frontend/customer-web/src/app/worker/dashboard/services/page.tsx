"use client";

import { useEffect, useState } from "react";
import { Sparkles, Check, Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getCategoriesPublic, getMySkills, setMySkills, ApiCategorySimple, WorkerSkillItem, ApiError } from "@/lib/worker-api";

export default function WorkerServicesPage() {
  const [categories, setCategories] = useState<ApiCategorySimple[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<{ [catId: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [cats, mySkills] = await Promise.all([
          getCategoriesPublic(),
          getMySkills(),
        ]);
        setCategories(cats);

        const skillsMap: { [catId: string]: number } = {};
        mySkills.forEach((s) => {
          const matchingCat = cats.find((c) => c.id === s.category_id);
          skillsMap[s.category_id] = s.hourly_rate ?? (matchingCat ? matchingCat.base_hourly_rate : 200);
        });

        // If newly registered and no skills saved yet, select first category
        if (mySkills.length === 0 && cats.length > 0) {
          skillsMap[cats[0].id] = cats[0].base_hourly_rate;
        }

        setSelectedSkills(skillsMap);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load services");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  function toggleSkill(catId: string, baseRate: number) {
    setSelectedSkills((prev) => {
      const next = { ...prev };
      if (next[catId] !== undefined) {
        delete next[catId];
      } else {
        next[catId] = baseRate;
      }
      return next;
    });
    setSavedSuccess(false);
  }

  function updateRate(catId: string, rate: number) {
    setSelectedSkills((prev) => ({
      ...prev,
      [catId]: rate,
    }));
    setSavedSuccess(false);
  }

  async function handleSave() {
    setError(null);
    setSavedSuccess(false);

    if (Object.keys(selectedSkills).length === 0) {
      setError("Please enable at least one service category.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = Object.entries(selectedSkills).map(([category_id, hourly_rate]) => ({
        category_id,
        hourly_rate: Number(hourly_rate) || 200,
      }));
      await setMySkills(payload);
      setSavedSuccess(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save services");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services &amp; Hourly Rates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure the services you offer to customers and customize your hourly rates (₹/hr).
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="shrink-0 font-semibold gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Your services and hourly rates have been updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Available Service Categories</CardTitle>
          <CardDescription className="text-xs">
            Toggle which services you are trained and ready to perform. You will appear in customer searches for all enabled services once KYC verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3.5">
            {categories.map((cat) => {
              const isSelected = selectedSkills[cat.id] !== undefined;
              const currentRate = selectedSkills[cat.id] ?? cat.base_hourly_rate;

              return (
                <div
                  key={cat.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                      : "border-border/70 bg-card/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSkill(cat.id, cat.base_hourly_rate)}
                        className={`h-6 w-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground shadow-xs"
                            : "border-muted-foreground/40 bg-background"
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{cat.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{cat.description}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1">Platform baseline: ₹{cat.base_hourly_rate}/hr</p>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-border/70 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Your Hourly Rate:</span>
                      <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 shadow-2xs">
                        <span className="text-xs font-bold text-muted-foreground">₹</span>
                        <input
                          type="number"
                          min={50}
                          max={5000}
                          step={10}
                          value={currentRate}
                          onChange={(e) => updateRate(cat.id, Number(e.target.value))}
                          className="w-16 text-sm font-bold text-foreground bg-transparent outline-none text-right"
                        />
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
