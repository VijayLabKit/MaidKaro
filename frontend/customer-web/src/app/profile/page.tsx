"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useAuth } from "@/lib/auth-context";
import { getMyAddresses, addAddress, updateMyProfile, ApiAddress, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Phone, Mail, User, LogOut, Plus, Edit2, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useRequireAuth();
  const { logout, refreshUser } = useAuth();
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // Address dialog state
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile edit dialog state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setEditName(user.fullName);
    setEditEmail(user.email || "");
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

  async function handleUpdateProfile() {
    setProfileError(null);
    if (!editName.trim()) {
      setProfileError("Please enter your name.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateMyProfile({
        full_name: editName.trim(),
        email: editEmail.trim() || undefined,
      });
      await refreshUser();
      setShowEditProfile(false);
    } catch (e) {
      setProfileError(e instanceof ApiError ? e.message : "Couldn't update profile. Please try again.");
    } finally {
      setSavingProfile(false);
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
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 bg-primary text-white">
              <AvatarFallback className="text-xl bg-primary text-white">{user.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-semibold text-lg text-foreground">{user.fullName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> +91 {user.phone}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {user.email || <span className="italic text-muted-foreground/70">No email added</span>}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)} className="self-start sm:self-center">
            <Edit2 className="h-4 w-4 mr-1.5" /> Edit Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Saved addresses</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add new
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
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
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
        <LogOut className="h-4 w-4 mr-1.5" /> Log out
      </Button>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ep-name">Full name</Label>
              <Input
                id="ep-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Ananya Sharma"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-email">Email address</Label>
              <Input
                id="ep-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="e.g. ananya@example.com"
              />
              <p className="text-xs text-muted-foreground">Used for sending booking confirmations, receipts, and invoice summaries.</p>
            </div>
            {profileError && <p className="text-sm text-destructive">{profileError}</p>}
          </div>
          <DialogFooter>
            <Button variant="gold" onClick={handleUpdateProfile} disabled={savingProfile}>
              {savingProfile && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Address Dialog */}
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
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
