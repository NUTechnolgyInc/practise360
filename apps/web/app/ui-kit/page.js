"use client";

import { useState } from "react";
import { Award, Cpu, LayoutGrid, Plus, Send, Users } from "lucide-react";
import { AppShell, HeroBanner, PageHeader } from "@/components/layout";
import {
  Avatar, Badge, Button, Card, CardFooter, CardHeader, EmailChip, EmailChipsInput, EmptyState, Field, Input, Markdown, Modal, NoAccess, Progress,
  Select, StatsToggle, StatTile, StatusBadge, Table, TBody, TD, TH, THead, TR, Tabs, Textarea, UserChip, useToast,
} from "@/components/ui";

// Living reference for docs/ui-guidelines.md. Synthetic data only.
const NAV = [
  { href: "/", label: "App Launcher", icon: LayoutGrid },
  { href: "/ui-kit", label: "UI Kit", icon: Award },
  { href: "/practices", label: "Practices", icon: Users },
  { href: "/ai-tracker", label: "AI Tracker", icon: Cpu },
];

const USER = {
  name: "Dana Demo",
  username: "dana.demo",
  assignments: [
    { role: "Practice Lead", scope: "qa" },
    { role: "AI Member", scope: "ai-tracker" },
  ],
};

const MARKDOWN_SAMPLE = "## sample-shared-lib\nA **reusable** library with `one` entry point.\n\n- Works across projects\n- [Docs](https://example.com)\n\n| Option | Default |\n|---|---|\n| retries | 3 |";

const PLANS = [
  { id: 1, who: "Sam Sample", cert: "Cloud Architect Associate", status: "In Progress", progress: 65 },
  { id: 2, who: "Riley Test", cert: "Kubernetes Administrator", status: "Completed", progress: 100 },
  { id: 3, who: "Jordan Fake", cert: "Terraform Associate", status: "Overdue", progress: 40 },
  { id: 4, who: "Casey Mock", cert: "Test Automation Foundation", status: "Lead review", progress: 100 },
];

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader title={title} />
      {children}
    </Card>
  );
}

export default function UiKitPage() {
  const [tab, setTab] = useState("buttons");
  const [modalOpen, setModalOpen] = useState(false);
  const [statsShown, setStatsShown] = useState(true);
  const [emails, setEmails] = useState(["sam.sample@example.com", "riley.test@example.com", "not-an-email"]);
  const toast = useToast();

  return (
    <AppShell
      navItems={NAV}
      user={USER}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "UI Kit" }]}
      onSignOut={() => toast("Signed out (demo)", "info")}
    >
      <HeroBanner eyebrow="Design system" title="Practise360 UI Kit">
        Every primitive and layout component, rendered with synthetic data. See docs/ui-guidelines.md.
      </HeroBanner>

      <PageHeader
        title="Page header"
        description="Title, description and the page's actions or tabs"
        back={{ href: "/", label: "Back to apps" }}
        meta={<Badge variant="purple" className="font-mono">qa</Badge>}
        actions={
          <Tabs
            aria-label="Kit sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "buttons", label: "Buttons" },
              { value: "data", label: "Data" },
              { value: "states", label: "States" },
            ]}
          />
        }
      />

      {tab === "buttons" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Buttons">
            <div className="flex flex-wrap gap-2">
              <Button><Plus /> Primary</Button>
              <Button variant="secondary"><Send /> Secondary</Button>
              <Button variant="dark">Dark</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </Section>
          <Section title="Badges">
            <div className="flex flex-wrap gap-2">
              {["neutral", "primary", "purple", "success", "warning", "danger", "teal"].map((v) => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Recommended", "Planned", "Lead review", "Clarification needed", "Completed", "Dropped", "Overdue", "Expired", "PoC", "Production"].map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
            </div>
          </Section>
          <Section title="Form + modal + toast">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              <Button variant="secondary" onClick={() => toast("Saved")}>Success toast</Button>
              <Button variant="secondary" onClick={() => toast("Something failed", "error")}>Error toast</Button>
            </div>
          </Section>
          <Section title="Email chips (bulk invite)">
            <Field id="kit-emails" label="Emails" hint="Comma, Enter, leaving the field or pasting a list makes chips. Backspace in the empty field removes the last one.">
              {(p) => <EmailChipsInput {...p} value={emails} onChange={setEmails} max={50} />}
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <EmailChip email="jordan.fake@example.com" />
              <EmailChip email="casey@" error="Not a valid email address" />
            </div>
          </Section>
          <Card interactive>
            <CardHeader title="Interactive card" description="Lifts on hover — use for launcher / directory tiles" />
            <CardFooter>
              <span className="text-xs font-bold text-nu-navy">4 active practices</span>
              <span className="text-xs font-bold text-nu-purple">Open app →</span>
            </CardFooter>
          </Card>
        </div>
      )}

      {tab === "data" && (
        <>
          {/* Pages pair StatsToggle with useShowStats(): tiles start hidden and the choice applies on every page. */}
          <StatsToggle shown={statsShown} onToggle={() => setStatsShown((v) => !v)} controls="kit-stats" />
          <div id="kit-stats" hidden={!statsShown} className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Members" value={12} />
            <StatTile label="Completed" value={8} tone="success" />
            <StatTile label="Custom roles" value={1} tone="info" />
            <StatTile label="Overdue" value={2} tone="danger" hint="Past target date" />
          </div>
          <Section title="Table">
            <Table>
              <THead>
                <tr><TH>Practitioner</TH><TH>Certification</TH><TH>Status</TH><TH className="w-40">Progress</TH></tr>
              </THead>
              <TBody>
                {PLANS.map((p) => (
                  <TR key={p.id}>
                    <TD><UserChip name={p.who} size="sm" /></TD>
                    <TD className="font-medium text-nu-lapis">{p.cert}</TD>
                    <TD><StatusBadge status={p.status} /></TD>
                    <TD><Progress value={p.progress} showValue={false} aria-label={`${p.cert} progress`} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Section>
          {/* App screens use PersonChip / PersonLink (components/people), which fill `href` with the person's profile. */}
          <Section title="People">
            <div className="flex flex-wrap items-center gap-6">
              <Avatar name="Dana Demo" size="xl" />
              <UserChip name="Dana Demo" subtitle="dana.demo" size="lg" />
              <UserChip name="Sam Sample" subtitle="Links to a profile" href="/ui-kit" />
            </div>
          </Section>
          <Section title="Markdown">
            <Markdown>{MARKDOWN_SAMPLE}</Markdown>
          </Section>
        </>
      )}

      {tab === "states" && (
        <div className="grid gap-6 md:grid-cols-2">
          <EmptyState title="No certifications yet" description="Add one from the catalog to start tracking." action={<Button size="sm"><Plus /> Add from catalog</Button>} />
          <NoAccess />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Suggest certification"
        description="The practitioner can accept or decline"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="suggest-form">Send suggestion</Button>
          </>
        }
      >
        <form
          id="suggest-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setModalOpen(false);
            toast("Suggestion sent");
          }}
        >
          <Field id="member" label="Member">
            {(a11y) => (
              <Select {...a11y} required defaultValue="">
                <option value="" disabled>Choose member</option>
                {PLANS.map((p) => <option key={p.id}>{p.who}</option>)}
              </Select>
            )}
          </Field>
          <Field id="target" label="Target date" hint="Leave blank for no deadline">
            {(a11y) => <Input {...a11y} type="date" />}
          </Field>
          <Field id="note" label="Note" error="Keep it under 200 characters">
            {(a11y) => <Textarea {...a11y} placeholder="Why this certification?" />}
          </Field>
        </form>
      </Modal>
    </AppShell>
  );
}
