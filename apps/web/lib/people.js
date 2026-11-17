// People profiles (/people/:id). The API decides what each viewer sees; these are display helpers only.

export const profilePath = (id) => `/people/${id}`;

/** "Practitioner · Digital Engineering" style labels for every visible role, practice roles first. */
export function roleLabels(profile) {
  return [
    ...profile.practices.flatMap((p) => [...p.roles.map((r) => `${r} · ${p.name}`), ...p.groupRoles.map((g) => `${g.role} · ${p.name} ${g.group.name}`)]),
    ...profile.appRoles.map((r) => r.roleName),
  ];
}
