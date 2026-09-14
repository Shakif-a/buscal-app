import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import adminService from "../src/okrTracker/features/admin/adminService.js";

test("admin pages use the correct protected API requests", async () => {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalPut = axios.put;
  const requests = [];

  axios.get = async (url, config) => {
    requests.push({ method: "GET", url, config });
    return { data: [] };
  };

  axios.post = async (url, body, config) => {
    requests.push({ method: "POST", url, body, config });
    return { data: { _id: "group-1", name: body.name, members: [] } };
  };

  axios.put = async (url, body, config) => {
    requests.push({ method: "PUT", url, body, config });
    return { data: body };
  };

  try {
    await adminService.getUsers("test-token");
    await adminService.getGroups("test-token");
    await adminService.createGroup("Sales", "test-token");
    await adminService.updateGroup(
      "group-1",
      { manager: "user-1", members: ["user-2"] },
      "test-token",
    );
    await adminService.getPermissions("test-token");
    await adminService.updatePermissions(
      "Manager",
      ["Create Objectives"],
      "test-token",
    );

    assert.deepEqual(
      requests.map((request) => `${request.method} ${request.url}`),
      [
        "GET http://localhost:5000/api/okr/admin/users",
        "GET http://localhost:5000/api/okr/admin/groups",
        "POST http://localhost:5000/api/okr/admin/groups",
        "PUT http://localhost:5000/api/okr/admin/groups/group-1",
        "GET http://localhost:5000/api/okr/admin/permissions",
        "PUT http://localhost:5000/api/okr/admin/permissions/Manager",
      ],
    );

    for (let i = 0; i < requests.length; i++) {
      assert.equal(
        requests[i].config.headers.Authorization,
        "Bearer test-token",
      );
    }

    assert.deepEqual(requests[2].body, { name: "Sales" });
    assert.deepEqual(requests[3].body, {
      manager: "user-1",
      members: ["user-2"],
    });
    assert.deepEqual(requests[5].body, {
      permissions: ["Create Objectives"],
    });
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    axios.put = originalPut;
  }
});

test("role lifecycle, user assignment and group deletion use authenticated API contracts", async () => {
  const originals = {
    get: axios.get,
    post: axios.post,
    put: axios.put,
    delete: axios.delete,
  };
  const calls = [];
  for (const method of ["get", "post", "put", "delete"]) {
    axios[method] = async (url, body, config) => {
      calls.push({
        method,
        url,
        body: ["get", "delete"].includes(method) ? undefined : body,
        config: config || body,
      });
      return { data: { saved: true } };
    };
  }
  try {
    await adminService.getRoles("token");
    await adminService.createRole("Sales Lead", "token");
    await adminService.renameRole("Sales Lead", "Reviewer", "token");
    await adminService.assignRole("user-1", "Reviewer", "token");
    await adminService.assignRole("user-1", null, "token");
    await adminService.deleteRole("Sales Lead", "token");
    await adminService.deleteGroup("group-1", "token");
    assert.deepEqual(
      calls.map((call) => [
        call.method,
        call.url.replace("http://localhost:5000/api/okr/admin", ""),
        call.body,
      ]),
      [
        ["get", "/roles", undefined],
        ["post", "/roles", { role: "Sales Lead" }],
        ["put", "/roles/Sales%20Lead", { role: "Reviewer" }],
        ["put", "/users/user-1/role", { role: "Reviewer" }],
        ["put", "/users/user-1/role", { role: null }],
        ["delete", "/roles/Sales%20Lead", undefined],
        ["delete", "/groups/group-1", undefined],
      ],
    );
    for (const call of calls)
      assert.equal(call.config.headers.Authorization, "Bearer token");
    axios.delete = async () => {
      throw new Error("Deletion blocked");
    };
    await assert.rejects(
      adminService.deleteRole("Reviewer", "token"),
      /Deletion blocked/,
    );
  } finally {
    Object.assign(axios, originals);
  }
});
