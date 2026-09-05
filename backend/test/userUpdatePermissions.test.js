const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const userRoutes = require("../routes/userRoutes");
const { errorHandler } = require("../middleware/errorMiddleware");

test("user update routes protect roles and preserve profile edits", async () => {
  const originalFindUser = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  const testSecret = "local-user-permission-test-only";
  const userId = new mongoose.Types.ObjectId().toString();
  const otherId = new mongoose.Types.ObjectId().toString();
  let controllerCalls = 0;
  let currentUser;
  const handlers = [];

  process.env.JWT_SECRET = testSecret;
  User.findById = () => ({
    async select() {
      return currentUser;
    },
  });

  for (let i = 0; i < userRoutes.stack.length; i++) {
    const route = userRoutes.stack[i].route;

    if (route && route.methods.put && ["/user/:id", "/userOne/:id"].includes(route.path)) {
      const handler = route.stack[route.stack.length - 1];
      handlers.push({ handler, original: handler.handle });
      handler.handle = (req, res) => {
        controllerCalls++;
        res.json({ saved: true });
      };
    }
  }

  const app = express();
  app.use(express.json());
  app.use("/api/users", userRoutes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const baseUrl = "http://127.0.0.1:" + server.address().port;
    const token = jwt.sign({ id: userId }, testSecret);

    async function check(path, body, expectedStatus, authorization = "Bearer " + token) {
      const callsBefore = controllerCalls;
      const headers = { "Content-Type": "application/json" };

      if (authorization) {
        headers.Authorization = authorization;
      }

      const response = await fetch(baseUrl + path, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      await response.json();

      assert.equal(response.status, expectedStatus, path + " " + JSON.stringify(body));
      assert.equal(controllerCalls, callsBefore + (expectedStatus === 200 ? 1 : 0));
    }

    const roles = ["employee", "manager", "admin", "exec"];

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const senior = role === "admin" || role === "exec";
      currentUser = {
        _id: new mongoose.Types.ObjectId(userId),
        roles: role === "admin" ? ["admin"] : ["employee"],
        exec: role === "exec" ? "yes" : "no",
        companyRoles: role === "manager" ? [{ managementLevel: 2 }] : [],
      };

      for (const route of ["/user/", "/userOne/"]) {
        const path = "/api/users" + route + userId;
        const ownProfile = { _id: userId, firstName: "Updated", roles: currentUser.roles };

        if (route === "/userOne/") {
          ownProfile.password = "";
        }

        await check(path, ownProfile, 200);
        await check(path, { _id: userId, roles: ["admin", "employee"] }, senior ? 200 : 403);
        await check(path, { _id: userId, exec: "yes" }, senior ? 200 : 403);
        await check(path, { _id: userId, companyRoles: [{ managementLevel: 1 }] }, senior ? 200 : 403);
        await check("/api/users" + route + otherId, { _id: otherId, firstName: "Other" }, senior ? 200 : 403);
        await check(path, { _id: otherId, firstName: "Other" }, 400);
      }
    }

    currentUser = {
      _id: new mongoose.Types.ObjectId(userId),
      roles: ["employee"],
      exec: "no",
      companyRoles: [],
    };

    for (const route of ["/user/", "/userOne/"]) {
      const path = "/api/users" + route + userId;
      await check(path, { _id: userId, $set: { roles: ["admin"] } }, 403);
      await check(path, { _id: userId, "companyRoles.0.managementLevel": 1 }, 403);
      await check(path, { _id: userId, resetPasswordToken: "changed" }, 403);
      await check(path, { _id: userId }, 401, "");
      await check(path, { _id: userId }, 401, "Bearer invalid");
      await check("/api/users" + route + "bad-id", {}, 404);
    }

    await check("/api/users/user/" + userId, { firstName: "Updated" }, 200);
    await check("/api/users/user/" + userId, { password: "unhashed" }, 403);
    await check("/api/users/userOne/" + userId, { firstName: "Updated" }, 400);
    await check("/api/users/userOne/" + userId, { _id: userId, password: "new-test-password" }, 200);
    assert.equal(handlers.length, 2);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    User.findById = originalFindUser;

    for (let i = 0; i < handlers.length; i++) {
      handlers[i].handler.handle = handlers[i].original;
    }

    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  }
});
