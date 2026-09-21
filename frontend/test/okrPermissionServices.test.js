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

test("key-result evidence uses protected upload, list, download and delete routes", async () => {
  const originalPost = axios.post;
  const originalGet = axios.get;
  const originalDelete = axios.delete;
  const requests = [];
  const file = { name: "Q1 result.pdf", type: "application/pdf" };

  axios.post = async (url, body, config) => {
    requests.push({ method: "POST", url, body, config });
    return { data: { _id: "evidence-1", filename: file.name } };
  };
  axios.get = async (url, config) => {
    requests.push({ method: "GET", url, config });
    return config.responseType === "blob"
      ? { data: "file-data" }
      : { data: [{ _id: "evidence-1", filename: file.name }] };
  };
  axios.delete = async (url, config) => {
    requests.push({ method: "DELETE", url, config });
    return { data: { id: "evidence-1" } };
  };

  try {
    await keyResultService.uploadEvidence(
      "objective-1",
      "result-1",
      file,
      "Reviewed figures",
      "test-token",
    );
    await keyResultService.getEvidence(
      "objective-1",
      "result-1",
      "test-token",
    );
    const downloaded = await keyResultService.downloadEvidence(
      "objective-1",
      "result-1",
      "evidence-1",
      "test-token",
    );
    await keyResultService.deleteEvidence(
      "objective-1",
      "result-1",
      "evidence-1",
      "test-token",
    );

    const evidenceUrl =
      "/api/okr/objectives/objective-1/key-results/result-1/evidence";
    assert.ok(requests[0].url.endsWith(evidenceUrl));
    assert.equal(requests[0].body, file);
    assert.equal(
      requests[0].config.headers["Content-Type"],
      "application/octet-stream",
    );
    assert.equal(
      decodeURIComponent(requests[0].config.headers["X-Evidence-Name"]),
      file.name,
    );
    assert.equal(
      decodeURIComponent(requests[0].config.headers["X-Evidence-Note"]),
      "Reviewed figures",
    );
    assert.ok(requests[1].url.endsWith(evidenceUrl));
    assert.ok(requests[2].url.endsWith(evidenceUrl + "/evidence-1/download"));
    assert.equal(requests[2].config.responseType, "blob");
    assert.equal(downloaded, "file-data");
    assert.ok(requests[3].url.endsWith(evidenceUrl + "/evidence-1"));
    for (const request of requests) {
      assert.equal(request.config.headers.Authorization, "Bearer test-token");
    }
  } finally {
    axios.post = originalPost;
    axios.get = originalGet;
    axios.delete = originalDelete;
  }
});

test("evidence uploads use a safe generic type when the browser has no MIME value", async () => {
  const originalPost = axios.post;

  axios.post = async (url, body, config) => {
    assert.equal(body.name, "meeting.rtf");
    assert.equal(
      decodeURIComponent(config.headers["X-Evidence-Type"]),
      "application/octet-stream",
    );
    return { data: { _id: "evidence-2", filename: body.name } };
  };

  try {
    await keyResultService.uploadEvidence(
      "objective-1",
      "result-1",
      { name: "meeting.rtf", type: "" },
      "",
      "test-token",
    );
  } finally {
    axios.post = originalPost;
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
