import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import authService from "../src/features/auth/authService.js";

test("profile edits preserve returned access fields in local session storage", async () => {
  const originalPut = axios.put;
  const originalStorage = globalThis.localStorage;
  let storedUser;
  const profile = {
    _id: "user-1",
    firstName: "Updated",
    roles: ["employee"],
    exec: "yes",
    companyRoles: [],
    token: "actor-token",
  };
  globalThis.localStorage = {
    setItem(key, value) {
      assert.equal(key, "user");
      storedUser = JSON.parse(value);
    },
  };
  axios.put = async (url, body, config) => {
    assert.ok(url.endsWith("/userOne/user-1"));
    assert.equal(config.headers.Authorization, "Bearer original-token");
    assert.deepEqual(body, { _id: "user-1", firstName: "Updated" });
    return { data: profile };
  };
  try {
    assert.deepEqual(
      await authService.updateUserOne(
        { _id: "user-1", firstName: "Updated" },
        "original-token",
      ),
      profile,
    );
    assert.equal(storedUser.exec, "yes");
    assert.equal(storedUser.token, "actor-token");
  } finally {
    axios.put = originalPut;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test("account deletion sends the protected route and propagates access errors", async () => {
  const originalDelete = axios.delete;
  axios.delete = async (url, config) => {
    assert.ok(url.endsWith("/user/user-1"));
    assert.equal(config.headers.Authorization, "Bearer employee-token");
    throw new Error("Admin or executive access is required");
  };
  try {
    await assert.rejects(
      authService.deleteUser("user-1", "employee-token"),
      /Admin or executive/,
    );
  } finally {
    axios.delete = originalDelete;
  }
});
