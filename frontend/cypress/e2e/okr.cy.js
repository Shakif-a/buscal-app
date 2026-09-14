const fixture = "/cypress/fixtures/okr.html";

describe("API-connected objective and report pages", () => {
  it("uses real key results and sends protected create and approval requests", () => {
    cy.intercept("GET", "**/api/okrTracker/objectives", []);
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        expect(req.body).to.deep.equal({
          title: "New result",
          weight: 25,
          dueDate: "2026-11-30",
        });
        req.reply({ statusCode: 201, body: { _id: "result-2" } });
      },
    ).as("createResult");
    cy.intercept(
      "PUT",
      "**/api/okr/objectives/objective-1/key-results/result-1/approval",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        expect(req.body).to.deep.equal({ approved: true });
        req.reply({ body: { _id: "result-1", approved: true } });
      },
    ).as("approveResult");

    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("Resolve requests faster").should("be.visible");
    cy.contains("button", "Approve").click();
    cy.wait("@approveResult");
    cy.contains("button", "Add Key Result").click();
    cy.contains("label", "Title").find("input").type("New result");
    cy.contains("label", "Weight").find("input").type("25");
    cy.contains("label", "Due date").find("input").type("2026-11-30");
    cy.contains("button", "Save Key Result").click();
    cy.wait("@createResult");
  });

  it("hides objective writes when the backend access flags deny them", () => {
    cy.visit(`${fixture}?manage=false&create=false&approve=false`);
    cy.get('[aria-label="Actions for Improve support"]').should("not.exist");
    cy.contains("button", "View Key Results").click();
    cy.contains("Pending").should("be.visible");
    cy.contains("button", "Approve").should("not.exist");
    cy.contains("button", "Add Key Result").should("not.exist");
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
