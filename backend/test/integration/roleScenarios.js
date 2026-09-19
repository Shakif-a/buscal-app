module.exports = function roleScenarios({
  test,
  assert,
  request,
  users: getUsers,
  objectiveBody,
  pathForObjective,
  Group,
  Permission,
  User,
  Objective,
  sales: getSales,
}) {
  const rolePath = "/api/okr/admin/roles";
  const assignPath = () =>
    "/api/okr/admin/users/" + getUsers().employee.id + "/role";

  test("role catalogue seeds defaults once and includes persisted custom roles", async () => {
    assert.equal(
      (await request("POST", rolePath, { role: "Reviewer" })).status,
      201,
    );
    const response = await request("GET", rolePath);
    assert.equal(response.status, 200);
    assert.equal(response.body.permissionNames.length, 8);
    assert.equal(response.body.roles.length, 4);
    assert.equal(response.body.canManageRoles, true);
    assert.equal(
      response.body.roles.find((row) => row.role === "Reviewer").system,
      false,
    );
    await request("GET", rolePath);
    assert.equal(await Permission.countDocuments(), 4);
    const rows = await request("GET", "/api/okr/admin/permissions");
    assert.ok(rows.body.some((row) => row.role === "Reviewer"));
  });

  for (const role of [
    null,
    "",
    "  ",
    {},
    [],
    "Bad/Name",
    "constructor",
    "a".repeat(61),
  ]) {
    test(
      "role creation rejects malformed name " + JSON.stringify(role),
      async () => {
        assert.equal((await request("POST", rolePath, { role })).status, 400);
        assert.equal(await Permission.countDocuments(), 0);
      },
    );
  }

  test("role names normalize spaces and reject case-insensitive duplicates including concurrent requests", async () => {
    const created = await request("POST", rolePath, {
      role: "  Sales   Lead  ",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.role, "Sales Lead");
    assert.equal(
      (await request("POST", rolePath, { role: "sales lead" })).status,
      409,
    );
    assert.equal(
      (await request("POST", rolePath, { role: "ADMIN" })).status,
      409,
    );
    const responses = await Promise.all([
      request("POST", rolePath, { role: "Reviewer" }),
      request("POST", rolePath, { role: "reviewer" }),
    ]);
    assert.deepEqual(responses.map((row) => row.status).sort(), [201, 409]);
  });

  test("custom role permissions control real objective and report routes after assignment", async () => {
    await request("POST", rolePath, { role: "Reviewer" });
    assert.equal(
      (await request("PUT", assignPath(), { role: "Reviewer" })).status,
      200,
    );
    assert.equal(
      (await request("GET", "/api/users/me", undefined, "employee")).body
        .okrRole,
      "Reviewer",
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/okr/objectives",
          objectiveBody(),
          "employee",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("GET", "/api/okr/reports", undefined, "employee")).status,
      403,
    );
    assert.equal(
      (
        await request("PUT", "/api/okr/admin/permissions/Reviewer", {
          permissions: ["Create Objectives", "Edit Objectives", "View Reports"],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/okr/objectives",
          objectiveBody(),
          "employee",
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          "PUT",
          pathForObjective(),
          { title: "Reviewed" },
          "employee",
        )
      ).status,
      200,
    );
    assert.equal(
      (await request("GET", "/api/okr/reports", undefined, "employee")).status,
      200,
    );
    await request("PUT", "/api/okr/admin/permissions/Reviewer", {
      permissions: [],
    });
    assert.equal(
      (await request("DELETE", pathForObjective(), undefined, "employee"))
        .status,
      403,
    );
    assert.equal(
      (await request("PUT", assignPath(), { role: null })).status,
      200,
    );
    assert.equal(
      (await request("GET", "/api/okr/reports", undefined, "employee")).status,
      200,
    );
  });

  test("custom roles reject unsupported admin grants and invalid permissions", async () => {
    for (const permissions of [
      ["Manage Users"],
      ["Unknown"],
      [42],
      null,
      "View Reports",
    ]) {
      assert.equal(
        (await request("POST", rolePath, { role: "Reviewer", permissions }))
          .status,
        400,
      );
    }
    await request("POST", rolePath, { role: "Reviewer" });
    assert.equal(
      (
        await request("PUT", "/api/okr/admin/permissions/Reviewer", {
          permissions: ["Manage Roles"],
        })
      ).status,
      400,
    );
  });

  test("custom role key-result creation and approval use their separate permissions", async () => {
    await request("POST", rolePath, {
      role: "Reviewer",
      permissions: [
        "Edit Objectives",
        "Create Key Results",
        "Approve Key Results",
      ],
    });
    await request("PUT", assignPath(), { role: "Reviewer" });
    const created = await request(
      "POST",
      pathForObjective() + "/key-results",
      { title: "Reviewed result", weight: 20, dueDate: "2026-11-01" },
      "employee",
    );
    assert.equal(created.status, 201);
    const approvalPath =
      pathForObjective() + "/key-results/" + created.body._id + "/approval";
    assert.equal(
      (await request("PUT", approvalPath, { approved: true }, "employee"))
        .status,
      200,
    );
    await request("PUT", "/api/okr/admin/permissions/Reviewer", {
      permissions: ["Edit Objectives"],
    });
    assert.equal(
      (
        await request(
          "POST",
          pathForObjective() + "/key-results",
          { title: "Denied", weight: 20, dueDate: "2026-11-01" },
          "employee",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("PUT", approvalPath, { approved: false }, "employee"))
        .status,
      403,
    );
  });

  test("role rename failure rolls back user assignments", async () => {
    await request("POST", rolePath, { role: "Reviewer" });
    await request("PUT", assignPath(), { role: "Reviewer" });
    const save = Permission.prototype.save;
    Permission.prototype.save = async function () {
      throw new Error("Injected role save failure");
    };
    try {
      assert.equal(
        (await request("PUT", rolePath + "/Reviewer", { role: "Auditor" }))
          .status,
        500,
      );
    } finally {
      Permission.prototype.save = save;
    }
    assert.equal(
      (await User.findById(getUsers().employee.id)).okrRole,
      "Reviewer",
    );
    assert.ok(await Permission.exists({ role: "Reviewer" }));
    assert.equal(await Permission.exists({ role: "Auditor" }), null);
  });

  test("group rename failure rolls back objective names", async () => {
    const save = Group.prototype.save;
    Group.prototype.save = async function () {
      throw new Error("Injected group save failure");
    };
    try {
      assert.equal(
        (
          await request("PUT", "/api/okr/admin/groups/" + getSales().id, {
            name: "Enterprise Sales",
          })
        ).status,
        500,
      );
    } finally {
      Group.prototype.save = save;
    }
    assert.equal((await Group.findById(getSales().id)).name, "Sales");
    assert.equal(await Objective.countDocuments({ group: "Sales" }), 1);
    assert.equal(
      await Objective.countDocuments({ group: "Enterprise Sales" }),
      0,
    );
  });

  test("the unassigned objective marker cannot become a group name", async () => {
    assert.equal(
      (await request("POST", "/api/okr/admin/groups", { name: " none " }))
        .status,
      400,
    );
    assert.equal(
      (
        await request("PUT", "/api/okr/admin/groups/" + getSales().id, {
          name: "None",
        })
      ).status,
      400,
    );
  });

  test("role rename updates assignments and deletion blocks assigned roles", async () => {
    await request("POST", rolePath, { role: "Reviewer" });
    await request("PUT", assignPath(), { role: "Reviewer" });
    assert.equal((await request("DELETE", rolePath + "/Reviewer")).status, 409);
    assert.equal(
      (await request("PUT", rolePath + "/Reviewer", { role: "Auditor" }))
        .status,
      200,
    );
    assert.equal(
      (await User.findById(getUsers().employee.id)).okrRole,
      "Auditor",
    );
    assert.equal(await Permission.countDocuments({ role: "Reviewer" }), 0);
    await request("PUT", assignPath(), { role: null });
    assert.equal((await request("DELETE", rolePath + "/Auditor")).status, 200);
    assert.equal(
      (await request("PUT", assignPath(), { role: "Auditor" })).status,
      404,
    );
  });

  test("role assignment validates IDs and protects system roles and self-service routes", async () => {
    await request("POST", rolePath, { role: "Reviewer" });
    for (const userId of ["bad", "000000000000000000000000"]) {
      assert.equal(
        (
          await request("PUT", "/api/okr/admin/users/" + userId + "/role", {
            role: "Reviewer",
          })
        ).status,
        404,
      );
    }
    assert.equal(
      (await request("PUT", assignPath(), { role: "Admin" })).status,
      400,
    );
    assert.equal(
      (
        await request(
          "PUT",
          "/api/okr/admin/users/" + getUsers().admin.id + "/role",
          { role: "Reviewer" },
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "PUT",
          "/api/users/user/" + getUsers().employee.id,
          { okrRole: "Reviewer" },
          "employee",
        )
      ).status,
      403,
    );
    for (const role of ["Admin", "Manager", "Employee"]) {
      assert.equal(
        (await request("PUT", rolePath + "/" + role, { role: "Replacement" }))
          .status,
        400,
      );
      assert.equal(
        (await request("DELETE", rolePath + "/" + role)).status,
        400,
      );
    }
  });

  test("new administration routes enforce authentication, scope and saved permissions", async () => {
    const calls = [
      ["POST", rolePath, { role: "Reviewer" }],
      ["PUT", rolePath + "/Reviewer", { role: "Auditor" }],
      ["DELETE", rolePath + "/Reviewer"],
      ["PUT", assignPath(), { role: null }],
      ["DELETE", "/api/okr/admin/groups/" + getSales().id],
    ];
    for (const [method, path, body] of calls) {
      assert.equal(
        (await request(method, path, body, "admin", null)).status,
        401,
      );
      for (const role of ["manager", "employee", "groupManager"])
        assert.equal((await request(method, path, body, role)).status, 403);
    }
    await Permission.create({ role: "Admin", permissions: [] });
    for (const [method, path, body] of calls)
      assert.equal((await request(method, path, body)).status, 403);
  });

  for (const action of ["rename", "delete"]) {
    test(
      "competing assignment and role " +
        action +
        " leave no missing role reference",
      async () => {
        await request("POST", rolePath, { role: "Reviewer" });
        const responses = await Promise.all([
          request("PUT", assignPath(), { role: "Reviewer" }),
          action === "rename"
            ? request("PUT", rolePath + "/Reviewer", { role: "Auditor" })
            : request("DELETE", rolePath + "/Reviewer"),
        ]);
        assert.ok(
          responses.every((row) => [200, 404, 409].includes(row.status)),
        );
        const user = await User.findById(getUsers().employee.id);
        if (user.okrRole)
          assert.ok(await Permission.exists({ role: user.okrRole }));
      },
    );
  }

  test("group deletion blocks referenced groups and removes unused groups", async () => {
    assert.equal(
      (await request("DELETE", "/api/okr/admin/groups/" + getSales().id))
        .status,
      409,
    );
    const unused = await Group.findOne({ name: "Marketing" });
    assert.equal(
      (await request("DELETE", "/api/okr/admin/groups/" + unused.id)).status,
      200,
    );
    assert.equal(await Group.findById(unused.id), null);
    for (const groupId of ["bad", unused.id])
      assert.equal(
        (await request("DELETE", "/api/okr/admin/groups/" + groupId)).status,
        404,
      );
    assert.equal(await Objective.countDocuments(), 1);
  });

  for (const method of ["POST", "PUT"]) {
    test(
      "group rename racing objective " +
        method +
        " never leaves the old group name",
      async () => {
        const responses = await Promise.all([
          request("PUT", "/api/okr/admin/groups/" + getSales().id, {
            name: "Enterprise Sales",
          }),
          method === "POST"
            ? request("POST", "/api/okr/objectives", objectiveBody())
            : request("PUT", pathForObjective(), {
                group: "Sales",
                title: "Moved",
              }),
        ]);
        assert.equal(responses[0].status, 200);
        assert.ok([200, 201, 400].includes(responses[1].status));
        assert.equal(await Objective.countDocuments({ group: "Sales" }), 0);
      },
    );
  }

  test("group deletion competing with objective creation cannot leave an orphan", async () => {
    const group = await Group.findOne({ name: "Marketing" });
    const responses = await Promise.all([
      request("DELETE", "/api/okr/admin/groups/" + group.id),
      request(
        "POST",
        "/api/okr/objectives",
        objectiveBody({ group: "Marketing" }),
      ),
    ]);
    assert.ok(
      responses.every((row) => [200, 201, 400, 409].includes(row.status)),
    );
    if (!(await Group.exists({ name: "Marketing" })))
      assert.equal(await Objective.countDocuments({ group: "Marketing" }), 0);
  });
};
