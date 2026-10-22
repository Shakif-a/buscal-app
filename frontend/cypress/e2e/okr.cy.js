const fixture = "/cypress/fixtures/okr.html";
const keyResultsUrl = "**/api/okrTracker/objectives/objective-1/key-results";

function mockKeyResults(access) {
  cy.intercept("GET", keyResultsUrl, [
    {
      _id: "result-1",
      title: "Resolve requests faster",
      weight: 60,
      assigned: "Test Member",
      assignedTo: { _id: "user-1", firstName: "Test", lastName: "Member" },
      progress: 30,
      dueDate: "2026-11-01",
      approved: false,
      ...access,
    },
  ]).as("loadResults");
  cy.intercept("GET", "**/api/users/user", [
    { _id: "user-1", firstName: "Test", lastName: "Member" },
  ]);
}

describe("API-connected objective and report pages", () => {
  it("approves and adds key results through the edit-mode save", () => {
    mockKeyResults({ canEdit: true, canEditProgress: true });
    cy.intercept("PUT", `${keyResultsUrl}/result-1`, (req) => {
      expect(req.headers.authorization).to.equal("Bearer test-token");
      expect(req.body).to.include({ approved: true, weight: 60 });
      req.reply({ body: { _id: "result-1", approved: true } });
    }).as("updateResult");
    cy.intercept("POST", keyResultsUrl, (req) => {
      expect(req.headers.authorization).to.equal("Bearer test-token");
      expect(req.body).to.deep.equal({
        title: "New result",
        weight: 40,
        dueDate: "2026-11-30",
        assignedTo: "user-1",
        progress: 0,
        approved: false,
      });
      req.reply({ statusCode: 201, body: { _id: "result-2" } });
    }).as("createResult");

    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.wait("@loadResults");
    cy.contains("Resolve requests faster").should("be.visible");
    cy.contains("button", "Edit Key Results").click();
    cy.get(".key-result-row")
      .eq(0)
      .find('input[type="checkbox"]')
      .check();
    cy.contains("button", "+ Add Key Result").click();
    cy.get(".key-result-row").eq(1).as("newRow");
    cy.get("@newRow").find(".key-result-name-input").type("New result");
    cy.get("@newRow").find("select").first().select("user-1");
    cy.get("@newRow").find('input[type="date"]').type("2026-11-30");
    cy.get("@newRow").find(".weight-edit-link").click();
    cy.get('.weight-popup-content input[type="number"]')
      .eq(1)
      .type("{selectall}40");
    cy.contains(".weight-popup", "100%").should("be.visible");
    cy.get(".weight-popup .save-button").click();
    cy.contains("button", "Save Key Results").should("be.enabled").click();
    cy.wait("@updateResult");
    cy.wait("@createResult");
    cy.contains("button", "Edit Key Results").should("be.visible");
  });

  it("hides objective writes when the backend access flags deny them", () => {
    mockKeyResults({ canEdit: false, canEditProgress: false });
    cy.visit(`${fixture}?manage=false&create=false&edit=false&approve=false`);
    cy.get(".objective-menu-button").should("not.exist");
    cy.contains("button", "View Key Results").click();
    cy.wait("@loadResults");
    cy.contains("Resolve requests faster").should("be.visible");
    cy.get(".key-result-row")
      .find('input[type="checkbox"]')
      .should("be.disabled");
    cy.contains("button", "Edit Key Results").should("not.exist");
    cy.contains("button", "+ Add Key Result").should("not.exist");
  });

  it("loads actual report values through the protected report route", () => {
    cy.intercept("GET", "**/api/okr/reports", (req) => {
      expect(req.headers.authorization).to.equal("Bearer test-token");
      req.reply({
        totalObjectives: 3,
        onTrack: 2,
        averageProgress: 65,
        groups: [{ name: "Support", objectives: 3, progress: 65 }],
      });
    }).as("report");
    cy.visit(`${fixture}?page=reports`);
    cy.wait("@report");
    cy.contains("Objectives On Track").parent().should("contain", "2");
    cy.contains("Average Progress").parent().should("contain", "65%");
    cy.contains("Support").parent().should("contain", "65%");
  });

  it("shows the backend report permission error", () => {
    cy.intercept("GET", "**/api/okr/reports", {
      statusCode: 403,
      body: { message: "Permission required: View Reports" },
    });
    cy.visit(`${fixture}?page=reports`);
    cy.contains("Permission required: View Reports").should("be.visible");
  });
});
