const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const originalSecret = process.env.JWT_SECRET;
const originalUrl = process.env.PUBLIC_API_URL;
process.env.JWT_SECRET = "report-unit-test-secret";

const {
  signReportToken,
  readReportToken,
  signDecisionToken,
  readDecisionToken,
  signAuditToken,
  readAuditToken,
  reportUrl,
  auditUrl,
} = require("../services/blockedUploads/links");
const { cleanIp, fullName } = require("../services/blockedUploads/report");
const {
  escapeHtml,
  readableSize,
  renderReportPage,
  renderAuditPage,
  renderMessagePage,
} = require("../services/blockedUploads/pages");

test.after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalUrl === undefined) delete process.env.PUBLIC_API_URL;
  else process.env.PUBLIC_API_URL = originalUrl;
});

test("report tokens belong to one report and one person and cannot be forged", () => {
  const token = signReportToken("report-1", "user-1");
  assert.equal(readReportToken(token, "report-1"), "user-1");
  assert.equal(readReportToken(token, "report-2"), null);
  assert.equal(readReportToken(token + "x", "report-1"), null);
  assert.equal(readReportToken("", "report-1"), null);
  assert.equal(readReportToken(undefined, "report-1"), null);
  assert.equal(readReportToken(["a"], "report-1"), null);
  assert.equal(
    readReportToken(signReportToken("report-1", "user-1", { expiresIn: -5 }), "report-1"),
    null,
  );
  assert.equal(
    readReportToken(
      jwt.sign({ purpose: "blocked-upload-report", report: "report-1", user: "user-1" }, process.env.JWT_SECRET),
      "report-1",
    ),
    null,
  );
  assert.equal(
    readReportToken(jwt.sign({ id: "user-1" }, process.env.JWT_SECRET), "report-1"),
    null,
  );
});

test("report links always point at the configured server and never at a request header", () => {
  delete process.env.PUBLIC_API_URL;
  assert.match(reportUrl("abc", "user-1"), /^http:\/\/localhost:\d+\/api\/okr\/blocked-uploads\/abc\?token=/);

  process.env.PUBLIC_API_URL = "https://api.example.test/some/path/";
  const link = new URL(reportUrl("abc", "user-1"));
  assert.equal(link.origin, "https://api.example.test");
  assert.equal(link.pathname, "/api/okr/blocked-uploads/abc");
  assert.equal(readReportToken(link.searchParams.get("token"), "abc"), "user-1");

  for (const bad of ["javascript:alert(1)", "not a url", "ftp://example.test"]) {
    process.env.PUBLIC_API_URL = bad;
    assert.match(reportUrl("abc", "user-1"), /^http:\/\/localhost:\d+\/api\/okr\//);
  }
});

test("the report page escapes every value, including hostile ones", () => {
  const hostile = '<script>alert(1)</script><img src=x onerror="alert(2)">';
  const html = renderReportPage({
    filename: hostile,
    extension: ".pdf",
    claimedType: hostile,
    detectedType: "Windows program",
    size: 2048,
    sha256: "a".repeat(64),
    threat: hostile,
    senderName: hostile,
    senderEmail: hostile,
    senderRoles: [hostile],
    ip: hostile,
    objectiveTitle: hostile,
    keyResultTitle: hostile,
    hexHead: hostile,
    createdAt: new Date("2026-10-03T00:00:00Z"),
    expireAt: new Date("2026-10-17T00:00:00Z"),
    preview: {
      kind: "archive",
      total: 1,
      truncated: false,
      problem: hostile,
      entries: [{ name: hostile, size: 10, flagged: true, reason: hostile }],
    },
  });
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("<img"), false);
  assert.equal(html.includes("onerror=\"alert"), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /2\.0 KB/);
  assert.match(html, /class="warn">Windows program/);
  assert.match(html, /kept until 2026-10-17/);

  for (const preview of [
    { kind: "text", text: hostile, truncated: true },
    { kind: "indicators", items: [hostile] },
    { kind: "indicators", items: [] },
    { kind: "none" },
    undefined,
  ]) {
    const page = renderReportPage({
      filename: "a.txt",
      extension: ".txt",
      claimedType: "text/plain",
      detectedType: "Plain text",
      size: 1,
      sha256: "b".repeat(64),
      threat: "x",
      senderName: "A",
      senderEmail: "a@x.test",
      senderRoles: [],
      objectiveTitle: "O",
      keyResultTitle: "K",
      hexHead: "",
      createdAt: new Date(),
      expireAt: new Date(),
      preview,
    });
    assert.equal(page.includes("<script"), false);
    assert.equal(page.includes("<img"), false);
  }

  assert.equal(renderMessagePage("<b>", "<i>").includes("<b>"), false);
});

test("small formatting helpers behave", () => {
  assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
  assert.equal(readableSize(500), "500 bytes");
  assert.equal(readableSize(1536), "1.5 KB");
  assert.equal(readableSize(5 * 1024 * 1024), "5.0 MB");
});

test("decision tokens are separate from report tokens and expire quickly", () => {
  const decision = signDecisionToken("report-1", "user-1");
  assert.equal(readDecisionToken(decision, "report-1"), "user-1");
  assert.equal(readDecisionToken(decision, "report-2"), null);
  assert.equal(readDecisionToken(decision + "x", "report-1"), null);
  assert.equal(readDecisionToken(undefined, "report-1"), null);
  assert.equal(readDecisionToken(["a"], "report-1"), null);
  assert.equal(readDecisionToken({}, "report-1"), null);
  assert.equal(
    readDecisionToken(signDecisionToken("report-1", "user-1", { expiresIn: -5 }), "report-1"),
    null,
  );
  assert.equal(readDecisionToken(signReportToken("report-1", "user-1"), "report-1"), null);
  assert.equal(readReportToken(decision, "report-1"), null);
  assert.equal(
    readDecisionToken(
      jwt.sign({ purpose: "blocked-upload-decision", report: "report-1", user: "user-1" }, process.env.JWT_SECRET),
      "report-1",
    ),
    null,
  );

  const lifetime = jwt.decode(decision);
  assert.ok(lifetime.exp - lifetime.iat <= 60 * 60);
});

function pageReport(extra = {}) {
  return {
    _id: "64f0c0ffee0123456789abcd",
    filename: "form.pdf",
    extension: ".pdf",
    claimedType: "application/pdf",
    detectedType: "PDF document",
    size: 10,
    sha256: "c".repeat(64),
    threat: "the PDF contains scripts, launch actions or embedded files",
    reviewable: true,
    status: "blocked",
    senderName: "Sam Lee",
    senderEmail: "sam@x.test",
    senderRoles: [],
    objectiveTitle: "O",
    keyResultTitle: "K",
    hexHead: "",
    createdAt: new Date("2026-10-03T00:00:00Z"),
    expireAt: new Date("2026-10-17T00:00:00Z"),
    preview: { kind: "none" },
    ...extra,
  };
}

test("a reviewable report shows a confirmed approve and decline form only when a decision token is given", () => {
  const withForm = renderReportPage(pageReport(), { decisionToken: 'tok"><script>x</script>' });
  assert.match(withForm, /<form method="post" action="64f0c0ffee0123456789abcd\/decision">/);
  assert.match(withForm, /name="confirm" value="yes" required/);
  assert.match(withForm, /name="decision" value="approve">Approve this file/);
  assert.match(withForm, /name="decision" value="decline" formnovalidate>Decline/);
  assert.match(withForm, /once in the next 48 hours/);
  assert.match(withForm, /approve or decline at the bottom/);
  assert.equal(withForm.includes("<script"), false);
  assert.match(withForm, /tok&quot;&gt;&lt;script&gt;/);

  const withoutToken = renderReportPage(pageReport());
  assert.equal(withoutToken.includes("<form"), false);
  assert.equal(withoutToken.includes("Your decision"), false);
});

test("a final block has no approve option and says so", () => {
  const html = renderReportPage(pageReport({ reviewable: false }), { decisionToken: "tok" });
  assert.equal(html.includes("<form"), false);
  assert.match(html, /This block is final/);
  assert.match(html, /Sam Lee to send a different file/);
});

test("decided reports show who decided and what happens next, with no form", () => {
  const future = new Date(Date.now() + 3600 * 1000);
  const past = new Date(Date.now() - 3600 * 1000);
  const decidedAt = new Date("2026-10-03T01:00:00Z");
  const base = { decidedByName: "Priya <b>Rao</b>", decidedAt };

  const approved = renderReportPage(
    pageReport({ ...base, status: "approved", approvalExpiresAt: future }),
    { decisionToken: "tok" },
  );
  assert.match(approved, /A manager approved this file/);
  assert.match(approved, /Priya &lt;b&gt;Rao&lt;\/b&gt; approved it on 2026-10-03 01:00 UTC/);
  assert.match(approved, /Sam Lee can upload this exact file once before/);
  assert.match(approved, /banner ok/);
  assert.equal(approved.includes("<form"), false);
  assert.equal(approved.includes("<b>Rao"), false);

  const expired = renderReportPage(
    pageReport({ ...base, status: "approved", approvalExpiresAt: past }),
  );
  assert.match(expired, /The approval has expired/);
  assert.match(expired, /banner wait/);

  const used = renderReportPage(
    pageReport({ ...base, status: "used", approvalExpiresAt: future, usedAt: new Date("2026-10-03T02:00:00Z") }),
  );
  assert.match(used, /Approved and uploaded/);
  assert.match(used, /Sam Lee uploaded it on 2026-10-03 02:00 UTC/);

  const declined = renderReportPage(pageReport({ ...base, status: "declined" }));
  assert.match(declined, /This file was declined/);
  assert.equal(declined.includes("<form"), false);
});

test("small helpers tidy up names and addresses", () => {
  assert.equal(cleanIp("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(cleanIp("::1"), "::1");
  assert.equal(cleanIp(undefined), "");
  assert.equal(fullName({ firstName: "Sam", lastName: "Lee" }, "x"), "Sam Lee");
  assert.equal(fullName({ firstName: "Sam" }, "x"), "Sam");
  assert.equal(fullName({}, "Unknown user"), "Unknown user");
});

test("audit tokens belong to one person and cannot be used as report or decision tokens", () => {
  const token = signAuditToken("user-1");
  assert.equal(readAuditToken(token), "user-1");
  assert.equal(readAuditToken(token + "x"), null);
  assert.equal(readAuditToken(""), null);
  assert.equal(readAuditToken(undefined), null);
  assert.equal(readAuditToken({ a: 1 }), null);
  assert.equal(readAuditToken(signReportToken("all", "user-1")), null);
  assert.equal(readAuditToken(signDecisionToken("all", "user-1")), null);
  assert.equal(readReportToken(token, "all"), null);
  assert.equal(readDecisionToken(token, "all"), null);
  assert.equal(readAuditToken(signAuditToken("user-1", { expiresIn: -5 })), null);
  assert.equal(
    readAuditToken(jwt.sign({ purpose: "blocked-upload-audit", report: "all", user: "user-1" }, "wrong")),
    null,
  );
  const lifetime = jwt.decode(token);
  assert.ok(lifetime.exp - lifetime.iat <= 7 * 24 * 60 * 60);
});

test("audit links carry the token and any filters", () => {
  process.env.PUBLIC_API_URL = "https://api.example.test/ignored/path";
  const link = new URL(auditUrl("user-9", { status: "waiting", q: "a b&c" }));

  assert.equal(link.origin, "https://api.example.test");
  assert.equal(link.pathname, "/api/okr/blocked-uploads");
  assert.equal(link.searchParams.get("status"), "waiting");
  assert.equal(link.searchParams.get("q"), "a b&c");
  assert.equal(readAuditToken(link.searchParams.get("token")), "user-9");
});

function auditView(extra = {}) {
  return {
    token: "tok",
    status: "all",
    query: "",
    pageNumber: 1,
    pageCount: 1,
    previousUrl: "",
    nextUrl: "",
    filters: [
      { label: "All", count: 2, active: true, url: "/a" },
      { label: "Waiting", count: 1, active: false, url: "/b" },
    ],
    rows: [],
    ...extra,
  };
}

test("the audit page shows rows, outcomes and who decided, all escaped", () => {
  const html = renderAuditPage(
    auditView({
      rows: [
        {
          url: "https://x.test/r?token=a&b=1",
          filename: "<img src=x onerror=1>.pdf",
          senderName: "Sam <b>Lee</b>",
          senderEmail: "sam@x.test",
          threat: "the PDF contains scripts, launch actions or embedded files",
          status: "approved",
          reviewable: true,
          attempts: 3,
          createdAt: new Date("2026-10-03T00:00:00Z"),
          decidedByName: "Priya <i>Rao</i>",
        },
        {
          url: "/r2",
          filename: "b.txt",
          senderName: "Al",
          senderEmail: "al@x.test",
          threat: "it contains a known virus test signature",
          status: "blocked",
          reviewable: false,
          createdAt: new Date("2026-10-02T00:00:00Z"),
        },
      ],
    }),
  );

  assert.equal(html.includes("<img src=x"), false);
  assert.equal(html.includes("<b>Lee"), false);
  assert.equal(html.includes("<i>Rao"), false);
  assert.match(html, /&lt;img src=x onerror=1&gt;\.pdf/);
  assert.match(html, /href="https:\/\/x\.test\/r\?token=a&amp;b=1"/);
  assert.match(html, /chip ok">Approved</);
  assert.match(html, /by Priya &lt;i&gt;Rao&lt;\/i&gt;/);
  assert.match(html, /chip final">Blocked for good</);
  assert.match(html, /<td>3<\/td>/);
  assert.match(html, /<td>1<\/td>/);
  assert.match(html, /2026-10-03 00:00 UTC/);
  assert.match(html, /class="active">All \(2\)</);
  assert.match(html, /Waiting \(1\)</);
  assert.match(html, /Page 1 of 1/);
  assert.equal(html.includes(">Newer<"), false);
  assert.equal(html.includes(">Older<"), false);
});

test("the audit page keeps the search and filter inside its form and handles empty and paged lists", () => {
  const empty = renderAuditPage(auditView({ query: '"><script>x</script>', status: "waiting" }));
  assert.match(empty, /No blocked uploads match/);
  assert.match(empty, /<input type="hidden" name="token" value="tok">/);
  assert.match(empty, /<input type="hidden" name="status" value="waiting">/);
  assert.match(empty, /value="&quot;&gt;&lt;script&gt;x&lt;\/script&gt;"/);
  assert.equal(empty.includes("<script>x"), false);
  assert.equal(empty.includes("<form class=\"search\" method=\"get\">"), true);

  const paged = renderAuditPage(auditView({ pageNumber: 2, pageCount: 3, previousUrl: "/newer", nextUrl: "/older" }));
  assert.match(paged, /href="\/newer">Newer</);
  assert.match(paged, /href="\/older">Older</);
  assert.match(paged, /Page 2 of 3/);
});

test("a report shows the attempts, advice, history and a waiting note for read-only viewers", () => {
  const html = renderReportPage(
    pageReport({ attempts: 4, lastAttemptAt: new Date("2026-10-03T05:00:00Z") }),
    {
      history: [
        {
          filename: "<b>old</b>.zip",
          threat: "the archive contains another archive",
          status: "declined",
          reviewable: true,
          createdAt: new Date("2026-10-01T00:00:00Z"),
        },
      ],
    },
  );

  assert.match(html, /<dt>Attempts<\/dt><dd class="warn">4, the latest on 2026-10-03 05:00 UTC/);
  assert.match(html, /What to check:<\/strong> Some forms and invoices use scripts/);
  assert.match(html, /Earlier blocks from this sender/);
  assert.match(html, /&lt;b&gt;old&lt;\/b&gt;\.zip/);
  assert.match(html, /chip ">Declined</);
  assert.match(html, /Waiting for a decision/);
  assert.match(html, /Only the managers for this objective can approve or decline/);
  assert.equal(html.includes("<form"), false);
  assert.equal(html.includes("<b>old"), false);
});

test("a report hides what is not needed", () => {
  const plain = renderReportPage(pageReport({ attempts: 1 }), { decisionToken: "t" });
  assert.equal(plain.includes("Attempts"), false);
  assert.equal(plain.includes("Earlier blocks"), false);

  const final = renderReportPage(pageReport({ reviewable: false }));
  assert.equal(final.includes("What to check"), false);

  const none = renderReportPage(pageReport(), { history: [] });
  assert.match(none, /No other blocked uploads from this sender are on record/);
});
