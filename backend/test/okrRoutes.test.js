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
  const keyResult = findRoute(
    okrRoutes,
    "/objectives/:id/key-results",
    "post"
  );

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

test("admin routes use authentication and admin access checks", () => {
  assert.equal(okrAdminRoutes.stack[0].handle, protect);
  assert.equal(okrAdminRoutes.stack[1].handle, adminOrExec);

  assert.ok(findRoute(okrAdminRoutes, "/users", "get"));
  assert.ok(findRoute(okrAdminRoutes, "/groups", "get"));
  assert.ok(findRoute(okrAdminRoutes, "/groups", "post"));
  assert.ok(findRoute(okrAdminRoutes, "/groups/:id", "put"));
  assert.ok(findRoute(okrAdminRoutes, "/permissions", "get"));
  assert.ok(findRoute(okrAdminRoutes, "/permissions/:role", "put"));
});
