"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getWorker,
  getMyAddresses,
  addAddress,
  createBooking,
  ApiError,
  ApiWorkerPublic,
  ApiAddress,
} from "@/lib/api";
import { hourlyRateForCategory } from "@/lib/mappers";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Clock, CheckCircle2, MapPin, Loader2, Plus } from "lucide-react";

const DURATIONS = [2, 3, 4, 6];
const TIME_SLOTS = ["08:00", "09:00", "11:00", "14:00", "16:00", "18:00"];

export default function BookWorkerPage() {
  const params = useParams<{ workerId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [worker, setWorker] = useState<ApiWorkerPublic | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [addresses, setAddresses] = useState<ApiAddress[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [categoryId, setCategoryId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [duration, setDuration] = useState(3);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newLabel, setNewLabel] = useState("Home");
  const [newLine1, setNewLine1] = useState("");
  const [newPincode, setNewPincode] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  useEffect(() => {
    getWorker(params.workerId)
      .then((w) => {
        setWorker(w);
        if (w.skills[0]) setCategoryId(w.skills[0].category_id);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      })
      .finally(() => setLoadingData(false));
  }, [params.workerId]);

  useEffect(() => {
    if (!user) return;
    getMyAddresses().then((addrs) => {
      setAddresses(addrs);
      const def = addrs.find((a) => a.is_default) ?? addrs[0];
      if (def) setAddressId(def.id);
    });
  }, [user]);

  async function handleAddAddress() {
    setAddressError(null);
    if (!newLine1 || newPincode.length !== 6) {
      setAddressError("Enter your address and a valid 6-digit pincode.");
      return;
    }
    setSavingAddress(true);
    try {
      const addr = await addAddress({
        label: newLabel,
        line1: newLine1,
        pincode_code: newPincode,
        // Approximate Siliguri coordinates — refined once the person's
        // precise location/geocoding is wired up.
        latitude: 26.7271,
        longitude: 88.3953,
        is_default: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, addr]);
      setAddressId(addr.id);
      setShowAddAddress(false);
      setNewLine1("");
      setNewPincode("");
    } catch (e) {
      setAddressError(e instanceof ApiError ? e.message : "Couldn't save this address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  }

  if (loadingData || authLoading) {
    return <div className="container py-20 text-center text-muted-foreground">Loading...</div>;
  }

  if (notFound || !worker) {
    return <div className="container py-20 text-center text-muted-foreground">Worker not found.</div>;
  }

  const selectedSkill = worker.skills.find((s) => s.category_id === categoryId) ?? worker.skills[0];
  const rate = selectedSkill?.hourly_rate ?? 0;
  const total = rate * duration;

  async function handleConfirm() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!date || !addressId || !categoryId || !worker) return;
    setSubmitting(true);
    setError(null);
    try {
      const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
      const booking = await createBooking({
        category_id: categoryId,
        address_id: addressId,
        type: "SCHEDULED",
        scheduled_for: scheduledFor,
        duration_hours: duration,
        notes: notes || undefined,
        preferred_worker_id: worker.id,
      });
      setBookingId(booking.id);
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create this booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="container py-24 flex justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
            <h1 className="text-xl font-semibold text-foreground mt-4">Booking confirmed!</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {worker.full_name} is booked for {date} at {time}. We&apos;ve sent the details to your phone.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button variant="gold" asChild>
                <Link href={`/bookings/${bookingId}`}>View booking</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/services">Book another service</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-14">
      <h1 className="text-2xl font-semibold text-foreground mb-8">Confirm your booking</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={worker.photo_url ?? undefined} alt={worker.full_name} />
                <AvatarFallback>{worker.full_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{worker.full_name}</p>
                <p className="text-sm text-muted-foreground">₹{rate}/hr · {worker.city}</p>
              </div>
            </CardContent>
          </Card>

          {worker.skills.length > 1 && (
            <section>
              <Label className="mb-1.5 block">Service</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {worker.skills.map((s) => (
                    <SelectItem key={s.category_id} value={s.category_id}>
                      {s.category_name} — ₹{s.hourly_rate}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          <section>
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Date & time
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <RadioGroup value={String(duration)} onValueChange={(v) => setDuration(Number(v))} className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <label
                      key={d}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        duration === d ? "border-primary bg-accent text-primary font-medium" : "border-input text-muted-foreground"
                      }`}
                    >
                      <RadioGroupItem value={String(d)} className="sr-only" />
                      {d} hrs
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time slot</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      time === slot ? "border-primary bg-accent text-primary font-medium" : "border-input text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Address
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAddress(true)}>
                <Plus className="h-4 w-4" /> Add new
              </Button>
            </div>
            {!user ? (
              <p className="text-sm text-muted-foreground">Log in to choose or add a delivery address.</p>
            ) : addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses yet — add one to continue.</p>
            ) : (
              <RadioGroup value={addressId} onValueChange={setAddressId} className="gap-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      addressId === addr.id ? "border-primary bg-accent" : "border-input"
                    }`}
                  >
                    <RadioGroupItem value={addr.id} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{addr.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          </section>

          <section>
            <Label htmlFor="notes" className="mb-1.5 block">Notes for the worker (optional)</Label>
            <Textarea id="notes" placeholder="Gate code, pets, specific instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </section>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Price summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>₹{rate}/hr × {duration} hrs</span>
                  <span>₹{total}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform fee</span>
                  <span>₹0</span>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between font-semibold text-foreground">
                <span>Total</span>
                <span>₹{total}</span>
              </div>
              {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              <Button
                variant="gold"
                size="lg"
                className="w-full mt-6"
                onClick={handleConfirm}
                disabled={!date || !addressId || submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {user ? "Confirm booking" : "Log in to book"}
              </Button>
              {!date && <p className="text-xs text-muted-foreground mt-2 text-center">Pick a date to continue.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAddAddress} onOpenChange={setShowAddAddress}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-label">Label</Label>
              <Input id="new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Home, Office..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-line1">Address</Label>
              <Input id="new-line1" value={newLine1} onChange={(e) => setNewLine1(e.target.value)} placeholder="House/flat no., street, area" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pincode">Pincode</Label>
              <Input id="new-pincode" value={newPincode} maxLength={6} onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, ""))} placeholder="734001" />
            </div>
            {addressError && <p className="text-sm text-destructive">{addressError}</p>}
          </div>
          <DialogFooter>
            <Button variant="gold" onClick={handleAddAddress} disabled={savingAddress}>
              {savingAddress && <Loader2 className="h-4 w-4 animate-spin" />}
              Save address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
