const api = "**/api/okr/admin";
const fixture = "/cypress/fixtures/admin.html";
const users = [
  { _id: "user-1", firstName: "Test", lastName: "Manager" },
  { _id: "user-2", firstName: "Test", lastName: "Member" },
];

function mockGroups() {
  let groups = [
    { _id: "group-1", name: "Support", manager: null, members: [] },
  ];
  cy.intercept("GET", `${api}/users`, users);
  cy.intercept("GET", `${api}/groups`, (req) => req.reply(groups));
  cy.intercept("PUT", `${api}/groups/group-1`, (req) => {
    expect(req.headers.authorization).to.equal("Bearer test-token");
    groups[0] = { ...groups[0], ...req.body };
    req.reply({ body: groups[0], delay: 300 });
  }).as("saveGroup");
  cy.intercept("POST", `${api}/groups`, (req) => {
    const group = {
      _id: "group-2",
      name: req.body.name,
      manager: null,
      members: [],
    };
    groups.push(group);
    req.reply({ statusCode: 201, body: group, delay: 300 });
  }).as("createGroup");
}

function mockRoles() {
  const permissionNames = [
    "Create Objectives",
    "Edit Objectives",
    "Create Key Results",
    "Approve Key Results",
    "View Reports",
    "Manage Users",
    "Manage Roles",
    "Manage Groups",
  ];
  let roles = [
    {
      role: "Admin",
      permissions: ["Create Objectives", "Edit Objectives", "Manage Roles"],
    },
    { role: "Manager", permissions: ["Create Objectives"] },
    { role: "Employee", permissions: [] },
  ];
  cy.intercept("GET", `${api}/roles`, (req) =>
    req.reply({
      roles: roles.map((row) => ({
        ...row,
        system: ["Admin", "Manager", "Employee"].includes(row.role),
        defaultPermissions:
          row.role === "Manager" ? permissionNames.slice(0, 5) : [],
        allowedPermissions:
          row.role === "Admin"
            ? permissionNames
            : row.role === "Employee"
              ? permissionNames.slice(2, 5)
              : permissionNames.slice(0, 5),
      })),
      permissionNames,
      canManageRoles: true,
      canManageUsers: true,
    }),
  );
  cy.intercept("GET", `${api}/users`, users);
  cy.intercept("POST", `${api}/roles`, (req) => {
    roles.push({ role: req.body.role.trim(), permissions: [] });
    req.reply({ statusCode: 201, body: roles[roles.length - 1] });
  }).as("createRole");
  cy.intercept("PUT", `${api}/roles/Reviewer`, (req) => {
    roles.find((row) => row.role === "Reviewer").role = req.body.role;
    req.reply({ role: req.body.role, permissions: [] });
  }).as("renameRole");
  cy.intercept("DELETE", `${api}/roles/Auditor`, (req) => {
    roles = roles.filter((row) => row.role !== "Auditor");
    req.reply({ role: "Auditor" });
  }).as("deleteRole");
  cy.intercept("PUT", `${api}/users/user-1/role`, (req) => {
    req.reply({ _id: "user-1", okrRole: req.body.role });
  }).as("assignRole");
  cy.intercept("PUT", `${api}/permissions/Manager`, (req) => {
    expect(req.headers.authorization).to.equal("Bearer test-token");
    roles[1] = { role: "Manager", permissions: req.body.permissions };
    req.reply({ body: roles[1], delay: 300 });
  }).as("saveRole");
}

describe("API-connected admin pages", () => {
  it("creates, assigns, renames and deletes a custom role through the backend", () => {
    mockRoles();
    cy.visit(`${fixture}?page=roles`);
    cy.window().then((win) => cy.stub(win, "prompt").returns("Reviewer"));
    cy.contains("button", "Add Role").click();
    cy.wait("@createRole");
    cy.contains(".role-table-row", "Reviewer").should("be.visible");
    cy.reload();
    cy.get('[aria-label="User for OKR role"]').select("user-1");
    cy.get('[aria-label="Assigned OKR role"]').select("Reviewer");
    cy.contains("button", "Save user role").click();
    cy.wait("@assignRole")
      .its("request.body")
      .should("deep.equal", { role: "Reviewer" });
    cy.contains("User role saved.").should("be.visible");
    cy.window().then((win) => cy.stub(win, "prompt").returns("Auditor"));
    cy.contains(".role-table-row", "Reviewer")
      .contains("button", "Rename")
      .click();
    cy.wait("@renameRole");
    cy.contains(".role-table-row", "Auditor").should("be.visible");
    cy.on("window:confirm", () => true);
    cy.contains(".role-table-row", "Auditor")
      .contains("button", "Delete")
      .click();
    cy.wait("@deleteRole");
    cy.contains(".role-table-row", "Auditor").should("not.exist");
    cy.reload();
    cy.contains(".role-table-row", "Auditor").should("not.exist");
  });

  it("renames a group and reloads the saved name", () => {
    mockGroups();
    cy.visit(fixture);
    cy.contains("button", "Edit").click();
    cy.get('[aria-label="Group name"]').clear().type("Customer Support");
    cy.contains("button", "Save Changes").click();
    cy.wait("@saveGroup")
      .its("request.body.name")
      .should("equal", "Customer Support");
    cy.reload();
    cy.contains(".group-name", "Customer Support").should("be.visible");
  });

  it("shows a blocked group deletion and removes the group after a successful deletion", () => {
    mockGroups();
    cy.intercept("DELETE", `${api}/groups/group-1`, {
      statusCode: 409,
      body: { message: "Move the group's objectives before deleting it" },
    });
    cy.visit(fixture);
    cy.on("window:confirm", () => true);
    cy.contains("button", "Delete").click();
    cy.contains("Move the group's objectives before deleting it").should(
      "be.visible",
    );
    cy.contains(".group-name", "Support").should("be.visible");
    cy.intercept("DELETE", `${api}/groups/group-1`, {
      body: { id: "group-1" },
    }).as("deleteGroup");
    cy.contains("button", "Delete").click();
    cy.wait("@deleteGroup");
    cy.contains(".group-name", "Support").should("not.exist");
    cy.contains("Group deleted.").should("be.visible");
  });

  it("saves group membership and manager, then reloads saved values", () => {
    mockGroups();
    cy.visit(fixture);
    cy.contains("button", "Edit").click();
    cy.get("select").select("user-1");
    cy.contains("label", "Test Member").click();
    cy.screenshot("admin-editor", { capture: "viewport" });
    cy.contains("button", "Save Changes").click();
    cy.contains("button", "Saving...").should("be.disabled");
    cy.contains("button", "Cancel").should("be.disabled");
    cy.wait("@saveGroup")
      .its("request.body")
      .should("deep.equal", {
        name: "Support",
        manager: "user-1",
        members: ["user-2"],
      });
    cy.contains("Group changes saved.").should("be.visible");
    cy.reload();
    cy.contains("button", "Edit").click();
    cy.get("select").should("have.value", "user-1");
    cy.contains("label", "Test Member").find("input").should("be.checked");
    cy.contains("label", "Test Member").click();
    cy.contains("button", "Cancel").click();
    cy.contains("button", "Edit").click();
    cy.contains("label", "Test Member").find("input").should("be.checked");
    cy.get('[aria-label="Search groups"]').type("missing");
    cy.contains("No groups found.").should("be.visible");
  });

  it("creates a group through the API and retains it after reload", () => {
    mockGroups();
    cy.visit(fixture);
    cy.window().then((win) => cy.stub(win, "prompt").returns(" New Team "));
    cy.contains("button", "Add Group").should("be.enabled").click();
    cy.wait("@createGroup")
      .its("request.body")
      .should("deep.equal", { name: "New Team" });
    cy.contains("New Team").should("be.visible");
    cy.reload();
    cy.contains("New Team").should("be.visible");
    cy.contains("Add Users").should("not.exist");
  });

  it("retains the group draft after a rejected save", () => {
    mockGroups();
    cy.intercept("PUT", `${api}/groups/group-1`, {
      statusCode: 403,
      body: { message: "Save denied" },
    });
    cy.visit(fixture);
    cy.contains("button", "Edit").click();
    cy.contains("label", "Test Member").click();
    cy.contains("button", "Save Changes").click();
    cy.contains("Save denied").should("be.visible");
    cy.contains("Group changes saved.").should("not.exist");
    cy.contains("label", "Test Member").find("input").should("be.checked");
    cy.contains("button", "Save Changes").should("be.enabled");
  });

  it("does not allow group creation when loading fails", () => {
    cy.intercept("GET", `${api}/users`, {
      statusCode: 500,
      body: { message: "Load failed" },
    });
    cy.visit(fixture);
    cy.contains("Load failed").should("be.visible");
    cy.contains("button", "Add Group").should("be.disabled");
    cy.contains("No groups found.").should("not.exist");
  });

  it("saves role permissions and reloads server values", () => {
    mockRoles();
    cy.visit(`${fixture}?page=roles`);
    cy.contains("label", "Edit Objectives").click();
    cy.contains("button", "Save Changes").click();
    cy.contains("button", "Saving...").should("be.disabled");
    cy.get(".role-permissions-panel input").should("be.disabled");
    cy.wait("@saveRole")
      .its("request.body.permissions")
      .should("deep.equal", ["Create Objectives", "Edit Objectives"]);
    cy.contains("Changes Saved").should("be.visible");
    cy.screenshot("role-saved", { capture: "viewport" });
    cy.contains("button", "OK").click();
    cy.reload();
    cy.contains("label", "Edit Objectives").find("input").should("be.checked");
    cy.contains("button", "Reset to defaults").click();
    cy.contains("label", "View Reports").find("input").should("be.checked");
    cy.reload();
    cy.contains("label", "View Reports").find("input").should("not.be.checked");
    cy.contains("Add Role").should("be.enabled");
    cy.get('[aria-label="Search roles"]').type("missing");
    cy.contains("No roles found.").should("be.visible");
  });

  it("disables permission settings which cannot take effect", () => {
    mockRoles();
    cy.visit(`${fixture}?page=roles`);
    cy.contains("label", "Manage Users").find("input").should("be.disabled");
    cy.contains(".role-table-row", "Admin").contains("button", "Edit").click();
    cy.contains("label", "Manage Roles")
      .find("input")
      .should("be.checked")
      .and("be.enabled");
    cy.contains(".role-table-row", "Employee")
      .contains("button", "Edit")
      .click();
    cy.contains("label", "Create Objectives")
      .find("input")
      .should("be.disabled");
  });

  it("shows no editable defaults or success message after a failed role load", () => {
    cy.intercept("GET", `${api}/roles`, {
      statusCode: 500,
      body: { message: "Load failed" },
    });
    cy.visit(`${fixture}?page=roles`);
    cy.contains("Load failed").should("be.visible");
    cy.get(".role-permissions-panel").should("not.exist");
    cy.contains("button", "Save Changes").should("not.exist");
    cy.contains("Changes Saved").should("not.exist");
  });

  it("retains permission edits without a success popup after a rejected save", () => {
    mockRoles();
    cy.intercept("PUT", `${api}/permissions/Manager`, {
      statusCode: 403,
      body: { message: "Save denied" },
    });
    cy.visit(`${fixture}?page=roles`);
    cy.contains("label", "Edit Objectives").click();
    cy.contains("button", "Save Changes").click();
    cy.contains("Save denied").should("be.visible");
    cy.contains("Changes Saved").should("not.exist");
    cy.contains("label", "Edit Objectives").find("input").should("be.checked");
    cy.contains("button", "Save Changes").should("be.enabled");
  });

  for (const access of ["admin", "executive"]) {
    it(`allows ${access} navigation between the real admin pages`, () => {
      mockGroups();
      mockRoles();
      cy.visit(`${fixture}?access=${access}`);
      cy.contains("button", "Admin").focus().type("{enter}");
      cy.contains("button", "Admin").should(
        "have.attr",
        "aria-expanded",
        "true",
      );
      cy.contains("button", "Admin").type("{esc}");
      cy.contains("button", "Admin").should(
        "have.attr",
        "aria-expanded",
        "false",
      );
      cy.contains("button", "Admin").type("{enter}");
      cy.contains("a", "Role Management").click();
      cy.get("h1").should("have.text", "Role Management");
      cy.contains("button", "Admin").click();
      cy.contains("a", "Group Management").click();
      cy.get("h1").should("have.text", "Group Management");
    });
  }

  for (const access of ["manager", "employee"]) {
    it(`blocks ${access} access on direct routes and hides the Admin menu`, () => {
      cy.intercept(`${api}/**`, () => {
        throw new Error("Restricted page called the admin API");
      });
      for (const page of ["groups", "roles"]) {
        cy.visit(`${fixture}?access=${access}&page=${page}`);
        cy.contains("Admin or executive access is required.").should(
          "be.visible",
        );
        cy.contains("button", /^Admin$/).should("not.exist");
        cy.get("input").should("not.exist");
      }
    });
  }
});
