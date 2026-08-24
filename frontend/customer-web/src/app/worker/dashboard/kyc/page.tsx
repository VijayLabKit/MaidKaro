"use client";

import { useEffect, useRef, useState } from "react";
import {
  getWorkerKycProfile, updateWorkerKycProfile, uploadWorkerKycDocument, submitWorkerKycForReview,
  uploadFile, WorkerKycProfile, ApiError,
} from "@/lib/worker-api";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, CheckCircle2, Upload, FileCheck2, AlertTriangle } from "lucide-react";

const REQUIRED_DOCS = [
  { type: "GOVERNMENT_ID", label: "Government ID (Aadhaar / Voter ID / PAN)" },
  { type: "ADDRESS_PROOF", label: "Address proof" },
];
const OPTIONAL_DOCS = [
  { type: "POLICE_VERIFICATION", label: "Police verification certificate" },
  { type: "PROFILE_PHOTO", label: "Profile photo" },
];

export default function WorkerKycPage() {
  const { refreshWorker } = useWorkerAuth();
  const [kyc, setKyc] = useState<WorkerKycProfile | null>(null);
  const [form, setForm] = useState({
    guardian_name: "", date_of_birth: "", gender: "", address_line: "",
    kyc_city: "", kyc_state: "", kyc_pincode: "", qualification: "", previous_experience: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    const profile = await getWorkerKycProfile();
    setKyc(profile);
    setForm({
      guardian_name: profile.guardian_name ?? "",
      date_of_birth: profile.date_of_birth ?? "",
      gender: profile.gender ?? "",
      address_line: profile.address_line ?? "",
      kyc_city: profile.kyc_city ?? "",
      kyc_state: profile.kyc_state ?? "",
      kyc_pincode: profile.kyc_pincode ?? "",
      qualification: profile.qualification ?? "",
      previous_experience: profile.previous_experience ?? "",
    });
  }

  useEffect(() => {
    load();
  }, []);

  const isEditable = kyc && (kyc.verification_status === "NOT_SUBMITTED" || kyc.verification_status === "NEEDS_RESUBMISSION");

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateWorkerKycProfile({
        guardian_name: form.guardian_name || undefined,
        date_of_birth: form.date_of_birth || undefined,
        gender: form.gender || undefined,
        address_line: form.address_line,
        kyc_city: form.kyc_city,
        kyc_state: form.kyc_state,
        kyc_pincode: form.kyc_pincode,
        qualification: form.qualification || undefined,
        previous_experience: form.previous_experience || undefined,
      });
      setKyc(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelected(docType: string, file: File | undefined) {
    if (!file) return;
    setUploadingType(docType);
    setError(null);
    try {
      const { file_url } = await uploadFile(file);
      await uploadWorkerKycDocument(docType, file_url);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't upload this document.");
    } finally {
      setUploadingType(null);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitWorkerKycForReview();
      setKyc(updated);
      await refreshWorker();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't submit for review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!kyc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const submittedDocTypes = new Set(kyc.documents.map((d) => d.type));
  const missingRequired = REQUIRED_DOCS.filter((d) => !submittedDocTypes.has(d.type));
  const canSubmit = isEditable && missingRequired.length === 0 &&
    form.address_line && form.kyc_city && form.kyc_state && /^\d{6}$/.test(form.kyc_pincode);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Verification (KYC)</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Complete your profile and upload documents to get verified.</p>
      </div>

      {kyc.verification_status === "REJECTED" && kyc.verification_note && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Verification not approved</p>
              <p className="text-sm text-red-700/80 mt-0.5">{kyc.verification_note}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {kyc.verification_status === "NEEDS_RESUBMISSION" && kyc.verification_note && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700">Resubmission needed</p>
              <p className="text-sm text-amber-700/80 mt-0.5">{kyc.verification_note}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Personal information</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Guardian name (Father/Mother/Husband)</Label>
              <Input disabled={!isEditable} value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date of birth</Label>
              <Input type="date" disabled={!isEditable} value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} disabled={!isEditable}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Qualification</Label>
              <Input disabled={!isEditable} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. Class 10 pass" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Full residential address *</Label>
            <Textarea disabled={!isEditable} value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} rows={2} />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input disabled={!isEditable} value={form.kyc_city} onChange={(e) => setForm({ ...form, kyc_city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>State *</Label>
              <Input disabled={!isEditable} value={form.kyc_state} onChange={(e) => setForm({ ...form, kyc_state: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>PIN code *</Label>
              <Input disabled={!isEditable} maxLength={6} value={form.kyc_pincode} onChange={(e) => setForm({ ...form, kyc_pincode: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Previous work experience</Label>
            <Textarea disabled={!isEditable} value={form.previous_experience} onChange={(e) => setForm({ ...form, previous_experience: e.target.value })} rows={3} />
          </div>
          {isEditable && (
            <div className="flex items-center gap-3">
              <Button variant="gold" onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save profile
              </Button>
              {saved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Identity & address documents</h2>
          <div className="space-y-3">
            {[...REQUIRED_DOCS, ...OPTIONAL_DOCS].map((doc) => {
              const uploaded = kyc.documents.find((d) => d.type === doc.type);
              const required = REQUIRED_DOCS.some((r) => r.type === doc.type);
              return (
                <div key={doc.type} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.label} {required && <span className="text-red-500">*</span>}</p>
                    {uploaded && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                        <Badge variant={uploaded.status === "APPROVED" ? "success" : uploaded.status === "REJECTED" ? "destructive" : "gold"} className="text-[10px]">
                          {uploaded.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {isEditable && (
                    <>
                      <input
                        ref={(el) => { fileInputs.current[doc.type] = el; }}
                        type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                        onChange={(e) => handleFileSelected(doc.type, e.target.files?.[0])}
                      />
                      <Button
                        size="sm" variant="outline"
                        disabled={uploadingType === doc.type}
                        onClick={() => fileInputs.current[doc.type]?.click()}
                      >
                        {uploadingType === doc.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {uploaded ? "Replace" : "Upload"}
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isEditable && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ready to submit?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {missingRequired.length > 0
                  ? `Missing: ${missingRequired.map((d) => d.label).join(", ")}`
                  : "All required information and documents are complete."}
              </p>
            </div>
            <Button variant="gold" disabled={!canSubmit || submitting} onClick={handleSubmitForReview}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
