const test = require("node:test");
const assert = require("node:assert/strict");
const okrRoutes = require("../routes/okrRoutes");
const okrAdminRoutes = require("../routes/okrAdminRoutes");
const { protect } = require("../middleware/authMiddleware");
const { adminOrExec } = require("../middleware/adminPermissions");

function findRoute(router, path, method) {
  for (let i = 0; i < router.stack.length; i++) {
    const route = router.stack[i].route;

    if (route && route.path === path && route.methods[method]) {
      return route;
    }
  }

  return null;
}

test("objective write routes include authentication and permission checks", () => {
  const create = findRoute(okrRoutes, "/objectives", "post");
  const update = findRoute(okrRoutes, "/objectives/:id", "put");
  const remove = findRoute(okrRoutes, "/objectives/:id", "delete");
  const keyResult = findRoute(okrRoutes, "/objectives/:id/key-results", "post");

  assert.equal(create.stack.length, 3);
  assert.equal(update.stack.length, 3);
  assert.equal(remove.stack.length, 3);
  assert.equal(keyResult.stack.length, 3);
});

test("the groups route is declared before the objective id route", () => {
  let groupsIndex = -1;
  let objectiveIndex = -1;

  for (let i = 0; i < okrRoutes.stack.length; i++) {
    const route = okrRoutes.stack[i].route;

    if (route && route.path === "/objectives/groups") {
      groupsIndex = i;
    }

    if (route && route.path === "/objectives/:id" && route.methods.get) {
      objectiveIndex = i;
    }
  }

  assert.notEqual(groupsIndex, -1);
  assert.notEqual(objectiveIndex, -1);
  assert.equal(groupsIndex < objectiveIndex, true);
});

test("admin routes use authentication, and role editing follows Manage Roles", () => {
  const middleware = okrAdminRoutes.stack
    .filter((layer) => !layer.route)
    .map((layer) => layer.handle);
  assert.ok(middleware.includes(protect));
  assert.ok(!middleware.includes(adminOrExec));

  const adminOnly = (path, method) =>
    findRoute(okrAdminRoutes, path, method).stack.some((layer) => layer.handle === adminOrExec);

  for (const [path, method] of [
    ["/users", "get"],
    ["/groups", "get"],
    ["/groups", "post"],
    ["/groups/:id", "put"],
    ["/users/:id/role", "put"],
    ["/roles", "post"],
    ["/roles/:role", "put"],
    ["/roles/:role", "delete"],
    ["/permissions", "get"],
    ["/permissions/:role", "put"],
  ]) {
    assert.equal(adminOnly(path, method), false, `${method} ${path}`);
  }
});
