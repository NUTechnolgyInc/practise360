// OpenAPI fragment for Practices → practices and groups, merged into the spec by src/openapi.js.
const TAG = "Practices";
const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const json = (description, schema) => ({ description, content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema, example) => ({ required: true, content: { "application/json": { schema, ...(example && { example }) } } });
const path = (name, description) => ({ name, in: "path", required: true, schema: { type: "string" }, description });
const security = [{ bearerAuth: [] }];
const COMMON = { 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } };
const NOT_FOUND = { 404: err("Practice or group not found, or not visible to you") };
const DETAIL = (description = "The practice after the change") => ({ 200: json(description, ref("PracticeDetail")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND });

const op = (summary, description, extra = {}) => ({ tags: [TAG], summary, description, security, responses: DETAIL(), ...extra });

const ID = path("id", "Practice id (slug)");
const GROUP_ID = path("groupId", "Group id (slug)");
const USER_ID = path("userId", "User id");
const Person = { type: "object", properties: { id: { type: "string" }, username: { type: "string" }, displayName: { type: "string" }, email: { type: "string", description: "Empty for seeded users without one" } } };
const INVITE_ID = path("inviteId", "Invitation id");
const NameBody = {
  type: "object",
  properties: { name: { type: "string", maxLength: 80, example: "Fullstack" }, description: { type: "string", maxLength: 500 } },
};

const FILE_ID = path("fileId", "Overview file id");

const schemas = {
  PracticeFile: {
    type: "object",
    properties: {
      id: { type: "string" },
      fileName: { type: "string", example: "onboarding-guide.pdf" },
      contentType: { type: "string", example: "application/pdf" },
      size: { type: "integer", description: "Bytes" },
      uploadedBy: Person,
      uploadedAt: { type: "string", format: "date-time" },
    },
  },
  PracticeOverview: {
    type: "object",
    properties: {
      body: { type: "string", description: "Markdown, max 50,000 characters. Empty until someone writes it." },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      updatedBy: { ...Person, nullable: true },
      files: { type: "array", items: { $ref: "#/components/schemas/PracticeFile" }, description: "Newest first" },
      canEdit: { type: "boolean", description: "Caller may edit it: `practices.practice.update` for a practice (Manager, Practices Admin), `practices.group.update` for a group (its Lead, Manager, Practices Admin)" },
    },
  },
  PracticeGroup: {
    type: "object",
    properties: {
      id: { type: "string", example: "digital-engineering-fullstack" },
      name: { type: "string", example: "Fullstack" },
      description: { type: "string" },
      lead: { ...Person, nullable: true },
      memberCount: { type: "integer" },
      members: { type: "array", items: Person, description: "Detail only, and only with practices.members.view" },
      actions: {
        type: "object",
        properties: {
          edit: { type: "boolean", description: "Rename (`practices.group.manage`)" },
          delete: { type: "boolean" },
          setLead: { type: "boolean" },
          update: { type: "boolean", description: "Edit the group's Overview (`practices.group.update`)" },
          manageMembers: { type: "boolean", description: "Take members into or out of this group (`practices.members.manage` at the practice, or `practices.group.update` here)" },
        },
      },
    },
  },
  PracticeSummary: {
    type: "object",
    properties: {
      id: { type: "string", example: "digital-engineering" },
      name: { type: "string", example: "Digital Engineering" },
      description: { type: "string" },
      managers: { type: "array", items: Person, description: "One Manager per practice; a list so older data with several still shows" },
      memberCount: { type: "integer" },
      unassignedCount: { type: "integer", description: "Members other than the Manager who aren't in any group (the Manager covers them)" },
      groups: { type: "array", items: ref("PracticeGroup") },
      actions: {
        type: "object",
        description: "What the caller may do here — the API enforces the same checks",
        properties: {
          update: { type: "boolean" },
          setManager: { type: "boolean" },
          createGroup: { type: "boolean" },
          appointLeads: { type: "boolean", description: "Could choose the Lead of a group created here" },
          moveMembers: { type: "boolean" },
          addMember: { type: "boolean" },
        },
      },
    },
  },
  PracticeDetail: {
    allOf: [
      ref("PracticeSummary"),
      {
        type: "object",
        properties: {
          members: {
            type: "array",
            description: "Only with practices.members.view",
            items: {
              type: "object",
              properties: {
                ...Person.properties,
                roles: { type: "array", items: { type: "string" }, example: ["Practitioner"] },
                groupId: { type: "string", nullable: true },
                leads: { type: "array", items: { type: "string" }, description: "Ids of groups this member leads" },
              },
            },
          },
          warning: { type: "string", description: "Set when a group was created but its Lead couldn't be set" },
          invites: { type: "array", items: ref("PracticeInvite"), description: "Open invitations. Only for callers holding `practices.roles.assign` at the practice" },
        },
      },
    ],
  },
};

schemas.PracticeInvite = {
  type: "object",
  properties: {
    id: { type: "string" },
    email: { type: "string", example: "new.person@example.com" },
    kind: { type: "string", enum: ["member", "manager", "lead"] },
    groupId: { type: "string", nullable: true, description: "lead: the group they'll lead; member: the group they'll join" },
    role: { type: "string", example: "Lead of Fullstack in Digital Engineering" },
    invitedBy: Person,
    sentAt: { type: "string", format: "date-time" },
    expiresAt: { type: "string", format: "date-time" },
    expired: { type: "boolean" },
    delivery: { type: "string", enum: ["sent", "logged", "failed"], nullable: true, description: "logged = no SMTP_URL, so the email only went to the API console" },
    actions: { type: "object", properties: { cancel: { type: "boolean" }, resend: { type: "boolean" } } },
  },
};
const BulkInviteResult = {
  allOf: [
    ref("PracticeDetail"),
    {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            required: ["email", "status"],
            properties: {
              email: { type: "string" },
              status: { type: "string", enum: ["invited", "added", "member", "refused"] },
              reason: { type: "string", description: "`member` and `refused`: why nothing was sent" },
              name: { type: "string", description: "Display name, when the address belongs to an account" },
              inviteId: { type: "string", description: "`invited` only" },
              delivery: { type: "string", enum: ["sent", "logged", "failed"], description: "`invited` only" },
              acceptUrl: { type: "string", description: "`invited` only, with AUTH_MODE=dev and no SMTP_URL" },
            },
          },
        },
      },
    },
  ],
};

const InviteResult = {
  allOf: [
    ref("PracticeDetail"),
    {
      type: "object",
      properties: {
        invite: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            delivery: { type: "string", enum: ["sent", "logged", "failed"] },
            acceptUrl: { type: "string", description: "Only with AUTH_MODE=dev and no SMTP_URL, so the link can be passed on by hand" },
          },
        },
      },
    },
  ],
};

const paths = {
  "/practices": {
    get: {
      tags: [TAG],
      summary: "List practices you can see",
      description: "Practices where the caller holds `practices.practice.view`, each with its Manager and groups. `canCreate` = holds `practices.practice.create` (Practices Admin).",
      security,
      responses: {
        200: json("Practices", {
          type: "object",
          properties: {
            practices: { type: "array", items: ref("PracticeSummary") },
            admins: { type: "array", items: Person, description: "Active Practices Admins (granted at app: practices)" },
            canCreate: { type: "boolean" },
          },
        }),
        ...COMMON,
      },
    },
    post: op("Create a practice", "Needs `practices.practice.create` (Practices Admin). The id is a slug of the name. `managerId` optionally appoints its Manager straight away.", {
      requestBody: body({ ...NameBody, properties: { ...NameBody.properties, managerId: { type: "string" } }, required: ["name"] }, { name: "Data Engineering", managerId: "<user id>" }),
      responses: { 201: json("The new practice", ref("PracticeDetail")), 400: err("Validation failed"), ...COMMON },
    }),
  },
  "/practices/people": {
    get: {
      tags: [TAG],
      summary: "People for the Manager / member pickers",
      description: "Active users (names only). Needs `practices.practice.create` or `practices.roles.assign` somewhere.",
      security,
      responses: { 200: json("People", { type: "array", items: Person }), ...COMMON },
    },
  },
  "/practices/{id}": {
    parameters: [ID],
    get: op("Get a practice", "Manager, groups with their Lead and members, and every member with their group. Needs `practices.practice.view` there.", {
      responses: { 200: json("The practice", ref("PracticeDetail")), ...COMMON, ...NOT_FOUND },
    }),
    patch: op("Rename a practice", "Needs `practices.practice.update` (Manager, Practices Admin). The id doesn't change.", { requestBody: body(NameBody) }),
  },
  "/practices/{id}/manager": {
    parameters: [ID],
    put: op(
      "Choose the practice's Manager",
      "Replaces the current Manager (one per practice). Escalation guard: only Practices Admin (or Super Admin) can grant Practice Manager. The previous Manager stays in the practice as a Practitioner unless `keepPrevious` is false.",
      { requestBody: body({ type: "object", required: ["userId"], properties: { userId: { type: "string" }, keepPrevious: { type: "boolean", default: true } } }) },
    ),
  },
  "/practices/{id}/overview": {
    parameters: [ID],
    get: {
      tags: [TAG],
      summary: "Get a practice's Overview",
      description: "Key information (Markdown) and files. Needs `practices.practice.view` there.",
      security,
      responses: { 200: json("The overview", ref("PracticeOverview")), ...COMMON, ...NOT_FOUND },
    },
    put: {
      tags: [TAG],
      summary: "Update a practice's Overview",
      description: "Replaces the Markdown. Needs `practices.practice.update` (Manager, Practices Admin).",
      security,
      requestBody: body({ type: "object", properties: { body: { type: "string", maxLength: 50000 } } }, { body: "## Who we are\n\nOnboarding links, ceremonies and contacts." }),
      responses: { 200: json("The overview after the change", ref("PracticeOverview")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND },
    },
  },
  "/practices/{id}/overview/files": {
    parameters: [ID],
    post: {
      tags: [TAG],
      summary: "Add a file to the Overview",
      description: "Raw file bytes as the body (≤ 4 MB), `fileName` in the query. Needs `practices.practice.update`. Up to 50 files per practice.",
      security,
      parameters: [{ name: "fileName", in: "query", schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
      responses: { 201: json("The stored file", ref("PracticeFile")), 400: err("Empty body"), 409: err("File limit reached"), 413: err("Over 4 MB"), ...COMMON, ...NOT_FOUND },
    },
  },
  "/practices/{id}/overview/files/{fileId}": {
    parameters: [ID, FILE_ID],
    get: {
      tags: [TAG],
      summary: "Download an Overview file",
      description: "Needs `practices.practice.view`. PDFs and images open inline; anything else downloads.",
      security,
      responses: { 200: { description: "The file", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, ...COMMON, 404: err("File not found") },
    },
    delete: {
      tags: [TAG],
      summary: "Remove an Overview file",
      description: "Needs `practices.practice.update`.",
      security,
      responses: { 204: { description: "Removed" }, ...COMMON, 404: err("File not found") },
    },
  },
  "/practices/{id}/groups/{groupId}/overview": {
    parameters: [ID, GROUP_ID],
    get: {
      tags: [TAG],
      summary: "Get a group's Overview",
      description: "The group's key information (Markdown) and files. Readable by everyone who can view the practice (`practices.practice.view`).",
      security,
      responses: { 200: json("The overview", ref("PracticeOverview")), ...COMMON, ...NOT_FOUND },
    },
    put: {
      tags: [TAG],
      summary: "Update a group's Overview",
      description: "Replaces the Markdown. Needs `practices.group.update` at the group (its Lead, Manager, Practices Admin).",
      security,
      requestBody: body({ type: "object", properties: { body: { type: "string", maxLength: 50000 } } }, { body: "## What we build\n\nStack, rituals and who to ask." }),
      responses: { 200: json("The overview after the change", ref("PracticeOverview")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND },
    },
  },
  "/practices/{id}/groups/{groupId}/overview/files": {
    parameters: [ID, GROUP_ID],
    post: {
      tags: [TAG],
      summary: "Add a file to a group's Overview",
      description: "Raw file bytes as the body (≤ 4 MB), `fileName` in the query. Needs `practices.group.update`. Up to 50 files per group.",
      security,
      parameters: [{ name: "fileName", in: "query", schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
      responses: { 201: json("The stored file", ref("PracticeFile")), 400: err("Empty body"), 409: err("File limit reached"), 413: err("Over 4 MB"), ...COMMON, ...NOT_FOUND },
    },
  },
  "/practices/{id}/groups/{groupId}/overview/files/{fileId}": {
    parameters: [ID, GROUP_ID, FILE_ID],
    get: {
      tags: [TAG],
      summary: "Download a group Overview file",
      description: "Needs `practices.practice.view`. PDFs and images open inline; anything else downloads.",
      security,
      responses: { 200: { description: "The file", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, ...COMMON, 404: err("File not found") },
    },
    delete: {
      tags: [TAG],
      summary: "Remove a group Overview file",
      description: "Needs `practices.group.update`.",
      security,
      responses: { 204: { description: "Removed" }, ...COMMON, 404: err("File not found") },
    },
  },
  "/practices/{id}/members": {
    parameters: [ID],
    post: op("Add someone to the practice", "Grants Practitioner (escalation guard) and optionally places them in a group (`practices.members.manage`, or `practices.group.update` on that group). 409 if they're already a member.", {
      requestBody: body({ type: "object", required: ["userId"], properties: { userId: { type: "string" }, groupId: { type: "string", nullable: true } } }),
      responses: { 201: json("The practice", ref("PracticeDetail")), 400: err("Validation failed"), 409: err("Already a member"), ...COMMON, ...NOT_FOUND },
    }),
  },
  "/practices/{id}/members/{userId}": {
    parameters: [ID, USER_ID],
    put: op("Move a member to a group", "Puts a member in one of the practice's groups, or out of any group with `groupId: null`. Needs `practices.members.manage` at the practice, or `practices.group.update` on every group involved — so a Lead can take people who aren't in a group into theirs and remove members from it, but not take someone from another group. Their open work is then reviewed by the new group's Lead.", {
      requestBody: body({ type: "object", properties: { groupId: { type: "string", nullable: true } } }, { groupId: "digital-engineering-devops" }),
    }),
  },
  "/practices/{id}/groups": {
    parameters: [ID],
    post: op("Create a group", "Needs `practices.group.manage` (Manager, Practices Admin). Name unique in the practice. `leadId` optionally chooses its Lead (must be a practice member).", {
      requestBody: body({ ...NameBody, properties: { ...NameBody.properties, leadId: { type: "string" } }, required: ["name"] }, { name: "Mobile App" }),
      responses: { 201: json("The practice with the new group", ref("PracticeDetail")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND },
    }),
  },
  "/practices/{id}/groups/{groupId}": {
    parameters: [ID, GROUP_ID],
    patch: op("Rename a group", "Needs `practices.group.manage`. The id doesn't change.", { requestBody: body(NameBody) }),
    delete: op("Delete a group", "Needs `practices.group.manage`. Only an empty group (no Lead, no members) can be deleted.", {
      responses: { ...DETAIL(), 409: err("The group still has a Lead or members") },
    }),
  },
  "/practices/{id}/invites": {
    parameters: [ID],
    post: op(
      "Invite someone who isn't on Practise360 yet",
      "Emails a one-time link (valid 7 days). `kind`: `member` (joins as Practitioner, optionally into `groupId` — that needs `practices.members.manage`), `manager` (becomes the practice's Manager), `lead` (joins as Practitioner and leads `groupId`). The caller needs exactly what the direct appointment needs (escalation guard), checked again with the inviter's grants when the link is used. Refused with 409 when the email already has an account. A new invitation replaces an open one for the same email in this practice, and for the same Manager or Lead slot. `INVITE_EMAIL_DOMAINS` can limit which domains are allowed.",
      {
        requestBody: body(
          { type: "object", required: ["email"], properties: { email: { type: "string" }, kind: { type: "string", enum: ["member", "manager", "lead"], default: "member" }, groupId: { type: "string" }, keepPrevious: { type: "boolean", default: true, description: "manager: keep the replaced Manager as a Practitioner" } } },
          { email: "new.person@example.com", kind: "lead", groupId: "digital-engineering-mobile-app" },
        ),
        responses: { 201: json("The practice, plus how the email went", InviteResult), 400: err("Validation failed"), 409: err("That email already has an account"), ...COMMON, ...NOT_FOUND },
      },
    ),
  },
  "/practices/{id}/invites/bulk": {
    parameters: [ID],
    post: op(
      "Add or invite several people by email",
      "Members only (as Practitioner), optionally all into `groupId` — that needs `practices.members.manage`. Up to 50 distinct addresses per call; `emails` is an array or a comma/semicolon/space-separated string. Refused with 403 when the caller couldn't add a member here at all. Otherwise every address gets the same checks as a single invite (valid, `INVITE_EMAIL_DOMAINS`, escalation guard) and its own result: `invited` (emailed a link — replaces an open invitation for that email here), `added` (already has an account, so added directly), `member` (already in the practice — nothing changes) or `refused` (with `reason`).",
      {
        requestBody: body(
          { type: "object", required: ["emails"], properties: { emails: { oneOf: [{ type: "array", items: { type: "string" }, maxItems: 50 }, { type: "string" }] }, groupId: { type: "string" } } },
          { emails: ["new.person@example.com", "another.person@example.com"], groupId: "digital-engineering-fullstack" },
        ),
        responses: { 200: json("The practice, plus one result per address", BulkInviteResult), 400: err("No addresses, more than 50, or an unknown group"), ...COMMON, ...NOT_FOUND },
      },
    ),
  },
  "/practices/{id}/invites/{inviteId}": {
    parameters: [ID, INVITE_ID],
    delete: op("Cancel an open invitation", "The link stops working. Allowed to anyone who could send the same invitation."),
  },
  "/practices/{id}/invites/{inviteId}/resend": {
    parameters: [ID, INVITE_ID],
    post: op("Send an invitation again", "Fresh link and 7-day expiry; the old link stops working and the caller becomes the inviter. Refused (429) within a minute of a successful send.", {
      responses: { 200: json("The practice, plus how the email went", InviteResult), 429: err("Sent less than a minute ago"), ...COMMON, ...NOT_FOUND },
    }),
  },
  "/practices/{id}/groups/{groupId}/lead": {
    parameters: [ID, GROUP_ID],
    put: op(
      "Choose the group's Lead",
      "Replaces the current Lead (one per group). Escalation guard: Practice Manager of that practice or Practices Admin. The Lead must already be in the practice; if they aren't in a group yet, they join this one.",
      { requestBody: body({ type: "object", required: ["userId"], properties: { userId: { type: "string" } } }) },
    ),
    delete: op("Remove the group's Lead", "The Manager covers the group's members until a new Lead is chosen. Same guard as choosing one."),
  },
};

module.exports = { tag: { name: TAG, description: "Practices and their groups: Managers, Leads and who sits in which group" }, schemas, paths };
