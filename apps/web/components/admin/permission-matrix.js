import { Check } from "lucide-react";
import { Card, CardHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

const holds = (role, key) => role.permissions.includes("*") || role.permissions.includes(key);

/** Read-only roles × permissions grid for the roles the viewer can see. */
export function PermissionMatrix({ roles, catalog }) {
  return (
    <Card>
      <CardHeader title="Permission matrix" description="Which permissions each role carries. Super Admin holds everything." />
      <Table>
        <THead>
          <TR>
            <TH className="sticky left-0 bg-gray-50">Permission</TH>
            {roles.map((r) => (
              <TH key={r.id} className="whitespace-nowrap text-center">{r.name}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {catalog.permissions.map((p) => (
            <TR key={p.key}>
              <TD className="sticky left-0 bg-white" title={p.description}>
                <span className="font-mono text-[11px] font-semibold text-nu-lapis">{p.key}</span>
              </TD>
              {roles.map((r) => (
                <TD key={r.id} className="text-center">
                  {holds(r, p.key) ? (
                    <Check className="mx-auto size-4 text-emerald-600" aria-label="Granted" />
                  ) : (
                    <span className="text-gray-300" aria-label="Not granted">–</span>
                  )}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
