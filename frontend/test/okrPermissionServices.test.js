import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import keyResultService from "../src/okrTracker/features/objectives/keyResultService.js";
import reportService from "../src/okrTracker/features/objectives/reportService.js";

test("key-result creation and approval use protected backend routes", async () => {
  const originalPost = axios.post;
  const originalPut = axios.put;
  const requests = [];

  axios.post = async (url, body, config) => {
    requests.push({ method: "POST", url, body, config });
    return { data: { _id: "result-1", ...body } };
  };
  axios.put = async (url, body, config) => {
    requests.push({ method: "PUT", url, body, config });
    return { data: { _id: "result-1", approved: body.approved } };
  };

  try {
    await keyResultService.create(
      "objective-1",
      { title: "Result", weight: 25, dueDate: "2026-12-01" },
      "test-token",
    );
    await keyResultService.approve(
      "objective-1",
      "result-1",
      true,
      "test-token",
    );

    assert.ok(
      requests[0].url.endsWith("/api/okr/objectives/objective-1/key-results"),
    );
    assert.ok(
      requests[1].url.endsWith(
        "/api/okr/objectives/objective-1/key-results/result-1/approval",
      ),
    );
    assert.equal(requests[0].config.headers.Authorization, "Bearer test-token");
    assert.equal(requests[1].config.headers.Authorization, "Bearer test-token");
    assert.deepEqual(requests[1].body, { approved: true });
  } finally {
    axios.post = originalPost;
    axios.put = originalPut;
  }
});

test("reports use the protected backend report route", async () => {
  const originalGet = axios.get;

  axios.get = async (url, config) => {
    assert.ok(url.endsWith("/api/okr/reports"));
    assert.equal(config.headers.Authorization, "Bearer report-token");
    return { data: { totalObjectives: 2, averageProgress: 50, groups: [] } };
  };

  try {
    const report = await reportService.getReport("report-token");
    assert.equal(report.totalObjectives, 2);
    assert.equal(report.averageProgress, 50);
  } finally {
    axios.get = originalGet;
  }
});
