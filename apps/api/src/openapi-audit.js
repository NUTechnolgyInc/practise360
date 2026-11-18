// OpenAPI fragment for the audit log, merged into the spec by src/openapi.js.
const TAG = "Audit log";
const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const { CATEGORIES } = require("./lib/audit-actions");

const OUTCOMES = ["success", "denied", "failed"];
const query = (name, schema, description) => ({ name, in: "query", required: false, schema, description });

const schemas = {
  AuditEntry: {
    type: "object",
    description: "One write request or sign-in. Secrets (passwords, Google credentials, invite tokens) and file bytes are never stored; long text is cut to 200 characters.",
    properties: {
      id: { type: "string" },
      at: { type: "string", format: "date-time" },
      actor: {
        type: "object",
        nullable: true,
        description: "Who did it, with the name they had at the time. null for a failed sign-in or an expired session.",
        properties: { id: { type: "string", nullable: true }, displayName: { type: "string", example: "Riley Patel" }, username: { type: "string", nullable: true } },
      },
      action: { type: "string", example: "rbac.assignment.grant" },
      label: { type: "string", example: "Granted a role" },
      category: { type: "string", enum: CATEGORIES },
      method: { type: "string", example: "POST" },
      route: { type: "string", example: "/rbac/assignments", description: "Route pattern — never the raw URL" },
      params: { type: "object", additionalProperties: true, example: { id: "qa" } },
      details: { type: "object", additionalProperties: true, example: { userId: "64f0c0ffee0000000000000a", roleId: "practitioner", scopeType: "practice", scopeId: "qa" } },
      resultId: { type: "string", nullable: true, description: "Id of what a create returned" },
      status: { type: "integer", example: 201 },
      outcome: { type: "string", enum: OUTCOMES, description: "denied = 401/403, failed = any other 4xx/5xx" },
      error: { type: "string", nullable: true, description: "The error the caller was shown" },
      ip: { type: "string", nullable: true },
      userAgent: { type: "string", nullable: true },
    },
  },
};

const paths = {
  "/audit-log": {
    get: {
      tags: [TAG],
      summary: "Audit log, newest first",
      description: "Every write request and sign-in across the portal, including refused ones. Needs `platform.audit.view` (Super Admin). Entries can't be edited or deleted through the API.",
      security: [{ bearerAuth: [] }],
      parameters: [
        query("q", { type: "string" }, "Search action, person, route, error or IP"),
        query("category", { type: "string", enum: CATEGORIES }),
        query("outcome", { type: "string", enum: OUTCOMES }),
        query("actorId", { type: "string" }, "A user id, or `none` for entries without a signed-in person"),
        query("from", { type: "string", format: "date" }, "First day, YYYY-MM-DD (UTC)"),
        query("to", { type: "string", format: "date" }, "Last day, YYYY-MM-DD (UTC), inclusive"),
        query("page", { type: "integer", minimum: 1, default: 1 }),
        query("pageSize", { type: "integer", minimum: 1, maximum: 100, default: 50 }),
      ],
      responses: {
        200: {
          description: "One page of entries",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  entries: { type: "array", items: ref("AuditEntry") },
                  names: { type: "object", additionalProperties: { type: "string" }, description: "Readable names for ids in params/details (people, practices, groups, roles, contributions, certifications)" },
                  total: { type: "integer" },
                  page: { type: "integer" },
                  pageSize: { type: "integer" },
                  filters: {
                    type: "object",
                    properties: {
                      categories: { type: "array", items: { type: "string" } },
                      outcomes: { type: "array", items: { type: "string" } },
                      actors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, displayName: { type: "string" }, username: { type: "string" } } } },
                    },
                  },
                },
              },
            },
          },
        },
        400: err("A filter value is invalid"),
        401: { $ref: "#/components/responses/Unauthorized" },
        403: { $ref: "#/components/responses/Forbidden" },
      },
    },
  },
};

module.exports = { tag: { name: TAG, description: "Who did what, when — Super Admin only." }, schemas, paths };
