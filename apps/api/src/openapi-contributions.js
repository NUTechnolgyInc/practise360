// OpenAPI fragment for Practices → Contributions, merged into the spec by src/openapi.js.
const TAG = "Contributions";
const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const json = (description, schema) => ({ description, content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema) => ({ required: true, content: { "application/json": { schema } } });
const path = (name, description) => ({ name, in: "path", required: true, schema: { type: "string" }, description });
const security = [{ bearerAuth: [] }];
const COMMON = { 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } };
const NOT_FOUND = { 404: err("Contribution not found, or not visible to you") };
const DETAIL = { 200: json("The updated contribution", ref("Contribution")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND };

const op = (summary, description, extra = {}) => ({ tags: [TAG], summary, description, security, responses: DETAIL, ...extra });

const ID = path("id", "Contribution id");
const TYPES = ["framework", "automation", "client_win", "case_study", "blog", "other"];
const STATUSES = ["in_progress", "lead_review", "manager_review", "clarification", "published", "declined"];
const Person = { type: "object", properties: { id: { type: "string" }, username: { type: "string" }, displayName: { type: "string" } } };

const schemas = {
  Person,
  ContributionSummary: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string", example: "nu-auth-shared" },
      type: { type: "string", enum: TYPES },
      customType: { type: "string", nullable: true },
      practice: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      status: { type: "string", enum: STATUSES },
      owner: Person,
      addedBy: { ...Person, nullable: true, description: "Who added it on the owner's behalf; null when the owner started it" },
      contributorCount: { type: "integer" },
      startDate: { type: "string", format: "date-time" },
      dueDate: { type: "string", format: "date-time" },
      overdue: { type: "boolean" },
      pendingJoinRequests: { type: "integer" },
      awaitingMe: { type: "boolean", description: "The caller can do the next review step" },
      mine: { type: "boolean", description: "The caller is the owner or a contributor" },
    },
  },
  ContributionFile: {
    type: "object",
    properties: { id: { type: "string" }, fileName: { type: "string" }, contentType: { type: "string" }, size: { type: "integer" }, uploadedBy: { type: "string" }, uploadedAt: { type: "string", format: "date-time" } },
  },
  ContributionEvent: {
    type: "object",
    properties: {
      id: { type: "string" },
      kind: { type: "string", enum: ["created", "progress", "member", "submitted", "review", "published"] },
      at: { type: "string", format: "date-time" },
      author: Person,
      body: { type: "string", description: "Markdown" },
      fileIds: { type: "array", items: { type: "string" } },
      stage: { type: "string", enum: ["lead", "manager"], nullable: true },
      decision: { type: "string", enum: ["approve", "decline", "clarify"], nullable: true },
      action: { type: "string", nullable: true, example: "joined" },
      subject: { ...Person, nullable: true },
    },
  },
  Contribution: {
    allOf: [
      ref("ContributionSummary"),
      {
        type: "object",
        properties: {
          description: { type: "string", description: "Markdown" },
          contributors: { type: "array", items: Person },
          invites: { type: "array", items: { type: "object", properties: { user: Person, by: Person, at: { type: "string" } } } },
          joinRequests: { type: "array", items: { type: "object", properties: { user: Person, message: { type: "string" }, at: { type: "string" } } } },
          submission: { type: "object", nullable: true },
          files: { type: "array", items: ref("ContributionFile") },
          events: { type: "array", items: ref("ContributionEvent"), description: "Newest first" },
          actions: { type: "object", additionalProperties: { type: "boolean" }, description: "What the caller may do — the same rules the API enforces" },
        },
      },
    ],
  },
};

const paths = {
  "/contributions": {
    get: {
      tags: [TAG],
      summary: "List contributions I can see",
      description: "Requires `practices.contribution.view` somewhere; returns contributions in practices where the caller holds it. Filters are optional.",
      security,
      parameters: [
        ...["practiceId", "status", "type", "ownerId", "q"].map((name) => ({ name, in: "query", schema: { type: "string" } })),
        { name: "groupId", in: "query", schema: { type: "string" }, description: "Only contributions owned by the group's current members" },
        ...["mine", "awaitingMe", "overdue"].map((name) => ({ name, in: "query", schema: { type: "boolean" } })),
      ],
      responses: {
        200: json("Contributions, the practices the caller can see, and where they can start one", {
          type: "object",
          properties: {
            contributions: { type: "array", items: ref("ContributionSummary") },
            practices: { type: "array", items: { type: "object" } },
            canCreateIn: { type: "array", items: { type: "string" } },
            canAddForIn: { type: "array", items: { type: "string" }, description: "Practices where the caller may add a contribution for a member" },
          },
        }),
        ...COMMON,
      },
    },
    post: op(
      "Start a contribution",
      "Requires `practices.contribution.create` in `practiceId`; the caller becomes the owner. With `ownerId`, adds it on that member's behalf instead: needs `practices.contribution.manage` at the member's group (else practice), so a Lead only adds for their own group. The member owns it; the caller is recorded as `addedBy` and can't review it. With `ownerEmail` instead, adds it for that address: a practice member in reach is used as the owner; an account outside the practice is added to it (only if the caller could add them directly); an address with no account is **invited** as a member (into `groupId`, if given) — the caller needs the invitation right (escalation guard, or running that group, i.e. its Lead) plus `manage` where they'll sit. The invitee's account is created now, with no roles, and owns the contribution; accepting the invitation makes them a practice member.",
      {
      requestBody: body({
        type: "object",
        required: ["practiceId", "title", "type", "startDate", "dueDate"],
        properties: {
          practiceId: { type: "string", example: "digital-engineering" },
          ownerId: { type: "string", description: "Add it on behalf of this practice member (omit to own it yourself)" },
          ownerEmail: { type: "string", description: "Add it for this email address instead of `ownerId`; invites them if they aren't on Practise360 yet" },
          groupId: { type: "string", description: "With `ownerEmail`: the group a new person joins (one of `inviteInto` from the owners endpoint)" },
          title: { type: "string", example: "nu-auth-shared" },
          type: { type: "string", enum: TYPES },
          customType: { type: "string", description: "Required when type is `other`" },
          description: { type: "string", description: "Markdown" },
          startDate: { type: "string", format: "date" },
          dueDate: { type: "string", format: "date" },
        },
      }),
        responses: {
          201: json("Created. With `ownerEmail`, also `invite` (when an invitation was sent; `acceptUrl` only in dev without SMTP) or `addedToPractice`", {
            allOf: [
              ref("Contribution"),
              {
                type: "object",
                properties: {
                  invite: { type: "object", properties: { id: { type: "string" }, email: { type: "string" }, delivery: { type: "string" }, acceptUrl: { type: "string" } } },
                  addedToPractice: { type: "boolean" },
                },
              },
            ],
          }),
          400: err("Validation failed"),
          409: err("That email belongs to a deactivated account, or to an account the caller can't add to the practice"),
          ...COMMON,
        },
      },
    ),
  },
  "/contributions/practices/{practiceId}/people": {
    get: {
      tags: [TAG],
      summary: "People who can be invited in a practice",
      security,
      parameters: [path("practiceId", "Practice id")],
      responses: { 200: json("Members holding practices.contribution.create there", { type: "array", items: Person }), ...COMMON },
    },
  },
  "/contributions/practices/{practiceId}/owners": {
    get: {
      tags: [TAG],
      summary: "Who the caller can add a contribution for",
      description:
        "`members`: practice members within the caller's `practices.contribution.manage` reach — a Lead gets their group's members, a Manager the whole practice. `inviteInto`: where someone new, added by email, can be placed (`groupId` null = the practice without a group) — a Lead gets their own group.",
      security,
      parameters: [path("practiceId", "Practice id")],
      responses: {
        200: json("Members and places for someone new", {
          type: "object",
          properties: {
            members: { type: "array", items: Person },
            inviteInto: { type: "array", items: { type: "object", properties: { groupId: { type: "string", nullable: true }, name: { type: "string" } } } },
          },
        }),
        ...COMMON,
      },
    },
  },
  "/contributions/{id}": {
    parameters: [ID],
    get: op("Get a contribution", "Anyone who can view contributions in its practice. Includes timeline, files and the caller's `actions`.", {
      responses: { 200: json("The contribution", ref("Contribution")), ...COMMON, ...NOT_FOUND },
    }),
    patch: op("Edit details", "Owner, contributors (`update:own`) or `practices.contribution.manage`, while in progress or awaiting clarification.", {
      requestBody: body({ type: "object", properties: { title: { type: "string" }, type: { type: "string", enum: TYPES }, customType: { type: "string" }, description: { type: "string" }, startDate: { type: "string" }, dueDate: { type: "string" } } }),
    }),
  },
  "/contributions/{id}/files": {
    parameters: [ID],
    post: op("Upload an attachment", "Raw file as the body (max 4 MB), `?fileName=`. Reference the returned id from a progress update or the submission.", {
      parameters: [{ name: "fileName", in: "query", schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } },
      responses: { 201: json("Stored", ref("ContributionFile")), 400: err("Empty body"), ...COMMON, ...NOT_FOUND, 413: err("Too large") },
    }),
  },
  "/contributions/{id}/files/{fileId}": {
    parameters: [ID, path("fileId", "File id")],
    get: op("Download an attachment", "PDFs and images are served inline; everything else as a download.", {
      responses: { 200: { description: "The file", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } }, ...COMMON, ...NOT_FOUND },
    }),
    delete: op("Remove an attachment", "Uploader, owner or manager, while editable. Files on a progress update can't be removed.", {
      responses: { 204: { description: "Removed" }, ...COMMON, ...NOT_FOUND, 409: err("Attached to a progress update") },
    }),
  },
  "/contributions/{id}/updates": {
    parameters: [ID],
    post: op("Log progress", "Owner, contributors, or `practices.contribution.manage` (Lead, Manager, admins). Markdown body plus optional `fileIds`.", {
      requestBody: body({ type: "object", required: ["body"], properties: { body: { type: "string" }, fileIds: { type: "array", items: { type: "string" } } } }),
    }),
  },
  "/contributions/{id}/invites": {
    parameters: [ID],
    post: op("Invite a practice member", "Owner or `practices.contribution.manage`. If the person already asked to join, they're added straight away.", {
      requestBody: body({ type: "object", required: ["userId"], properties: { userId: { type: "string" } } }),
    }),
  },
  "/contributions/{id}/invites/{userId}": {
    parameters: [ID, path("userId", "Invited user")],
    delete: op("Withdraw an invite", "Owner or `practices.contribution.manage`."),
  },
  "/contributions/{id}/invites/respond": {
    parameters: [ID],
    post: op("Accept or decline my invite", "Only the invited person.", { requestBody: body({ type: "object", required: ["accept"], properties: { accept: { type: "boolean" } } }) }),
  },
  "/contributions/{id}/join-requests": {
    parameters: [ID],
    post: op("Ask to join", "Practice members with `practices.contribution.create` who aren't already involved.", {
      requestBody: body({ type: "object", properties: { message: { type: "string" } } }),
      responses: { ...DETAIL, 201: json("Requested", ref("Contribution")) },
    }),
  },
  "/contributions/{id}/join-requests/mine": {
    parameters: [ID],
    delete: op("Cancel my join request", "Only the requester."),
  },
  "/contributions/{id}/join-requests/{userId}": {
    parameters: [ID, path("userId", "Requester")],
    post: op("Accept or reject a join request", "Owner or `practices.contribution.manage`.", {
      requestBody: body({ type: "object", required: ["accept"], properties: { accept: { type: "boolean" } } }),
    }),
  },
  "/contributions/{id}/contributors/{userId}": {
    parameters: [ID, path("userId", "Contributor")],
    delete: op("Remove a contributor, or leave", "Owner or `practices.contribution.manage` removes; a contributor can remove themselves."),
  },
  "/contributions/{id}/submit": {
    parameters: [ID],
    post: op(
      "Submit for review",
      "Owner only, while in progress or awaiting clarification. Needs a description, `summary`, `impact` and at least one attached file. A resubmission after clarification goes back to the reviewer who asked.",
      {
        requestBody: body({
          type: "object",
          required: ["summary", "impact", "fileIds"],
          properties: {
            summary: { type: "string" },
            impact: { type: "string" },
            repoUrl: { type: "string" },
            demoUrl: { type: "string" },
            links: { type: "array", items: { type: "object", properties: { label: { type: "string" }, url: { type: "string" } } } },
            fileIds: { type: "array", items: { type: "string" } },
            note: { type: "string", description: "Reply to a clarification request" },
          },
        }),
      },
    ),
  },
  "/contributions/{id}/review": {
    parameters: [ID],
    post: op(
      "Review decision",
      "Lead step (`lead_review`): `practices.contribution.review`. Manager step (`manager_review`): `practices.contribution.approve`; approving publishes. Participants can't review, and the Lead-step reviewer can't also give final approval. Comment required unless approving.",
      {
        requestBody: body({ type: "object", required: ["decision"], properties: { decision: { type: "string", enum: ["approve", "decline", "clarify"] }, comment: { type: "string" } } }),
        responses: { ...DETAIL, 409: err("Not waiting for a review") },
      },
    ),
  },
};

module.exports = { tag: { name: TAG, description: "Practices → Contributions: start, collaborate, log progress, submit, two-step review, publish." }, schemas, paths };
