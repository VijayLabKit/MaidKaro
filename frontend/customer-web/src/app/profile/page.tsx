"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { getMyAddresses, addAddress, ApiAddress, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Phone, LogOut, Plus, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useRequireAuth();
  const { logout } = useAuth();
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyAddresses()
      .then(setAddresses)
      .finally(() => setLoadingAddresses(false));
  }, [user]);

  async function handleAdd() {
    setError(null);
    if (!line1 || pincode.length !== 6) {
      setError("Enter your address and a valid 6-digit pincode.");
      return;
    }
    setSaving(true);
    try {
      const addr = await addAddress({
        label,
        line1,
        pincode_code: pincode,
        latitude: 26.7271,
        longitude: 88.3953,
        is_default: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, addr]);
      setShowAdd(false);
      setLine1("");
      setPincode("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save this address. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="container py-14 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-14 max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Profile</h1>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{user.fullName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg text-foreground">{user.fullName}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Phone className="h-3.5 w-3.5" /> +91 {user.phone}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Saved addresses</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> Add new
            </Button>
          </div>
          {loadingAddresses ? (
            <Skeleton className="h-16 w-full" />
          ) : addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {addr.label} {addr.is_default && <span className="text-xs text-primary font-normal">(default)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={logout}>
        <LogOut className="h-4 w-4" /> Log out
      </Button>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-label">Label</Label>
              <Input id="p-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Office..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-line1">Address</Label>
              <Input id="p-line1" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="House/flat no., street, area" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pincode">Pincode</Label>
              <Input id="p-pincode" value={pincode} maxLength={6} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))} placeholder="734001" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="gold" onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
