"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Button, Card, CardHeader, EmptyState, useToast } from "@/components/ui";
import { DetailsFields, validateDetails } from "@/components/contributions/details-fields";
import { MarkdownEditor } from "@/components/contributions/markdown-editor";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";

const today = () => new Date().toISOString().slice(0, 10);
const TEMPLATE = "## Problem\n\n## Approach\n\n## Who can reuse it\n";
const SLUG = /^[a-z0-9-]+$/;

/** Opened from a practice's or group's Contributions tab (?practice=&group=): go back there, else to the list. */
function returnTo(params) {
  const practice = params.get("practice");
  const group = params.get("group");
  if (!practice || !SLUG.test(practice)) return { href: "/practices/contributions", practice: "" };
  if (group && SLUG.test(group)) return { href: `/practices/${practice}/groups/${group}?tab=contributions`, practice };
  return { href: `/practices/${practice}?tab=contributions`, practice };
}

function NewContribution() {
  const router = useRouter();
  const toast = useToast();
  const back = returnTo(useSearchParams());
  // The list endpoint tells us where the caller may start one (practices.contribution.create).
  const { data, loading } = useResource("/contributions");
  const practices = (data?.practices ?? []).filter((p) => data.canCreateIn.includes(p.id));
  const [form, setForm] = useState({ title: "", practiceId: "", type: "", customType: "", startDate: today(), dueDate: "", description: TEMPLATE });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (form.practiceId) return;
    const preset = practices.find((p) => p.id === back.practice) ?? (practices.length === 1 ? practices[0] : null);
    if (preset) setForm((f) => ({ ...f, practiceId: preset.id }));
  }, [practices, form.practiceId, back.practice]);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateDetails(form, { needPractice: true });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const description = form.description.trim() === TEMPLATE.trim() ? "" : form.description;
      const created = await api("/contributions", { method: "POST", body: { ...form, description } });
      toast(`Started ${created.title}`);
      router.push(`/practices/contributions/${created.id}`);
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  };

  if (loading && !data) return <p className="py-10 text-center text-sm text-nu-muted-teal" role="status">Loading…</p>;
  if (!practices.length) return <EmptyState title="You can't start a contribution" description="You need to be a member of a practice. Ask your Practice Manager." />;

  return (
    <>
      <PageHeader back={{ href: back.href, label: "Contributions" }} title="Start a contribution" description="You'll be the owner. Invite contributors and log progress once it's created." />
      <form onSubmit={submit} className="space-y-6" noValidate>
        <Card>
          <CardHeader title="Details" />
          <DetailsFields value={form} onChange={setForm} errors={errors} practices={practices} />
        </Card>
        <Card>
          <CardHeader title="Description" description="What it is and why it matters. Write Markdown, or import a Word (.docx) or Markdown document — formatting is kept." />
          <MarkdownEditor id="c-description" value={form.description} onChange={(description) => setForm((f) => ({ ...f, description }))} rows={14} maxLength={200000} />
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.push(back.href)}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Start contribution
          </Button>
        </div>
      </form>
    </>
  );
}

export default function NewContributionPage() {
  return (
    <PortalShell requires={["practices.contribution.create"]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices", href: "/practices" }, { label: "Contributions", href: "/practices/contributions" }, { label: "New" }]}>
      <Suspense>
        <NewContribution />
      </Suspense>
    </PortalShell>
  );
}
