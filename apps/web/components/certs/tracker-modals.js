"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { AddPlanModal } from "./add-plan-modal";
import { AssignModal } from "./assign-modal";
import { CatalogModal } from "./catalog-modal";
import { ConfirmModal } from "./confirm-modal";
import { api } from "@/lib/api";
import { plansPath } from "@/lib/certifications";

const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;

/**
 * Every modal the tracker's list page opens. `modal` = { kind: "add" | "assign" | "catalog" | "retire", item? }.
 * Each one calls the API, reports with a toast and refreshes what it changed.
 */
export function TrackerModals({ modal, onClose, me, catalogItems, planPractices, givePractices, reloadPlans, reloadCatalog }) {
  const router = useRouter();
  const toast = useToast();
  const kind = modal?.kind;
  const item = modal?.item;

  const call = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  };

  const addPlan = (body) =>
    call(async () => {
      const plan = await api("/certifications/plans", { method: "POST", body });
      toast("Plan added");
      router.push(plansPath(plan.id));
      return true;
    });

  const assign = (body) =>
    call(async () => {
      const { created, skipped } = await api("/certifications/assignments", { method: "POST", body });
      if (created.length) toast(`${body.mode === "assign" ? "Assigned" : "Recommended"} to ${people(created.length)}`);
      if (skipped.length) toast(`Skipped ${skipped.map((s) => `${s.user.displayName} (${s.reason.toLowerCase()})`).join(", ")}`, created.length ? undefined : "error");
      reloadPlans();
      if (body.cert) reloadCatalog();
      return created.length > 0;
    });

  const saveCatalog = (form) =>
    call(async () => {
      await api(item ? `/certifications/catalog/${item.id}` : "/certifications/catalog", { method: item ? "PATCH" : "POST", body: form });
      toast(item ? "Catalog entry saved" : `${form.title} added to the catalog`);
      reloadCatalog();
      return true;
    });

  const toggleActive = () =>
    call(async () => {
      await api(`/certifications/catalog/${item.id}`, { method: "PATCH", body: { isActive: !item.isActive } });
      toast(item.isActive ? `${item.title} retired` : `${item.title} restored`);
      reloadCatalog();
      return true;
    });

  return (
    <>
      <AddPlanModal open={kind === "add"} onClose={onClose} catalog={catalogItems} practices={planPractices} presetId={item?.id} onSubmit={addPlan} />
      <AssignModal open={kind === "assign"} onClose={onClose} catalog={catalogItems} practices={givePractices} presetId={item?.id} meId={me.id} onSubmit={assign} />
      <CatalogModal open={kind === "catalog"} onClose={onClose} item={item} onSubmit={saveCatalog} />
      <ConfirmModal
        open={kind === "retire"}
        onClose={onClose}
        title={item?.isActive ? `Retire ${item?.title}?` : `Restore ${item?.title}?`}
        body={item?.isActive ? "It disappears from the pickers. Plans that already use it keep it." : "It can be picked for new plans again."}
        confirmLabel={item?.isActive ? "Retire" : "Restore"}
        danger={!!item?.isActive}
        onConfirm={toggleActive}
      />
    </>
  );
}
