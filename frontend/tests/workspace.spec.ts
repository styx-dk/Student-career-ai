import { test, expect, type Page } from "@playwright/test";

test("AI selection persists, tests the selected model, and can return to env defaults", async ({page}) => {
  await setup(page);
  const probes:Record<string,string>[]=[];
  await page.route("**/api/v1/ai/test", async route=>{
    const headers=route.request().headers();probes.push(headers);
    await route.fulfill({json:{provider:headers["x-ai-provider"],model:headers["x-ai-model"],message:"Structured generation succeeded."}});
  });
  await page.goto("/settings");
  await expect(page.getByText("Active:",{exact:false})).toContainText("env-model");
  await page.getByLabel("AI provider",{exact:true}).selectOption("gemini");
  await page.getByRole("button",{name:"Load available models"}).click();
  await expect(page.locator("#available-ai-models option")).toHaveAttribute("value","available-model");
  await page.getByLabel("Model ID",{exact:true}).fill("available-model");
  await expect(page.getByRole("button",{name:"Test active model"})).toBeDisabled();
  await page.getByRole("button",{name:"Save AI selection"}).click();
  await expect(page.getByText("Active:",{exact:false})).toContainText("available-model");
  await page.reload();
  await expect(page.getByLabel("Model ID",{exact:true})).toHaveValue("available-model");
  await page.getByRole("button",{name:"Test active model"}).click();
  await expect(page.getByText(/Structured generation succeeded/)).toBeVisible();
  expect(probes[0]["x-ai-model"]).toBe("available-model");
  await page.getByLabel("AI provider",{exact:true}).selectOption("ollama");
  await expect(page.getByText(/will not silently be sent to Gemini/)).toBeVisible();
  await page.getByRole("button",{name:"Save AI selection"}).click();
  await expect(page.getByText("Active:",{exact:false})).toContainText("ollama / local-model");
  await page.getByLabel("AI provider",{exact:true}).selectOption("default");
  await page.getByRole("button",{name:"Save AI selection"}).click();
  await expect(page.getByText("Active:",{exact:false})).toContainText("gemini / env-model");
  expect(await page.evaluate(()=>localStorage.getItem("career-compass:ai:test-user"))).toBeNull();
});

// All fixtures are isolated browser data. No request reaches a real user account.
test("delete controls confirm, cancel, and remove only selected items", async ({ page }) => {
  await setup(page);
  const deleted: string[] = [];
  await page.route("**/api/v1/resumes", route => route.fulfill({ json: [{ id: "resume-1", name: "Disposable resume", current_version: 1, created_at: "2026-09-29" }] }));
  await page.route("**/api/v1/resumes/resume-1", route => { deleted.push("resume"); return route.fulfill({ status: 204 }); });
  await page.goto("/resumes");
  await page.getByRole("button", { name: "Delete resume", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(deleted).toEqual([]);
  await page.getByRole("button", { name: "Delete resume", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No resumes yet" })).toBeVisible();
  const role = { id: "role-1", name: "Disposable role", raw_text: "Example role", requirements: [{ skill: "python", importance: "required", weight: 2 }] };
  await page.route("**/api/v1/job-descriptions", route => route.fulfill({ json: [role] }));
  await page.route("**/api/v1/job-descriptions/role-1", route => { deleted.push("role"); return route.fulfill({ status: 204 }); });
  await page.goto("/planning/roles");
  await page.getByRole("button", { name: "Delete target role" }).click();
  await expect(page.getByRole("dialog")).toContainText("Generated resumes are kept");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "What role would you like to explore?" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("career-target-role"))).toBeNull();
  await page.route("**/api/v1/career/plans", route => route.fulfill({ json: [{ id: "plan-1", job_description_id: "role-1", target_role: "Disposable role", current_readiness: 10, target_readiness: 80, actions: [], remaining_gaps: [] }] }));
  await page.route("**/api/v1/career/plans/plan-1", route => { deleted.push("plan"); return route.fulfill({ status: 204 }); });
  await page.route("**/api/v1/career/simulations?*", route => { deleted.push("simulations"); return route.fulfill({ status: 204 }); });
  await page.goto("/planning/actions");
  await page.getByRole("button", { name: "Delete plan", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name: "Saved plans for this role" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear what-if history" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.route("**/api/v1/folders", route => route.fulfill({ json: [{ id: "folder-1", name: "Empty folder", parent_id: null }] }));
  let fail = true;
  await page.route("**/api/v1/folders/folder-1", route => {
    if (fail) return route.fulfill({ status: 409, json: { detail: "Move or delete the folder contents first" } });
    deleted.push("folder"); return route.fulfill({ status: 204 });
  });
  await page.goto("/documents?folder=folder-1");
  await page.getByRole("button", { name: "Delete folder", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("dialog")).toContainText("Move or delete the folder contents first");
  fail = false;
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/documents$/);
  expect(deleted).toEqual(["resume", "role", "plan", "simulations", "folder"]);
});

test("career cockpit connects evidence and dark mode persists", async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Career cockpit", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "python 1 source" }).click();
  await expect(page.getByRole("link", { name: "Example Python project Reviewed document" })).toHaveAttribute("href", "/documents/doc-0");
  await expect(page.getByText("Show an API you built.")).toBeVisible();
  await expect(page.getByRole("link", { name: "View historical market context" })).toHaveAttribute("href", "/planning/trends?domain=Data%20Analytics&skill=python");
  await page.getByRole("link", { name: "View historical market context" }).click();
  await expect(page.getByRole("heading", { name: "python · Data Analytics" })).toBeVisible();
  await expect(page.getByText("Historical · LastValueBaseline")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "sql Build evidence" }).click();
  await expect(page.getByRole("heading", { name: "Your suggested mini-project" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { name: "Role → skills → evidence" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/cockpit-dark-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("profile explains strengths, evidence quality, role gaps and next actions", async ({ page }) => {
  await setup(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Your evidence-based story" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Strongest documented themes" })).toBeVisible();
  await expect(page.getByText("reviewed work · repeated evidence · Example source")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where the profile is reliable—and thin" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "API developer" })).toBeVisible();
  await expect(page.getByText("Show schema and queries.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your next three useful moves" })).toBeVisible();
  await page.screenshot({ path: "test-results/profile-insights.png", fullPage: true });
});

test("resume preview and authenticated PDF download", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/resumes", route => route.fulfill({ json: [{ id: "resume-1", name: "Example snapshot", current_version: 1, created_at: "2026-09-29" }] }));
  await page.route("**/api/v1/resumes/resume-1", route => route.fulfill({ json: { name: "Example snapshot", content: { professional_summary: "Example reviewed profile", skills: ["python"], projects: [{ id: "p1", title: "Example project", description: "Built an API" }] } } }));
  await page.route("**/api/v1/resumes/resume-1/pdf", route => {
    expect(route.request().headers().authorization).toContain("Bearer ");
    return route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\nExample test PDF" });
  });
  await page.goto("/resumes");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Example reviewed profile");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const link = page.getByRole("link", { name: "Open your PDF to review or download" });
  await expect(link).toHaveAttribute("href", /^blob:/);
  const event = page.waitForEvent("download");
  await link.click();
  expect((await event).suggestedFilename()).toBe("career-resume.pdf");
  await page.goto("/resumes?preview=resume-1");
  await expect(page.getByRole("dialog")).toContainText("Example reviewed profile");
});

test("student progress and resume entry review are actionable", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "You moved your profile forward today." })).toBeVisible();
  await page.getByText("Example resume · Needs review", { exact: false }).click();
  await expect(page.getByText("Check your education dates.")).toBeVisible();
  await page.route("**/api/v1/documents/doc-0", route => route.fulfill({ json: { ...docs[0], extraction: { ...analysis, document_type: "resume", entries: [{ ...analysis, title: "My education", document_type: "education" }, { ...analysis, title: "My project" }] } } }));
  await page.goto("/documents/doc-0");
  await page.getByRole("button", { name: "details", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Resume entries (2)" })).toBeVisible();
  await page.getByText("My education · education", { exact: true }).click();
  await page.getByLabel("Entry title", { exact: true }).first().fill("Updated education");
  await page.getByRole("button", { name: "Exclude this entry" }).first().click();
  await expect(page.getByRole("heading", { name: "Resume entries (1)" })).toBeVisible();
});

const analysis = {
  title: "Example API project",
  summary: "EXAMPLE: Built a documented API using Python and PostgreSQL.",
  document_type: "project",
  organization: "Example college",
  start_date: "2025-06-01",
  end_date: null,
  skills: Array.from({ length: 100 }, (_, i) => "Example skill " + i),
  mentioned_skills: ["Mention only"],
  accomplishments: ["EXAMPLE: Built an API"],
  uncertainties: ["Check issue date"],
};
const docs = Array.from({ length: 25 }, (_, i) => ({
  id: "doc-" + i,
  display_name:
    i === 0
      ? "Example project with a very long title ".repeat(6) + ".pdf"
      : "Example file " + i + ".pdf",
  original_filename: "example.pdf",
  document_type: "pdf",
  folder_id: null,
  mime_type: "application/pdf",
  file_size: 23000,
  created_at: "2026-01-01T12:00:00Z",
  processing_status: "needs_review",
  extraction: analysis,
  is_confirmed: false,
  has_confirmed_evidence: false,
}));
const records = Array.from({ length: 200 }, (_, i) => ({
  id: "record-" + i,
  title: "Example experience " + i,
  record_type: i % 5 === 0 ? "education" : "project",
  description: "EXAMPLE evidence. ".repeat(40),
  organization: "Example college",
  start_date: i % 2 ? "2025-06-01" : null,
  end_date: null,
  skills: analysis.skills,
  evidence_state: "user_confirmed",
  source_document_id: "doc-0",
  created_at: "2026-01-01T12:00:00Z",
}));
const evidence = {
  summary: "EXAMPLE profile summary. ".repeat(40),
  insights: { strengths: [{ skill: "Example skill 0", source_count: 2, contexts: ["Example source"], confidence: "repeated evidence", basis: "reviewed work" }], portfolio_health: { reviewed_entries: 200, documented_skills: 100, dated_entries: 100, multi_source_skills: 1, resume_claim_entries: 0 }, limitations: [{ code: "dates", text: "Some entries need dates.", href: "/profile?tab=timeline" }], alignment: { role_id: "role-1", role_name: "API developer", score: 50, supported: [{ skill: "python" }], gaps: [{ skill: "sql", evidence_expectation: "Show schema and queries." }], general_competencies: [], disclaimer: "Not a hiring probability." }, next_steps: [{ code: "sql", text: "Build evidence for SQL.", href: "/planning/roles" }] },
  skills: Array.from({ length: 100 }, (_, i) => ({
    name: "Example skill " + i,
    sources: [
      { record_id: "record-0", title: "Example source", document_id: "doc-0" },
    ],
  })),
  records,
};
async function setup(page: Page, empty = false) {
  await page.addInitScript(() => {
    const payload = btoa(JSON.stringify({ sub: "test-user", exp: 4102444800 }));
    localStorage.setItem(
      "sb-example-auth-token",
      JSON.stringify({
        access_token: "e30." + payload + ".test",
        refresh_token: "test-only",
        token_type: "bearer",
        expires_at: 4102444800,
        expires_in: 3600,
        user: {
          id: "test-user",
          email: "example@test.invalid",
          aud: "authenticated",
          role: "authenticated",
          user_metadata: { full_name: "Example Student" },
          app_metadata: {},
          created_at: "2026-01-01",
        },
      }),
    );
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.hostname !== "workspace.test") return route.abort();
    const path = url.pathname.replace("/api/v1", "");
    let body: unknown;
    if (path === "/ai/config") {
      const headers = route.request().headers();
      body = {provider:headers["x-ai-provider"]||"gemini",model:headers["x-ai-model"]||"env-model",source:headers["x-ai-provider"]?"browser preference":"server .env",default_provider:"gemini",gemini_model:"env-model",ollama_model:"local-model",gemini_configured:true,image_support:true};
    }
    else if (path === "/ai/models") body={models:[{id:"available-model",label:"Available example model"}]};
    else if (path === "/documents") body = empty ? [] : docs;
    else if (path === "/folders") body = [];
    else if (path.startsWith("/documents/"))
      body = docs.find((d) => path === "/documents/" + d.id) || docs[0];
    else if (path === "/profile/evidence")
      body = empty ? { summary: null, skills: [], records: [] } : evidence;
    else if (path === "/profile/cockpit") body = { roles: empty ? [] : [{ id: "role-1", name: "API developer" }], selected_role: empty ? null : "role-1", requirements: empty ? [] : [{ skill: "python", importance: "required", category: "technical", classification: "Strong Match", similarity: 1, evidence_expectation: "Show an API you built.", source_excerpt: "Python required", market_contexts: ["Data Analytics"], sources: [{ title: "Example Python project", document_id: "doc-0", record_id: "record-0", basis: "Reviewed document" }] }, { skill: "sql", importance: "required", category: "technical", classification: "Missing", similarity: 0, evidence_expectation: "Show schema and queries.", market_contexts: ["Data Analytics"], sources: [] }], supported: empty ? 0 : 1, total: empty ? 0 : 2, general_competencies: ["team communication"], resumes: [], journey: [{ label: "Collect", count: empty ? 0 : 25, detail: "documents", href: "/documents" }, { label: "Understand", count: empty ? 0 : 200, detail: "entries", href: "/profile" }, { label: "Prepare", count: empty ? 0 : 1, detail: "roles", href: "/planning/roles" }, { label: "Apply", count: 0, detail: "resumes", href: "/resumes" }] };
    else if (path === "/profile/progress") body = { days: [{ date: "2026-09-29", completed: true }], active_days: 1, reviewed_today: true, quests: [{ title: "Review one document", detail: "Check your extracted facts.", href: "/documents/doc-0" }], resumes: [{ id: "doc-0", name: "Example resume", confirmed: false, issues: ["Check your education dates."] }] };
    else if (path === "/forecasts/catalog") body = { "Data Analytics": ["python", "sql"] };
    else if (path === "/forecasts") body = { domain: "Data Analytics", skill: url.searchParams.get("skill"), historical: [{ month: "2023-12-01", demand_rate: .3, job_count: 30, total_jobs: 100 }], forecast: [{ month: "2024-01-01", predicted_rate: .3, lower_bound: .2, upper_bound: .4, trend: "Stable", model: "LastValueBaseline" }], notice: "Historical experiment; not a current market prediction.", available: true, scope: "historical_experiment" };
    else if (path === "/records") body = empty ? [] : records;
    else if (path === "/profile")
      body = {
        id: "profile-0",
        full_name: "Example Student",
        headline: "Student",
        phone: "",
        location: "",
        preferred_domains: [],
      };
    else if (path === "/diagnostics")
      body = {
        database: "connected",
        storage: "available",
        ai_provider: "gemini",
      };
    else if (
      [
        "/job-descriptions",
        "/career/actions",
        "/career/plans",
        "/resumes",
      ].includes(path)
    )
      body = [];
    else
      return route.fulfill({
        status: 404,
        json: { detail: "Unmocked request: " + path },
      });
    return route.fulfill({ status: 200, json: body });
  });
}

test("large profile is bounded, searchable and source-linked", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/profile");
  await expect(page.locator(".skill-card")).toHaveCount(8);
  await page.getByRole("button", { name: "View all (100)" }).click();
  await expect(page.locator(".skill-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".skill-card").first()).toContainText(
    "Example skill 12",
  );
  await page.getByLabel("Search skills").fill("Example skill 99");
  await expect(page.locator(".skill-card")).toHaveCount(1);
  await page.locator(".skill-card").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".skill-card").click();
  await page.getByRole("link", { name: "Open source" }).click();
  await expect(page).toHaveURL(/documents\/doc-0/);
  await expect(
    page.getByRole("heading", { name: "What this document says" }),
  ).toBeVisible();
});

test("document library and skill review stay bounded", async ({ page }) => {
  await setup(page);
  let reviewBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/documents/doc-0/review", async (route) => {
    reviewBody = route.request().postDataJSON();
    await route.fulfill({ json: { status: "accepted" } });
  });
  await page.goto("/documents");
  await expect(page.locator(".file-row")).toHaveCount(20);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".file-row")).toHaveCount(5);
  await page.goto("/documents/doc-0");
  await page.getByRole("button", { name: "skills (100)", exact: true }).click();
  await expect(page.locator(".skill-edit")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Exclude", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "skills (99)", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save corrections & update profile" })
    .click();
  await expect(
    page.getByText("Saved. Your career profile now includes these details."),
  ).toBeVisible();
  expect(
    (reviewBody?.corrected_result as { skills: string[] }).skills,
  ).toHaveLength(99);
  expect(
    (reviewBody?.corrected_result as { skills: string[] }).skills,
  ).not.toContain("Mention only");
});

test("profile experience is paginated and legacy routes redirect", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/repository");
  await expect(page).toHaveURL(/profile\?tab=experience/);
  await expect(page.locator(".record-grid .card")).toHaveCount(8);
  await page.getByRole("button", { name: "education", exact: true }).click();
  await expect(page.locator(".record-grid .card")).toHaveCount(8);
  await page.getByRole("button", { name: "timeline", exact: true }).click();
  await expect(page.locator(".timeline .card")).toHaveCount(8);
  await page.goto("/jobs");
  await expect(page).toHaveURL(/planning\/roles/);
  await expect(
    page.getByRole("heading", { name: "What role would you like to explore?" }),
  ).toBeVisible();
});

test("empty screens provide useful next steps", async ({ page }) => {
  await setup(page, true);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Start with one document" }),
  ).toBeVisible();
  await page.goto("/resumes");
  await expect(
    page.getByRole("button", { name: "Create resume" }),
  ).toBeDisabled();
  await page.goto("/planning/actions");
  await expect(
    page.getByRole("link", { name: "Add target role" }),
  ).toBeVisible();
});

for (const width of [390, 1366]) {
  test(
    "layout has no horizontal overflow at " + width + "px",
    async ({ page }) => {
      await setup(page);
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/dashboard",
        "/documents",
        "/documents/doc-0",
        "/profile?tab=skills",
        "/profile?tab=experience",
        "/planning/roles",
        "/planning/actions",
        "/planning/trends",
        "/resumes",
        "/settings",
      ]) {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator(".loading")).toHaveCount(0);
        const dimensions = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));
        expect(dimensions.scroll, path).toBeLessThanOrEqual(
          dimensions.viewport,
        );
        if (["/dashboard", "/documents", "/documents/doc-0"].includes(path)) {
          await page.screenshot({
            path:
              "test-results/" +
              path.replaceAll("/", "-") +
              "-" +
              width +
              ".png",
            fullPage: true,
          });
        }
      }
      if (width === 390) {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page
          .getByRole("link", { name: "Documents", exact: true })
          .click();
        await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
      }
      await page.goto("/profile?tab=skills");
      await expect(page.locator(".skill-card")).toHaveCount(12);
      await page.screenshot({
        path: "test-results/profile-" + width + ".png",
        fullPage: true,
      });
    },
  );
}

test("failed data load offers retry instead of an endless spinner", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/profile/evidence", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Example temporary failure" },
    }),
  );
  await page.goto("/profile");
  await expect(page.getByRole("alert")).toContainText(
    "Example temporary failure",
  );
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.unroute("**/api/v1/profile/evidence");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator(".skill-card")).toHaveCount(8);
});
