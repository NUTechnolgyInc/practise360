// OpenAPI fragment for the Certification Tracker, merged into the spec by src/openapi.js.
const TAG = "Certifications";
const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const json = (description, schema) => ({ description, content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema) => ({ required: true, content: { "application/json": { schema } } });
const path = (name, description) => ({ name, in: "path", required: true, schema: { type: "string" }, description });
const security = [{ bearerAuth: [] }];
const COMMON = { 401: { $ref: "#/components/responses/Unauthorized" }, 403: { $ref: "#/components/responses/Forbidden" } };
const NOT_FOUND = { 404: err("Plan not found, or not visible to you") };
const DETAIL = { 200: json("The updated plan", ref("CertPlan")), 400: err("Validation failed"), ...COMMON, ...NOT_FOUND };
const op = (summary, description, extra = {}) => ({ tags: [TAG], summary, description, security, responses: DETAIL, ...extra });

const ID = path("id", "Plan id");
const TYPES = ["certification", "course"];
const STATUSES = ["suggested", "planned", "lead_review", "manager_review", "clarification", "completed", "declined", "dropped"];
const date = { type: "string", format: "date", example: "2026-12-15" };
const Person = ref("Person");
const CertInput = {
  type: "object",
  required: ["title", "type"],
  properties: {
    title: { type: "string", example: "AWS Certified Solutions Architect – Associate" },
    type: { type: "string", enum: TYPES },
    provider: { type: "string", example: "Amazon Web Services" },
    url: { type: "string", example: "https://example.com/cert" },
    description: { type: "string" },
  },
};
const certChoice = {
  catalogId: { type: "string", description: "An active catalog entry. Send this or `cert`." },
  cert: { ...CertInput, description: "A cert that isn't in the catalog yet" },
};

const schemas = {
  CertCatalogItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      ...CertInput.properties,
      isActive: { type: "boolean" },
      createdBy: { ...Person, nullable: true },
      canEdit: { type: "boolean" },
      canRetire: { type: "boolean" },
    },
  },
  CertPlanSummary: {
    type: "object",
    properties: {
      id: { type: "string" },
      cert: { type: "object", properties: { title: { type: "string" }, type: { type: "string", enum: TYPES }, provider: { type: "string" }, url: { type: "string" } } },
      catalogId: { type: "string", nullable: true, description: "null for a one-off cert" },
      practice: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      owner: Person,
      source: { type: "string", enum: ["self", "suggested", "assigned"] },
      createdBy: Person,
      status: { type: "string", enum: STATUSES },
      startDate: { type: "string", format: "date-time", nullable: true },
      dueDate: { type: "string", format: "date-time", nullable: true },
      overdue: { type: "boolean" },
      expired: { type: "boolean" },
      completedOn: { type: "string", format: "date-time", nullable: true },
      reimbursement: { type: "object", nullable: true, properties: { amount: { type: "number" }, currency: { type: "string", enum: ["INR", "USD"] } } },
      mine: { type: "boolean" },
      awaitingMe: { type: "boolean", description: "The caller can do the next review step" },
    },
  },
  CertFile: {
    type: "object",
    properties: { id: { type: "string" }, kind: { type: "string", enum: ["certificate", "receipt"] }, fileName: { type: "string" }, contentType: { type: "string" }, size: { type: "integer" }, uploadedAt: { type: "string" } },
  },
  CertPlan: {
    allOf: [
      ref("CertPlanSummary"),
      {
        type: "object",
        properties: {
          notes: { type: "string" },
          completion: { type: "object", nullable: true, description: "The last submitted completion" },
          files: { type: "array", items: ref("CertFile") },
          events: { type: "array", items: { type: "object" }, description: "Timeline, newest first" },
          actions: { type: "object", additionalProperties: { type: "boolean" }, description: "What the caller may do — the same rules the API enforces" },
        },
      },
    ],
  },
};

const paths = {
  "/certifications/catalog": {
    get: {
      tags: [TAG],
      summary: "List the shared catalog",
      description: "Requires `cert.catalog.view`. `includeRetired=true` also lists retired entries for `cert.catalog.manage` holders.",
      security,
      parameters: [{ name: "includeRetired", in: "query", schema: { type: "boolean" } }],
      responses: { 200: json("Catalog", { type: "object", properties: { items: { type: "array", items: ref("CertCatalogItem") }, canCreate: { type: "boolean" }, canManage: { type: "boolean" } } }), ...COMMON },
    },
    post: {
      tags: [TAG],
      summary: "Add to the catalog",
      description: "Requires `cert.catalog.create` (Lead, Manager, Practices Admin, Cert Admin). Same title + provider twice is refused.",
      security,
      requestBody: body(CertInput),
      responses: { 201: json("Added", ref("CertCatalogItem")), 400: err("Validation failed"), ...COMMON, 409: err("Already in the catalog") },
    },
  },
  "/certifications/catalog/{id}": {
    parameters: [path("id", "Catalog entry id")],
    patch: {
      tags: [TAG],
      summary: "Edit, retire or restore a catalog entry",
      description: "Editing: whoever added it, or `cert.catalog.manage`. Retiring/restoring (`isActive`): `cert.catalog.manage` only.",
      security,
      requestBody: body({ type: "object", properties: { ...CertInput.properties, isActive: { type: "boolean" } } }),
      responses: { 200: json("Saved", ref("CertCatalogItem")), 400: err("Validation failed"), ...COMMON, 404: err("Not found"), 409: err("Duplicate") },
    },
  },
  "/certifications/plans": {
    get: {
      tags: [TAG],
      summary: "List plans I can see",
      description: "Your own plans, plus every plan in practices where you hold `cert.plan.view` (or all of them for Cert Admin).",
      security,
      parameters: [{ name: "status", in: "query", schema: { type: "string", enum: STATUSES } }],
      responses: {
        200: json("Plans and what the caller can do where", {
          type: "object",
          properties: {
            plans: { type: "array", items: ref("CertPlanSummary") },
            practices: { type: "array", items: { type: "object" } },
            canPlanIn: { type: "array", items: { type: "string" } },
            canSuggestIn: { type: "array", items: { type: "string" } },
            canAssignIn: { type: "array", items: { type: "string" } },
            teamPractices: { type: "array", items: { type: "string" } },
          },
        }),
        ...COMMON,
      },
    },
    post: op("Add my own plan", "Requires `cert.plan.manage:own` in `practiceId`. A new `cert` stays one-off (not added to the catalog).", {
      requestBody: body({ type: "object", required: ["practiceId", "startDate", "dueDate"], properties: { practiceId: { type: "string" }, ...certChoice, startDate: date, dueDate: date, notes: { type: "string" } } }),
      responses: { 201: json("Created", ref("CertPlan")), 400: err("Validation failed"), ...COMMON, 409: err("Already planned") },
    }),
  },
  "/certifications/assignments": {
    post: {
      tags: [TAG],
      summary: "Recommend or assign a cert to practice members",
      description:
        "`mode=suggest` needs `cert.plan.suggest`, `mode=assign` needs `cert.plan.assign` in `practiceId`. One plan per person; people with an open plan for the same cert are skipped. A new `cert` is added to the shared catalog (needs `cert.catalog.create`). Assignments need a due date.",
      security,
      requestBody: body({
        type: "object",
        required: ["mode", "practiceId", "userIds"],
        properties: { mode: { type: "string", enum: ["suggest", "assign"] }, practiceId: { type: "string" }, userIds: { type: "array", items: { type: "string" } }, ...certChoice, startDate: date, dueDate: date, note: { type: "string" } },
      }),
      responses: {
        201: json("Created plans and skipped people", { type: "object", properties: { created: { type: "array", items: ref("CertPlanSummary") }, skipped: { type: "array", items: { type: "object" } } } }),
        200: json("Nothing created — everyone was skipped", { type: "object" }),
        400: err("Validation failed"),
        ...COMMON,
      },
    },
  },
  "/certifications/people/{practiceId}": {
    get: {
      tags: [TAG],
      summary: "Members who can be recommended or assigned a cert",
      security,
      parameters: [path("practiceId", "Practice id")],
      responses: { 200: json("People holding cert.plan.manage:own through a practice-scope assignment there", { type: "array", items: Person }), ...COMMON },
    },
  },
  "/certifications/plans/{id}": {
    parameters: [ID],
    get: op("Get a plan", "Owner, or `cert.plan.view` at its practice. Includes timeline, files and the caller's `actions`.", { responses: { 200: json("The plan", ref("CertPlan")), ...COMMON, ...NOT_FOUND } }),
    patch: op("Change dates or notes", "Owner: start date, notes, and the due date unless it was assigned. An assigned due date: `cert.plan.assign` holders other than the owner. Changes are logged.", {
      requestBody: body({ type: "object", properties: { startDate: date, dueDate: date, notes: { type: "string" } } }),
    }),
  },
  "/certifications/plans/{id}/accept": {
    parameters: [ID],
    post: op("Accept a recommendation", "The owner, while `suggested`. Sets the dates and moves it to `planned`.", { requestBody: body({ type: "object", required: ["startDate", "dueDate"], properties: { startDate: date, dueDate: date } }) }),
  },
  "/certifications/plans/{id}/decline": {
    parameters: [ID],
    post: op("Decline a recommendation", "The owner, while `suggested`. Assignments can't be declined.", { requestBody: body({ type: "object", properties: { reason: { type: "string" } } }) }),
  },
  "/certifications/plans/{id}/drop": {
    parameters: [ID],
    post: op("Drop my plan", "The owner, while `planned` or `clarification`, for anything that wasn't assigned.", { requestBody: body({ type: "object", properties: { reason: { type: "string" } } }) }),
  },
  "/certifications/plans/{id}/withdraw": {
    parameters: [ID],
    post: op("Withdraw a recommendation or assignment", "`cert.plan.suggest` (open recommendation) or `cert.plan.assign` (open assignment), not the owner.", {
      requestBody: body({ type: "object", properties: { reason: { type: "string" } } }),
    }),
  },
  "/certifications/plans/{id}/files": {
    parameters: [ID],
    post: op("Upload a certificate or receipt", "Owner, while the plan is open. Raw PDF/PNG/JPEG/WebP body (max 4 MB), `?fileName=&kind=certificate|receipt`.", {
      parameters: [
        { name: "fileName", in: "query", schema: { type: "string" } },
        { name: "kind", in: "query", schema: { type: "string", enum: ["certificate", "receipt"] } },
      ],
      requestBody: { required: true, content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
      responses: { 201: json("Stored", ref("CertFile")), 400: err("Empty body or not a PDF/image"), ...COMMON, ...NOT_FOUND, 413: err("Too large") },
    }),
  },
  "/certifications/plans/{id}/files/{fileId}": {
    parameters: [ID, path("fileId", "File id")],
    get: op("Download a certificate or receipt", "Anyone who can see the plan.", {
      responses: { 200: { description: "The file", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } }, ...COMMON, ...NOT_FOUND },
    }),
    delete: op("Remove a file", "Owner, while open. Files that were part of a submission are kept.", { responses: { 204: { description: "Removed" }, ...COMMON, ...NOT_FOUND, 409: err("Part of a submission") } }),
  },
  "/certifications/plans/{id}/submit": {
    parameters: [ID],
    post: op(
      "Submit a completion",
      "Owner, while `planned` or `clarification`. Needs `completedOn` (not in the future), `verificationUrl` and ≥ 1 certificate file. Reimbursement is optional: amount > 0, INR or USD, ≥ 1 receipt. A resubmission after clarification returns to the reviewer who asked.",
      {
        requestBody: body({
          type: "object",
          required: ["completedOn", "verificationUrl", "certificateFileIds"],
          properties: {
            completedOn: date,
            verificationUrl: { type: "string", example: "https://example.com/verify/ABC123" },
            credentialId: { type: "string" },
            expiresOn: date,
            certificateFileIds: { type: "array", items: { type: "string" } },
            reimbursement: {
              type: "object",
              nullable: true,
              properties: { amount: { type: "number", example: 12000 }, currency: { type: "string", enum: ["INR", "USD"] }, receiptFileIds: { type: "array", items: { type: "string" } } },
            },
            note: { type: "string" },
          },
        }),
      },
    ),
  },
  "/certifications/plans/{id}/review": {
    parameters: [ID],
    post: op(
      "Review decision",
      "Lead step (`lead_review`): `cert.plan.review`. Manager step (`manager_review`): `cert.plan.verify`; approving marks it Completed. The owner can't review, and the Lead-step reviewer can't give final approval. `reject` sends it back to `planned`. Comment required unless approving.",
      {
        requestBody: body({ type: "object", required: ["decision"], properties: { decision: { type: "string", enum: ["approve", "reject", "clarify"] }, comment: { type: "string" } } }),
        responses: { ...DETAIL, 409: err("Not waiting for a review") },
      },
    ),
  },
};

module.exports = { tag: { name: TAG, description: "Certification Tracker: catalog, plans, recommend/assign, completion with Lead → Manager approval." }, schemas, paths };
