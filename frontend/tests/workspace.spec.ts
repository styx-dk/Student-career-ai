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
