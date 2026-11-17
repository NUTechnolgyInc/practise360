// OpenAPI 3.0 description of the API, served at /openapi.json and rendered by Swagger UI at /docs.
// Hand-written so it reads like a contract; test/openapi.test.js fails if a route is added without documenting it.

const practices = require("./openapi-practices");
const contributions = require("./openapi-contributions");
const certifications = require("./openapi-certifications");
const people = require("./openapi-people");

const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const json = (description, schema) => ({ description, content: { "application/json": { schema } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema, example) => ({ required: true, content: { "application/json": { schema, ...(example && { example }) } } });
const idParam = (description) => ({ name: "id", in: "path", required: true, schema: { type: "string" }, description });

const PERIOD = { name: "period", in: "path", required: true, schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" }, description: "Month, YYYY-MM" };

const UNAUTH = { 401: { $ref: "#/components/responses/Unauthorized" } };
const FORBIDDEN = { 403: { $ref: "#/components/responses/Forbidden" } };

function buildSpec({ serverUrl } = {}) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Practise360 API",
      version: "1.0.0",
      description: [
        "NULogic's internal portal API. Every route that reads or changes practice / role data enforces RBAC server-side (see `docs/rbac.md`).",
        "",
        "**Signing in (dev):** call `POST /auth/login` with a seeded username and the dev password, copy the `token`, then press **Authorize** and paste it.",
        "Password login only exists when `AUTH_MODE=dev`.",
        "",
        "Permission keys look like `<app>.<resource>.<action>`; a 403 response names the permission that was missing.",
      ].join("\n"),
    },
    servers: [{ url: serverUrl || "/", description: "This server" }],
    tags: [
      { name: "System", description: "Liveness" },
      { name: "Auth", description: "Sign-in. Auth only yields a userId; RBAC never depends on how login works." },
      { name: "Me", description: "The signed-in user" },
      { name: "Roles", description: "Permission catalog, system and custom roles" },
      { name: "Users", description: "User directory and role assignments (escalation guard applies)" },
      { name: "AI Tracker", description: "Monthly Claude usage reports (PDF). Visibility follows the owner's practice scope." },
      practices.tag,
      contributions.tag,
      certifications.tag,
      people.tag,
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Token from POST /auth/login. Expires after 8h." },
      },
      responses: {
        Unauthorized: err("Missing, invalid or expired token, or the account is inactive"),
        Forbidden: err("Signed in but missing the required permission at this scope"),
      },
      schemas: {
        ...practices.schemas,
        ...contributions.schemas,
        ...certifications.schemas,
        ...people.schemas,
        Error: { type: "object", required: ["error"], properties: { error: { type: "string", example: "Missing permission practices.roles.manage" } } },
        Id: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        ScopeType: { type: "string", enum: ["platform", "app", "practice", "group"] },
        Scope: {
          type: "object",
          properties: {
            type: ref("ScopeType"),
            id: { type: "string", nullable: true, description: "null for platform; app, practice or group id otherwise", example: "qa" },
            label: { type: "string", example: "QA" },
          },
        },
        AuthConfig: {
          type: "object",
          properties: {
            devLogin: { type: "boolean" },
            google: {
              type: "object",
              properties: {
                enabled: { type: "boolean", description: "True when the API has GOOGLE_CLIENT_ID set" },
                clientId: { type: "string", description: "Public OAuth Client ID for Google Identity Services. Only when enabled" },
              },
            },
            demoUsers: {
              type: "array",
              description: "Only present when devLogin is true",
              items: {
                type: "object",
                properties: {
                  username: { type: "string", example: "alex.rivera" },
                  displayName: { type: "string", example: "Alex Rivera" },
                  roles: { type: "array", items: { type: "string" }, example: ["Practice Lead"] },
                },
              },
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", example: "alex.rivera", description: "Username, or the email of someone who joined from an invitation" },
            password: { type: "string", format: "password", example: "[REDACTED]" },
          },
        },
        Token: { type: "object", required: ["token"], properties: { token: { type: "string", description: "JWT, valid 8h" } } },
        Grant: {
          type: "object",
          properties: {
            _id: { type: "string" },
            roleId: { type: "string", example: "practice_lead" },
            roleName: { type: "string", example: "Practice Lead" },
            scopeType: ref("ScopeType"),
            scopeId: { type: "string", nullable: true, example: "qa" },
            scopeLabel: { type: "string", example: "QA" },
            permissions: { type: "array", items: { type: "string" }, example: ["practices.members.view", "cert.plan.suggest"] },
          },
        },
        Me: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            displayName: { type: "string" },
            grants: { type: "array", items: ref("Grant") },
            apps: { type: "array", description: "Apps this user can see — derived from grants", items: ref("NamedRef") },
            practices: {
              type: "array",
              items: { type: "object", properties: { id: { type: "string" }, appId: { type: "string" }, name: { type: "string" } } },
            },
          },
        },
        NamedRef: { type: "object", properties: { id: { type: "string", example: "practices" }, name: { type: "string", example: "Practices" } } },
        Catalog: {
          type: "object",
          properties: {
            permissions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", example: "practices.members.view" },
                  appId: { type: "string", example: "practices" },
                  description: { type: "string" },
                },
              },
            },
            customRolePermissions: { type: "array", description: "Permissions allowed inside a custom role", items: { type: "string" } },
            apps: { type: "array", items: ref("NamedRef") },
            practices: { type: "array", items: ref("NamedRef") },
          },
        },
        Role: {
          type: "object",
          properties: {
            id: { type: "string", example: "practice_lead" },
            name: { type: "string", example: "Practice Lead" },
            description: { type: "string" },
            scopeType: ref("ScopeType"),
            scopeId: { type: "string", nullable: true, description: "Owning practice for custom roles" },
            isSystem: { type: "boolean" },
            assignableFrom: ref("ScopeType"),
            permissions: { type: "array", items: { type: "string" } },
            assignmentCount: { type: "integer" },
            canManage: { type: "boolean", description: "Caller may edit this role (custom: practices.roles.manage, may also delete; system: platform.roles.manage, Super Admin itself is never editable)" },
          },
        },
        CustomRoleCreate: {
          type: "object",
          required: ["name", "practiceId", "permissions"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            practiceId: { type: "string", description: "Practice that owns the role" },
            permissions: { type: "array", minItems: 1, items: { type: "string" }, description: "Subset of customRolePermissions the caller holds" },
          },
        },
        CustomRoleUpdate: {
          type: "object",
          properties: { name: { type: "string" }, description: { type: "string" }, permissions: { type: "array", minItems: 1, items: { type: "string" } } },
        },
        Assignment: {
          type: "object",
          properties: {
            id: { type: "string" },
            roleId: { type: "string" },
            roleName: { type: "string" },
            scopeType: ref("ScopeType"),
            scopeId: { type: "string", nullable: true },
            scopeLabel: { type: "string" },
            canRevoke: { type: "boolean", description: "Caller passes the escalation guard for this assignment" },
          },
        },
        DirectoryUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            displayName: { type: "string" },
            assignments: { type: "array", description: "Only assignments in scopes the caller can see", items: ref("Assignment") },
          },
        },
        AssignableOption: {
          type: "object",
          properties: { roleId: { type: "string" }, roleName: { type: "string" }, scopes: { type: "array", items: ref("Scope") } },
        },
        UsageReport: {
          type: "object",
          properties: {
            id: { type: "string" },
            period: { type: "string", example: "2026-10", description: "YYYY-MM" },
            fileName: { type: "string", example: "Claude-Usage-Riley-Patel-2026-10.pdf" },
            size: { type: "integer", description: "Bytes" },
            uploadedAt: { type: "string", format: "date-time" },
          },
        },
        UsageTeam: {
          type: "object",
          properties: {
            period: { type: "string", example: "2026-10" },
            summary: { type: "object", properties: { people: { type: "integer" }, submitted: { type: "integer" } } },
            people: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { type: "object", properties: { id: { type: "string" }, username: { type: "string" }, displayName: { type: "string" } } },
                  practices: { type: "array", items: ref("NamedRef") },
                  report: { ...ref("UsageReport"), nullable: true, description: "null = not submitted yet" },
                },
              },
            },
          },
        },
        AssignmentCreate: {
          type: "object",
          required: ["userId", "roleId", "scopeType"],
          properties: {
            userId: { type: "string", description: "User ObjectId" },
            roleId: { type: "string", example: "practice_lead" },
            scopeType: ref("ScopeType"),
            scopeId: { type: "string", nullable: true, description: "Ignored for platform scope", example: "qa" },
          },
        },
      },
    },
    paths: {
      "/": { get: { tags: ["System"], summary: "Service name", responses: { 200: json("OK", { type: "object", properties: { name: { type: "string" } } }) } } },
      "/health": { get: { tags: ["System"], summary: "Health check", responses: { 200: json("OK", { type: "object", properties: { status: { type: "string", example: "ok" } } }) } } },

      "/auth/config": {
        get: { tags: ["Auth"], summary: "Sign-in options for the login page", responses: { 200: json("Available sign-in methods", ref("AuthConfig")) } },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Dev password login",
          description: "Only when `AUTH_MODE=dev`. Unknown user and wrong password return the same 401.",
          requestBody: body(ref("LoginRequest")),
          responses: {
            200: json("Signed in", ref("Token")),
            400: err("Username or password missing"),
            401: err("Invalid username, email or password"),
            404: err("Password login is disabled"),
          },
        },
      },
      "/invites/{token}": {
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" }, description: "Token from the invitation email" }],
        get: {
          tags: ["Auth"],
          summary: "Look up an invitation (public)",
          description: "What the join page shows. No session needed — the token is the credential.",
          responses: {
            200: json("The invitation", {
              type: "object",
              properties: {
                email: { type: "string" },
                kind: { type: "string", enum: ["member", "manager", "lead"] },
                role: { type: "string", example: "Manager of Digital Engineering" },
                practice: ref("NamedRef"),
                invitedBy: { type: "string", description: "Inviter's display name" },
                expiresAt: { type: "string", format: "date-time" },
                hasAccount: { type: "boolean", description: "The email already has an account (e.g. it accepted another invitation)" },
                suggestedName: { type: "string" },
              },
            }),
            404: err("No such invitation"),
            410: err("Already used, withdrawn, expired, or the inviter can no longer make this appointment"),
          },
        },
      },
      "/invites/{token}/accept": {
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        post: {
          tags: ["Auth"],
          summary: "Accept an invitation and sign in (public)",
          description: "Creates the account for the invited email (or reuses it), applies what the invitation grants — re-checked against the inviter's grants now — and returns a session token. The link then stops working.",
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { displayName: { type: "string", maxLength: 80 } } } } } },
          responses: {
            200: json("Signed in", { type: "object", properties: { token: { type: "string" }, practiceId: { type: "string" }, username: { type: "string" } } }),
            403: err("The account for this email is deactivated"),
            404: err("No such invitation"),
            409: err("The appointment conflicts with the practice's current structure"),
            410: err("Already used, withdrawn, expired, or the inviter can no longer make this appointment"),
          },
        },
      },
      "/auth/google": {
        post: {
          tags: ["Auth"],
          summary: "Sign in with Google",
          description:
            "Exchanges a Google ID token (the `credential` Google Identity Services gives the browser) for a session. The token must be issued for this API's `GOOGLE_CLIENT_ID`, the email verified and, when `GOOGLE_ALLOWED_DOMAINS` is set, a Workspace account on one of those domains. The first sign-in creates the account with no roles (it opens no app until someone grants one); a deactivated account is refused.",
          requestBody: body({ type: "object", required: ["credential"], properties: { credential: { type: "string", description: "Google ID token (JWT)" } } }),
          responses: {
            200: json("Signed in", {
              type: "object",
              required: ["token", "created"],
              properties: { token: { type: "string", description: "JWT, valid 8h" }, created: { type: "boolean", description: "True when this sign-in created the account" } },
            }),
            400: err("Credential missing"),
            401: err("Invalid Google token, unverified email, or a domain that isn't allowed"),
            403: err("The account is deactivated"),
            501: err("Google sign-in isn't configured on this API"),
          },
        },
      },

      "/me": {
        get: {
          tags: ["Me"],
          summary: "Signed-in user, grants and visible apps",
          description: "The web app uses this only to hide/show UI — every route still enforces on its own.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Current user", ref("Me")), ...UNAUTH },
        },
      },

      "/rbac/catalog": {
        get: {
          tags: ["Roles"],
          summary: "Permission catalog, apps and practices",
          description: "Requires one of `practices.roles.view`, `practices.roles.assign`, `platform.apps.assign` at any scope.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Catalog", ref("Catalog")), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/rbac/roles": {
        get: {
          tags: ["Roles"],
          summary: "List roles",
          description: "System roles are always listed; custom roles only for practices where the caller has `practices.roles.view`.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Roles", { type: "array", items: ref("Role") }), ...UNAUTH, ...FORBIDDEN },
        },
        post: {
          tags: ["Roles"],
          summary: "Create a custom role in a practice",
          description: "Needs `practices.roles.manage` on the practice. Every permission must be allowed in custom roles and held by the caller there.",
          security: [{ bearerAuth: [] }],
          requestBody: body(ref("CustomRoleCreate"), { name: "QA Mentor", description: "Suggests certifications", practiceId: "qa", permissions: ["cert.plan.suggest"] }),
          responses: { 201: json("Created", ref("Id")), 400: err("Validation failed"), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/rbac/roles/{id}": {
        parameters: [idParam("Role id")],
        patch: {
          tags: ["Roles"],
          summary: "Edit a role",
          description:
            "Custom roles: same rules as create; the owning practice can't change. System roles: needs `platform.roles.manage` at platform scope; name, description and permissions are editable, scope and assignableFrom are fixed, `platform.*` permissions only on platform roles, and Super Admin (`*`) can't be edited.",
          security: [{ bearerAuth: [] }],
          requestBody: body(ref("CustomRoleUpdate")),
          responses: { 200: json("Updated", ref("Id")), 400: err("Validation failed"), ...UNAUTH, ...FORBIDDEN, 404: err("Role not found") },
        },
        delete: {
          tags: ["Roles"],
          summary: "Delete a custom role",
          description: "Fails with 409 while the role is still assigned to anyone.",
          security: [{ bearerAuth: [] }],
          responses: {
            204: { description: "Deleted" },
            400: err("System role"),
            ...UNAUTH,
            ...FORBIDDEN,
            404: err("Role not found"),
            409: err("Role is still assigned"),
          },
        },
      },

      "/rbac/users": {
        get: {
          tags: ["Users"],
          summary: "User directory with visible assignments",
          description:
            "Requires one of `practices.members.view`, `practices.roles.assign`, `platform.users.manage`, `platform.apps.assign`. All active users are listed; assignments are filtered to scopes the caller can see.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Users", { type: "array", items: ref("DirectoryUser") }), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/rbac/assignable": {
        get: {
          tags: ["Users"],
          summary: "Roles × scopes the caller may grant",
          description: "Pre-filtered by the escalation guard, so the picker never offers something the API would reject.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Options", { type: "array", items: ref("AssignableOption") }), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/rbac/assignments": {
        post: {
          tags: ["Users"],
          summary: "Grant a role at a scope",
          description: "Escalation guard: the caller needs the assign permission at the scope (from the role's `assignableFrom` level) and every permission in the role.",
          security: [{ bearerAuth: [] }],
          requestBody: body(ref("AssignmentCreate")),
          responses: {
            201: json("Granted", ref("Id")),
            400: err("Invalid user id"),
            ...UNAUTH,
            403: err("Escalation guard refused (reason in `error`)"),
            404: err("User or role not found"),
            409: err("User already holds this role at this scope"),
          },
        },
      },
      "/rbac/assignments/{id}": {
        parameters: [idParam("Assignment id")],
        delete: {
          tags: ["Users"],
          summary: "Revoke an assignment",
          description: "Guarded like granting. The last Super Admin can't be removed.",
          security: [{ bearerAuth: [] }],
          responses: {
            204: { description: "Revoked" },
            ...UNAUTH,
            403: err("Escalation guard refused"),
            404: err("Assignment not found"),
            409: err("Last Super Admin"),
          },
        },
      },

      "/ai/usage-reports/mine": {
        get: {
          tags: ["AI Tracker"],
          summary: "My usage reports",
          description: "Requires `ai.usage.manage:own`.",
          security: [{ bearerAuth: [] }],
          responses: { 200: json("Newest first", { type: "array", items: ref("UsageReport") }), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/ai/usage-reports/mine/{period}": {
        parameters: [PERIOD],
        put: {
          tags: ["AI Tracker"],
          summary: "Upload or replace my report for a month",
          description: "Body is the raw PDF (`Content-Type: application/pdf`, max 4 MB). One report per month; uploading again replaces it. Optional `?fileName=`.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "fileName", in: "query", schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
          responses: {
            200: json("Saved", ref("UsageReport")),
            400: err("Not a PDF, or bad / future period"),
            ...UNAUTH,
            ...FORBIDDEN,
            413: err("File is too large"),
          },
        },
        delete: {
          tags: ["AI Tracker"],
          summary: "Delete my report for a month",
          security: [{ bearerAuth: [] }],
          responses: { 204: { description: "Deleted" }, ...UNAUTH, ...FORBIDDEN, 404: err("No report for that month") },
        },
      },
      "/ai/usage-reports": {
        get: {
          tags: ["AI Tracker"],
          summary: "Team submissions for a month",
          description:
            "Requires `ai.usage.view`. Lists everyone the caller may see (their practice for a Practice Manager, everyone for AI Admin) who is expected to submit or has submitted, with the report or `null`.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "period", in: "query", required: true, schema: { type: "string", example: "2026-10" } }],
          responses: { 200: json("Team view", ref("UsageTeam")), 400: err("Bad period"), ...UNAUTH, ...FORBIDDEN },
        },
      },
      "/ai/usage-reports/{id}/file": {
        parameters: [idParam("Report id")],
        get: {
          tags: ["AI Tracker"],
          summary: "Download a report PDF",
          description: "Owner, or anyone with `ai.usage.view` over the owner's practice (or the whole AI Tracker).",
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: "The PDF", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } },
            ...UNAUTH,
            ...FORBIDDEN,
            404: err("Report not found"),
          },
        },
      },
      ...practices.paths,
      ...contributions.paths,
      ...certifications.paths,
      ...people.paths,
    },
  };
}

// Swagger UI from a pinned CDN build — no static assets to bundle into the Vercel function.
const SWAGGER_UI_VERSION = "5.17.14";
const docsHtml = (specUrl) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Practise360 API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
  <!-- Swagger UI's dark mode is partial (dark text on dark header), so pin the light theme. -->
  <meta name="color-scheme" content="light" />
  <style>html{color-scheme:light}body{margin:0;background:#fff}.topbar{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: "${specUrl}", dom_id: "#swagger-ui", persistAuthorization: true, tryItOutEnabled: true });
  </script>
</body>
</html>`;

module.exports = { buildSpec, docsHtml };
