"use client";

import { useState } from "react";
import { BookOpen, Loader2, Pencil } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Markdown } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { useResource } from "@/hooks/use-resource";
import { formatDate } from "@/lib/format";
import { EditOverviewModal } from "./edit-overview-modal";
import { OverviewFiles } from "./overview-files";

// Wording that differs between a practice's Overview and a group's.
const COPY = {
  practice: {
    invite: "Add what people should know: what the practice does, ways of working, key links and who to ask.",
    waiting: "Your Manager hasn't written an overview yet.",
  },
  group: {
    invite: "Add what people should know: what the group works on, ways of working, key links and who to ask.",
    waiting: "The group's Lead hasn't written an overview yet.",
  },
};

/**
 * Key information and files of a practice or (`subject="group"`) a group, read from `path` (its `/overview` route).
 * Everyone in the practice reads it; the API's `canEdit` adds editing. `name` titles the edit dialog.
 */
export function OverviewTab({ path, name, subject = "practice" }) {
  const { data, setData, loading, error } = useResource(path);
  const [editing, setEditing] = useState(false);

  if (loading && !data) {
    return (
      <p className="flex items-center justify-center py-12 text-sm text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading overview…
      </p>
    );
  }
  if (error) return <EmptyState title="Couldn't load the overview" description={error} />;

  const { body, canEdit, updatedAt, updatedBy } = data;
  const setFiles = (update) => setData((d) => ({ ...d, files: update(d.files) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader
          title={`About this ${subject}`}
          description={
            updatedAt && body ? (
              <>
                Updated {formatDate(updatedAt)}
                {updatedBy && <> by <PersonLink person={updatedBy} className="font-semibold" /></>}
              </>
            ) : undefined
          }
          actions={
            canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Edit overview
              </Button>
            )
          }
        />
        {body ? (
          <Markdown>{body}</Markdown>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Nothing here yet"
            description={canEdit ? COPY[subject].invite : COPY[subject].waiting}
            className="border-none p-6"
          />
        )}
      </Card>
      <OverviewFiles filesPath={`${path}/files`} subject={subject} files={data.files} canEdit={canEdit} setFiles={setFiles} />
      <EditOverviewModal
        open={editing}
        path={path}
        name={name}
        subject={subject}
        body={body}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          setData(updated);
          setEditing(false);
        }}
      />
    </div>
  );
}
