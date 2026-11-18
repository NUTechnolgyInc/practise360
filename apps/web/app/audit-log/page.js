"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Loader2 } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Button, Card, CardFooter, EmptyState } from "@/components/ui";
import { AuditFilters } from "@/components/admin/audit-filters";
import { AuditTable } from "@/components/admin/audit-table";
import { useResource } from "@/hooks/use-resource";
import { auditQuery, EMPTY_AUDIT_FILTERS } from "@/lib/audit";
import { AUDIT_VIEW_PERM } from "@/lib/can";

/** Typing in search waits this long before asking the API again. */
const SEARCH_DELAY_MS = 300;

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function AuditLog() {
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [page, setPage] = useState(1);
  const q = useDebounced(filters.q, SEARCH_DELAY_MS);
  const { data, loading, error } = useResource(auditQuery({ ...filters, q }, page));

  const changeFilters = (next) => {
    setFilters(next);
    setPage(1);
  };
  const entries = data?.entries ?? [];
  const first = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? first + entries.length - 1 : 0;
  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Audit log" description="Every change and sign-in across Practise360, newest first — including attempts that were refused. Entries can't be edited or deleted." />
      <Card className="space-y-4">
        <AuditFilters value={filters} onChange={changeFilters} options={data?.filters} />
        {error ? (
          <EmptyState title="Couldn't load the audit log" description={error} />
        ) : !data ? (
          <div className="flex items-center justify-center p-12 text-nu-muted-teal" role="status">
            <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading audit log…
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={History} title="Nothing recorded here" description="No actions match these filters. Changes and sign-ins appear as soon as they happen." />
        ) : (
          <div aria-busy={loading}>
            <AuditTable entries={entries} names={data.names} />
            <CardFooter className="flex-col gap-3 sm:flex-row">
              <p className="text-xs text-nu-muted-teal" aria-live="polite">
                Showing {first.toLocaleString("en-GB")}–{last.toLocaleString("en-GB")} of {data.total.toLocaleString("en-GB")}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading}>
                  <ChevronLeft aria-hidden="true" /> Newer
                </Button>
                <span className="text-xs text-nu-muted-teal">Page {data.page} of {lastPage}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= lastPage || loading}>
                  Older <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </CardFooter>
          </div>
        )}
      </Card>
    </>
  );
}

export default function AuditLogPage() {
  return (
    <PortalShell requires={[AUDIT_VIEW_PERM]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Audit log" }]}>
      <AuditLog />
    </PortalShell>
  );
}
