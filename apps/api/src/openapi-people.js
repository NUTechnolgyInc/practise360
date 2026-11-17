// OpenAPI fragment for People profiles, merged into the spec by src/openapi.js.
const TAG = "People";
const err = (description) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const nullableList = (item, description) => ({ type: "array", items: ref(item), nullable: true, description });
const GroupRef = { type: "object", properties: { id: { type: "string", example: "digital-engineering-fullstack" }, name: { type: "string", example: "Fullstack" } } };

const schemas = {
  ProfilePractice: {
    type: "object",
    description: "A practice the person belongs to. Shown when the viewer could see this on the practice page.",
    properties: {
      id: { type: "string", example: "digital-engineering" },
      name: { type: "string", example: "Digital Engineering" },
      group: { ...GroupRef, nullable: true, description: "The group they sit in — null when they're in none, or the viewer can't see the member list" },
      roles: { type: "array", items: { type: "string" }, example: ["Practitioner"], description: "Practice-level roles" },
      groupRoles: {
        type: "array",
        items: { type: "object", properties: { role: { type: "string", example: "Practice Lead" }, group: GroupRef } },
      },
    },
  },
  ProfileRole: {
    type: "object",
    description: "A role above practice level (Practices Admin, Cert Admin, AI Admin, AI Member, Super Admin)",
    properties: {
      roleId: { type: "string", example: "practices_admin" },
      roleName: { type: "string", example: "Practices Admin" },
      scopeType: { $ref: "#/components/schemas/ScopeType" },
      scopeId: { type: "string", nullable: true, example: "practices" },
      scopeLabel: { type: "string", example: "Practices" },
    },
  },
  PersonProfile: {
    type: "object",
    properties: {
      id: { type: "string" },
      username: { type: "string", example: "de.dev1" },
      displayName: { type: "string", example: "Riley Patel" },
      email: { type: "string", nullable: true },
      isActive: { type: "boolean" },
      memberSince: { type: "string", format: "date-time", nullable: true },
      isSelf: { type: "boolean" },
      practices: { type: "array", items: ref("ProfilePractice") },
      appRoles: { type: "array", items: ref("ProfileRole") },
      contributions: nullableList("ContributionSummary", "Contributions they own or contribute to that the viewer can see. null = hidden from the viewer"),
      certifications: nullableList("CertPlanSummary", "Their certification plans the viewer can see. null = hidden (practitioners don't see each other's plans)"),
      usageReports: nullableList("UsageReport", "Their monthly Claude usage reports, newest first. null = hidden from the viewer"),
    },
  },
};

const paths = {
  "/people/{id}": {
    get: {
      tags: [TAG],
      summary: "A person's profile",
      description: [
        "Basic details, practices and roles, contributions, certification plans and Claude usage reports.",
        "Each part follows the rule of the screen it comes from (docs/rbac.md §4 \"People profiles\"), so a profile never shows more than those screens do.",
        "Anyone who can open the people directory sees an active person's name and username; otherwise the profile opens only when some part of it is visible.",
      ].join(" "),
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "User id" }],
      responses: {
        200: { description: "The profile, with hidden parts set to null", content: { "application/json": { schema: ref("PersonProfile") } } },
        401: { $ref: "#/components/responses/Unauthorized" },
        404: err("No such person, or nothing about them is visible to you"),
      },
    },
  },
};

module.exports = { tag: { name: TAG, description: "Profiles — what you may see of a person follows the screens that show them." }, schemas, paths };
