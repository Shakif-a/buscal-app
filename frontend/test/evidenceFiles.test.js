import test from "node:test";
import assert from "node:assert/strict";
import {
  canShareEvidenceFile,
  saveEvidenceFile,
  shareEvidenceFile,
} from "../src/okrTracker/features/objectives/evidenceFiles.js";

function testBrowser() {
  const actions = [];
  const browser = {
    URL: {
      createObjectURL(data) {
        actions.push(["create", data]);
        return "blob:test";
      },
      revokeObjectURL(url) {
        actions.push(["revoke", url]);
      },
    },
    document: {
      body: {
        appendChild(link) {
          actions.push(["append", link]);
        },
      },
      createElement() {
        return {
          click() {
            actions.push(["click"]);
          },
          remove() {
            actions.push(["remove"]);
          },
        };
      },
    },
    setTimeout(callback, delay) {
      actions.push(["timeout", delay]);
      callback();
    },
    File: class {
      constructor(parts, name, options) {
        this.parts = parts;
        this.name = name;
        this.type = options.type;
      }
    },
    navigator: {},
  };

  return { browser, actions };
}

test("saved evidence downloads with its original name and releases the URL", () => {
  const { browser, actions } = testBrowser();
  const data = { type: "application/pdf" };

  saveEvidenceFile(data, "Q1 result.pdf", browser);

  const link = actions.find(([name]) => name === "append")[1];
  assert.equal(link.href, "blob:test");
  assert.equal(link.download, "Q1 result.pdf");
  assert.deepEqual(
    actions.map(([name]) => name),
    ["create", "append", "click", "remove", "timeout", "revoke"],
  );
});

test("evidence sharing sends the protected file through the browser share action", async () => {
  const { browser, actions } = testBrowser();
  let sharedData;
  browser.navigator.canShare = (data) => data.files.length === 1;
  browser.navigator.share = async (data) => {
    sharedData = data;
  };

  assert.equal(
    canShareEvidenceFile(
      { type: "application/pdf" },
      { filename: "Q1 result.pdf", mimetype: "application/pdf" },
      "Resolve requests faster",
      browser,
    ),
    true,
  );

  const shared = await shareEvidenceFile(
    { type: "application/pdf" },
    {
      filename: "Q1 result.pdf",
      mimetype: "application/pdf",
      note: "Reviewed figures",
    },
    "Resolve requests faster",
    browser,
  );

  assert.equal(shared, true);
  assert.equal(sharedData.title, "Evidence for Resolve requests faster");
  assert.equal(sharedData.text, "Reviewed figures");
  assert.equal(sharedData.files[0].name, "Q1 result.pdf");
  assert.equal(sharedData.files[0].type, "application/pdf");
  assert.equal(actions.length, 0);
});

test("evidence sharing downloads the file when native sharing is unavailable", async () => {
  const { browser, actions } = testBrowser();

  const shared = await shareEvidenceFile(
    { type: "application/zip" },
    { filename: "results.zip", mimetype: "application/zip" },
    "Archive results",
    browser,
  );

  assert.equal(shared, false);
  const link = actions.find(([name]) => name === "append")[1];
  assert.equal(link.download, "results.zip");
  assert.equal(actions.some(([name]) => name === "revoke"), true);
});

test("evidence sharing downloads when the browser cannot create shared files", async () => {
  const { browser, actions } = testBrowser();
  browser.File = undefined;
  browser.navigator.canShare = () => true;
  browser.navigator.share = async () => {
    throw new Error("Share should not be called");
  };

  assert.equal(
    canShareEvidenceFile(
      { type: "application/pdf" },
      { filename: "Q1 result.pdf", mimetype: "application/pdf" },
      "Resolve requests faster",
      browser,
    ),
    false,
  );

  const shared = await shareEvidenceFile(
    { type: "application/pdf" },
    { filename: "Q1 result.pdf", mimetype: "application/pdf" },
    "Resolve requests faster",
    browser,
  );

  assert.equal(shared, false);
  const link = actions.find(([name]) => name === "append")[1];
  assert.equal(link.download, "Q1 result.pdf");
});

test("evidence sharing downloads when the browser rejects share capability checks", async () => {
  const { browser, actions } = testBrowser();
  browser.navigator.canShare = () => {
    throw new Error("Unsupported file share");
  };
  browser.navigator.share = async () => {};

  const shared = await shareEvidenceFile(
    { type: "application/zip" },
    { filename: "results.zip", mimetype: "application/zip" },
    "Archive results",
    browser,
  );

  assert.equal(shared, false);
  assert.equal(
    actions.find(([name]) => name === "append")[1].download,
    "results.zip",
  );
});

test("evidence sharing keeps browser cancellation separate from failures", async () => {
  const { browser, actions } = testBrowser();
  const cancelled = new Error("Cancelled");
  cancelled.name = "AbortError";
  browser.navigator.canShare = () => true;
  browser.navigator.share = async () => {
    throw cancelled;
  };

  await assert.rejects(
    shareEvidenceFile(
      { type: "application/pdf" },
      { filename: "Q1 result.pdf", mimetype: "application/pdf" },
      "Resolve requests faster",
      browser,
    ),
    { name: "AbortError" },
  );
  assert.equal(actions.length, 0);
});
