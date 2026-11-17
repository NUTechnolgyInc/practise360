// AI-API — Claude usage reports: upload rules, replace/delete, team-view scope, PDF access (docs/rbac.md §4 "Claude usage reports").
// Uses platform.* / qa.* / multi.user and months 2–6 back, so the UI suite (ai.* users, last month) never overlaps.
const { test, expect, previousMonth } = require("../../support/fixtures");
const { makePdf, bigBuffer, MB } = require("../../support/files");

const put = (client, period, buffer = makePdf(), type = "application/pdf", fileName) =>
  client.upload("PUT", `/ai/usage-reports/mine/${period}${fileName ? `?fileName=${encodeURIComponent(fileName)}` : ""}`, buffer, type);

const nextMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
};

async function team(client, period) {
  return client.json(`/ai/usage-reports?period=${period}`);
}

test.describe("Usage reports API — own reports", () => {
  test("[AI-API-01] practitioner uploads a PDF for a past month and sees it in their list", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(2);
    const res = await put(dev, period, makePdf("Drew report"), "application/pdf", "drew-usage.pdf");
    expect(res.status()).toBe(200);
    const report = await res.json();
    expect(report).toMatchObject({ period, fileName: "drew-usage.pdf" });
    expect(report.size).toBeGreaterThan(100);
    const mine = await dev.json("/ai/usage-reports/mine");
    expect(mine.map((r) => r.period)).toContain(period);
    await dev.delete(`/ai/usage-reports/mine/${period}`);
  });

  test("[AI-API-02] uploading again for the same month replaces the report (one per month)", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(3);
    await put(dev, period, makePdf("v1"), "application/pdf", "v1.pdf");
    const second = await (await put(dev, period, makePdf("version two is longer"), "application/pdf", "v2.pdf")).json();
    const mine = (await dev.json("/ai/usage-reports/mine")).filter((r) => r.period === period);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ fileName: "v2.pdf", size: second.size });
    await dev.delete(`/ai/usage-reports/mine/${period}`);
  });

  test("[AI-API-03] the current month is accepted (not in the future)", async ({ as }) => {
    const dev = await as("platform.dev1");
    const current = new Date().toISOString().slice(0, 7);
    expect((await put(dev, current)).status()).toBe(200);
    await dev.delete(`/ai/usage-reports/mine/${current}`);
  });

  for (const period of ["NEXT", "2026-13", "2026-00", "2026-1", "26-01", "abcd-ef", "2026-10-01"]) {
    test(`[AI-API-04] period "${period}" is refused → 400`, async ({ as }) => {
      const p = period === "NEXT" ? nextMonth() : period;
      const res = await put(await as("platform.dev1"), p);
      expect(res.status(), p).toBe(400);
      expect((await res.json()).error).toMatch(/Period must be YYYY-MM/);
    });
  }

  test("[AI-API-05] a non-PDF file renamed with a PDF content type is rejected by its magic bytes", async ({ as }) => {
    const res = await put(await as("platform.dev1"), previousMonth(2), Buffer.from("PK\u0003\u0004 not really a pdf"), "application/pdf", "fake.pdf");
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/Upload a PDF file/);
  });

  test("[AI-API-06] a real PDF sent with the wrong content type is refused", async ({ as }) => {
    const res = await put(await as("platform.dev1"), previousMonth(2), makePdf(), "text/plain");
    expect(res.status()).toBe(400);
  });

  test("[AI-API-07] a PDF over 4 MB → 413", async ({ as }) => {
    const res = await put(await as("platform.dev1"), previousMonth(2), bigBuffer(4 * MB + 1, "%PDF-1.4\n"));
    expect(res.status()).toBe(413);
  });

  test("[AI-API-08] a PDF just under 4 MB is accepted (boundary)", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(4);
    const res = await put(dev, period, bigBuffer(4 * MB - 1024, "%PDF-1.4\n"));
    expect(res.status()).toBe(200);
    await dev.delete(`/ai/usage-reports/mine/${period}`);
  });

  test("[AI-API-09] delete own report → 204; deleting again → 404", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(5);
    await put(dev, period);
    expect((await dev.delete(`/ai/usage-reports/mine/${period}`)).status()).toBe(204);
    expect((await dev.delete(`/ai/usage-reports/mine/${period}`)).status()).toBe(404);
  });

  test("[AI-API-10] file names are sanitised", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(6);
    const report = await (await put(dev, period, makePdf(), "application/pdf", '../../secret"<x>.pdf')).json();
    expect(report.fileName).not.toMatch(/[/"<>]/);
    await dev.delete(`/ai/usage-reports/mine/${period}`);
  });

  test("[AI-API-11] users without AI permissions can't use reports at all", async ({ as }) => {
    const cert = await as("cert.admin");
    expect((await cert.get("/ai/usage-reports/mine")).status()).toBe(403);
    expect((await put(cert, previousMonth(2))).status()).toBe(403);
    expect((await cert.get(`/ai/usage-reports?period=${previousMonth(2)}`)).status()).toBe(403);
    expect((await (await as(null)).get("/ai/usage-reports/mine")).status()).toBe(401);
  });
});

test.describe("Usage reports API — team view & access", () => {
  test("[AI-API-12] Practice Manager's team view is exactly their practice", async ({ as }) => {
    const view = await team(await as("platform.manager"), previousMonth(2));
    expect(view.people.map((p) => p.user.username).sort()).toEqual(["platform.dev1", "platform.lead", "platform.manager"]);
  });

  test("[AI-API-13] a member of two practices shows up for both Managers", async ({ as }) => {
    const qa = (await team(await as("qa.manager"), previousMonth(2))).people.map((p) => p.user.username);
    const ai = (await team(await as("ai.manager"), previousMonth(2))).people.map((p) => p.user.username);
    expect(qa).toContain("multi.user");
    expect(ai).toContain("multi.user");
    expect(qa).not.toContain("platform.dev1");
  });

  test("[AI-API-14] AI Admin sees everyone expected to submit, including people with no practice; Super Admin isn't expected", async ({ as }) => {
    const people = (await team(await as("aitracker.admin"), previousMonth(2))).people.map((p) => p.user.username);
    expect(people).toEqual(expect.arrayContaining(["aitracker.member", "multi.user", "de.dev1", "qa.tester1", "practices.admin"]));
    expect(people).not.toContain("superadmin");
    expect(people).not.toContain("cert.admin");
  });

  test("[AI-API-15] Practices Admin sees every practice member but not AI-only members", async ({ as }) => {
    const people = (await team(await as("practices.admin"), previousMonth(2))).people.map((p) => p.user.username);
    expect(people).toEqual(expect.arrayContaining(["de.dev1", "platform.dev1", "qa.tester1", "ai.dev1", "multi.user"]));
    expect(people).not.toContain("aitracker.member");
  });

  for (const username of ["de.lead", "de.dev1", "aitracker.member"]) {
    test(`[AI-API-16] ${username} (no ai.usage.view) can't open the team view`, async ({ as }) => {
      expect((await (await as(username)).get(`/ai/usage-reports?period=${previousMonth(2)}`)).status()).toBe(403);
    });
  }

  test("[AI-API-17] team view needs a valid, non-future period", async ({ as }) => {
    const manager = await as("platform.manager");
    expect((await manager.get("/ai/usage-reports")).status()).toBe(400);
    expect((await manager.get(`/ai/usage-reports?period=${nextMonth()}`)).status()).toBe(400);
  });

  test("[AI-API-18] submitted / pending summary follows uploads", async ({ as }) => {
    const manager = await as("platform.manager");
    const dev = await as("platform.dev1");
    const period = previousMonth(2);
    const before = await team(manager, period);
    await put(dev, period);
    const after = await team(manager, period);
    expect(after.summary.submitted).toBe(before.summary.submitted + 1);
    expect(after.people.find((p) => p.user.username === "platform.dev1").report).toMatchObject({ period });
    await dev.delete(`/ai/usage-reports/mine/${period}`);
  });

  test("[AI-API-19] PDF access: owner, their Manager and AI Admin yes; same-practice Lead and other Managers no", async ({ as }) => {
    const dev = await as("platform.dev1");
    const period = previousMonth(3);
    const { id } = await (await put(dev, period, makePdf("access check"))).json();
    try {
      for (const [user, status] of [
        ["platform.dev1", 200],
        ["platform.manager", 200],
        ["aitracker.admin", 200],
        ["superadmin", 200],
        ["practices.admin", 200],
        ["platform.lead", 403],
        ["qa.manager", 403],
        ["de.dev1", 403],
      ]) {
        const res = await (await as(user)).get(`/ai/usage-reports/${id}/file`);
        expect(res.status(), user).toBe(status);
        if (status === 200) {
          expect(res.headers()["content-type"]).toBe("application/pdf");
          expect(res.headers()["cache-control"]).toBe("private, no-store");
          expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
        }
      }
    } finally {
      await dev.delete(`/ai/usage-reports/mine/${period}`);
    }
  });

  test("[AI-API-20] unknown or malformed report ids → 404", async ({ as }) => {
    const admin = await as("aitracker.admin");
    expect((await admin.get("/ai/usage-reports/64b000000000000000000000/file")).status()).toBe(404);
    expect((await admin.get("/ai/usage-reports/../../etc/file")).status()).toBe(404);
  });

  test("[AI-API-21] a multi-practice member's report is readable by both of their Managers", async ({ as }) => {
    const multi = await as("multi.user");
    const period = previousMonth(4);
    const { id } = await (await put(multi, period)).json();
    try {
      for (const manager of ["qa.manager", "ai.manager"]) {
        expect((await (await as(manager)).get(`/ai/usage-reports/${id}/file`)).status(), manager).toBe(200);
      }
      expect((await (await as("de.manager")).get(`/ai/usage-reports/${id}/file`)).status()).toBe(403);
    } finally {
      await multi.delete(`/ai/usage-reports/mine/${period}`);
    }
  });
});
