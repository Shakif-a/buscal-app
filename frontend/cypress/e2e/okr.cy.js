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
    mockKeyResults({
      canEdit: false,
      canEditProgress: false,
      canManageEvidence: false,
    });
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
    cy.contains("Not available").should("be.visible");
  });

  it("uploads, lists and deletes evidence through protected requests", () => {
    let files = [];
    cy.intercept("GET", "**/api/okrTracker/objectives", []);
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        req.reply(files);
      },
    ).as("getEvidence");
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        expect(decodeURIComponent(req.headers["x-evidence-name"])).to.equal(
          "Q1 result.pdf",
        );
        expect(decodeURIComponent(req.headers["x-evidence-type"])).to.equal(
          "application/pdf",
        );
        expect(decodeURIComponent(req.headers["x-evidence-note"])).to.equal(
          "Reviewed figures",
        );
        files = [
          {
            _id: "evidence-1",
            filename: "Q1 result.pdf",
            size: 2048,
            note: "Reviewed figures",
            uploadedByName: "Test Member",
          },
        ];
        req.reply({ statusCode: 201, body: files[0] });
      },
    ).as("uploadEvidence");
    cy.intercept(
      "DELETE",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence/evidence-1",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        files = [];
        req.reply({ delay: 150, body: { id: "evidence-1" } });
      },
    ).as("deleteEvidence");
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence/evidence-1/download",
      (req) => {
        expect(req.headers.authorization).to.equal("Bearer test-token");
        req.reply({
          delay: 150,
          body: Cypress.Buffer.from("%PDF-1.4 test"),
          headers: { "Content-Type": "application/pdf" },
        });
      },
    ).as("downloadEvidence");

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("%PDF-1.4 test"),
        fileName: "Q1 result.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("label", "Note").find("textarea").type("Reviewed figures");
    cy.contains("button", "Upload Evidence").click();
    cy.wait("@uploadEvidence");
    cy.wait("@getEvidence");
    cy.contains(
      "Evidence uploaded successfully. You can download or share it below.",
    ).should("be.visible");
    cy.contains("Q1 result.pdf").should("be.visible");
    cy.contains("Reviewed figures").should("be.visible");
    cy.contains("Uploaded by Test Member").should("be.visible");
    cy.window().then((win) => {
      const share = cy.stub().resolves();
      Object.defineProperty(win.navigator, "share", {
        configurable: true,
        value: share,
      });
      Object.defineProperty(win.navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      cy.wrap(share).as("nativeShare");
    });
    cy.contains("button", "Share File").click();
    cy.contains("Q1 result.pdf").should("be.visible");
    cy.contains("button", "Preparing...").should("be.visible");
    cy.wait("@downloadEvidence");
    cy.contains(
      "The file is ready. Select Choose Platform to share it",
    ).should("be.visible");
    cy.contains("button", "Choose Platform").click();
    cy.get("@nativeShare").should("have.been.calledOnce");
    cy.contains("Evidence shared successfully").should("be.visible");
    cy.contains("button", "Download").click();
    cy.contains("Q1 result.pdf").should("be.visible");
    cy.contains("button", "Downloading...").should("be.visible");
    cy.wait("@downloadEvidence");
    cy.contains("Evidence downloaded successfully").should("be.visible");
    cy.contains("button", "Delete").click();
    cy.contains("Remove this evidence?").should("be.visible");
    cy.contains("Q1 result.pdf will be permanently removed.").should(
      "be.visible",
    );
    cy.contains("button", "Keep file").click();
    cy.contains("Q1 result.pdf").should("be.visible");
    cy.contains("button", "Delete").click();
    cy.contains("button", "Remove file").click();
    cy.contains("Q1 result.pdf").should("be.visible");
    cy.contains("button", "Removing...").should("be.visible");
    cy.wait("@deleteEvidence");
    cy.contains("Evidence deleted successfully").should("be.visible");
    cy.contains("Q1 result.pdf").should("not.exist");
  });

  it("does not report a successful upload as failed when objective refresh fails", () => {
    cy.intercept("GET", "**/api/okrTracker/objectives", {
      statusCode: 500,
      body: { message: "Refresh unavailable" },
    });
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      {
        statusCode: 201,
        body: { _id: "evidence-1", filename: "Q1 result.pdf" },
      },
    );
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      [
        {
          _id: "evidence-1",
          filename: "Q1 result.pdf",
          size: 2048,
          uploadedByName: "Test Member",
        },
      ],
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .should("have.attr", "accept")
      .and("include", ".pptx")
      .and("include", ".zip");
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("%PDF-1.4 test"),
        fileName: "Q1 result.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("button", "Upload Evidence").click();
    cy.contains(
      "Evidence uploaded, but the objective details could not be refreshed",
    ).should("be.visible");
    cy.contains("Q1 result.pdf").should("be.visible");
  });

  it("shows evidence upload errors without closing the form", () => {
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      {
        statusCode: 400,
        body: { message: "This file type is not supported" },
      },
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("fake"),
        fileName: "fake.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("button", "Upload Evidence").click();
    cy.contains("This file type is not supported").should("be.visible");
    cy.contains("button", "Upload Evidence")
      .scrollIntoView()
      .should("be.visible")
      .and("not.be.disabled");
  });

  it("lets the user cancel a slow evidence upload and retry", () => {
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      {
        delay: 3000,
        statusCode: 201,
        body: { _id: "evidence-1", filename: "slow.pdf" },
      },
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("%PDF-1.4 test"),
        fileName: "slow.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("button", "Upload Evidence").click();
    cy.contains("button", "Cancel upload").should("be.visible").click();
    cy.contains(
      "Upload cancelled. Your selected file is ready to retry.",
    ).should("be.visible");
    cy.contains("slow.pdf").should("be.visible");
    cy.contains("button", "Upload Evidence").should("not.be.disabled");
  });

  it("checks evidence files before upload and shows the selected details", () => {
    let uploads = 0;
    cy.intercept(
      "POST",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      (req) => {
        uploads += 1;
        req.reply({ statusCode: 201, body: {} });
      },
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.alloc(0),
        fileName: "empty.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("Please select a file that is not empty").should("be.visible");
    cy.contains("button", "Upload Evidence").should("be.disabled");

    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("unsafe"),
        fileName: "program.exe",
        mimeType: "application/octet-stream",
      });
    cy.contains("This file type is not supported").should("be.visible");

    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.alloc(5 * 1024 * 1024 + 1),
        fileName: "too-large.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("Evidence files cannot be larger than 5 MB").should(
      "be.visible",
    );

    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("%PDF-1.4 test"),
        fileName: "ready.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("ready.pdf").should("be.visible");
    cy.contains("PDF · 1 KB").should("be.visible");
    cy.contains("0/1000").should("be.visible");
    cy.contains("label", "Note (optional)").find("textarea").type("Ready");
    cy.contains("5/1000").should("be.visible");
    cy.then(() => expect(uploads).to.equal(0));
  });

  it("supports the evidence drag and drop area", () => {
    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();

    cy.contains("You can drag and drop a file here to add it").should(
      "be.visible",
    );
    cy.contains("Maximum file size: 5 MB · 1 file per upload").should(
      "be.visible",
    );
    cy.contains("Up to 10 active evidence files per key result").should(
      "be.visible",
    );
    cy.contains("Accepted file types:").should("be.visible");

    cy.get(".evidence-drop-zone")
      .trigger("dragenter")
      .should("have.class", "is-dragging");
    cy.contains("Drop the file here").should("be.visible");
    cy.get(".evidence-drop-zone")
      .trigger("dragleave")
      .should("not.have.class", "is-dragging");

    cy.get(".evidence-drop-zone").selectFile(
      {
        contents: Cypress.Buffer.from("%PDF-1.4 dropped"),
        fileName: "dropped-evidence.pdf",
        mimeType: "application/pdf",
      },
      { action: "drag-drop" },
    );
    cy.contains("dropped-evidence.pdf").should("be.visible");
    cy.contains("PDF · 1 KB").should("be.visible");
    cy.contains("button", "Upload Evidence").should("not.be.disabled");

    cy.get(".evidence-drop-zone").selectFile(
      [
        {
          contents: Cypress.Buffer.from("%PDF-1.4 first"),
          fileName: "first.pdf",
          mimeType: "application/pdf",
        },
        {
          contents: Cypress.Buffer.from("%PDF-1.4 second"),
          fileName: "second.pdf",
          mimeType: "application/pdf",
        },
      ],
      { action: "drag-drop" },
    );
    cy.contains("Please upload one evidence file at a time").should(
      "be.visible",
    );
    cy.contains("button", "Upload Evidence").should("be.disabled");
  });

  it("clears upload drafts and status when moving between evidence views", () => {
    cy.intercept("GET", "**/api/okrTracker/objectives", []);
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      [
        {
          _id: "evidence-1",
          filename: "saved.pdf",
          size: 1024,
        },
      ],
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();
    cy.get('input[aria-label="Evidence file"]')
      .selectFile({
        contents: Cypress.Buffer.from("%PDF-1.4 draft"),
        fileName: "draft.pdf",
        mimeType: "application/pdf",
      });
    cy.contains("label", "Note (optional)").find("textarea").type("Old note");
    cy.contains("button", "View Evidence").click();
    cy.contains("saved.pdf").should("be.visible");
    cy.contains("button", "Upload another").click();
    cy.contains("label", "Note (optional)")
      .find("textarea")
      .should("have.value", "");
    cy.contains("draft.pdf").should("not.exist");
    cy.contains("button", "Upload Evidence").should("be.disabled");
  });

  it("keeps keyboard focus inside the evidence dialog and restores it", () => {
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      { delay: 300, body: [] },
    ).as("loadEvidence");

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", /^View$/).focus().click();
    cy.focused().should("have.attr", "aria-label", "Close evidence");
    cy.contains("Loading evidence...").should("be.visible");
    cy.wait("@loadEvidence");
    cy.get('[role="dialog"]').trigger("keydown", {
      key: "Tab",
      shiftKey: true,
    });
    cy.focused().should("contain", "Done");
    cy.get('[role="dialog"]').trigger("keydown", { key: "Escape" });
    cy.get('[role="dialog"]').should("not.exist");
    cy.focused().should("contain", "View");
  });

  it("shows useful errors when evidence actions fail", () => {
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      [
        {
          _id: "evidence-1",
          filename: "saved.pdf",
          size: 1024,
        },
      ],
    );
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence/evidence-1/download",
      { statusCode: 500, body: { message: "Download unavailable" } },
    );
    cy.intercept(
      "DELETE",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence/evidence-1",
      { statusCode: 500, body: { message: "Delete unavailable" } },
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", /^View$/).click();
    cy.contains("button", "Share File").click();
    cy.contains("Download unavailable").should("be.visible");
    cy.contains("button", "Download").click();
    cy.contains("Download unavailable").should("be.visible");
    cy.contains("button", "Delete").click();
    cy.contains("button", "Remove file").click();
    cy.contains("Delete unavailable").should("be.visible");
    cy.contains("Remove this evidence?").should("be.visible");
    cy.contains("saved.pdf").should("be.visible");
  });

  it("fits the evidence actions on a small phone screen", () => {
    cy.viewport(375, 667);
    cy.intercept(
      "GET",
      "**/api/okr/objectives/objective-1/key-results/result-1/evidence",
      [
        {
          _id: "evidence-1",
          filename: "a-long-evidence-file-name-for-mobile.pdf",
          size: 1024,
        },
      ],
    );

    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", /^View$/).click();
    cy.get('[role="dialog"]').should("be.visible").then(($dialog) => {
      expect($dialog[0].scrollWidth).to.be.at.most($dialog[0].clientWidth);
    });
    cy.contains("button", "Share File").should("be.visible");
    cy.contains("button", "Download").should("be.visible");
    cy.contains("button", "Delete").should("be.visible");
  });

  it("fits the evidence upload area on a small phone screen", () => {
    cy.viewport(375, 667);
    mockKeyResults({ canManageEvidence: true });
    cy.visit(fixture);
    cy.contains("button", "View Key Results").click();
    cy.contains("button", "Upload").click();

    cy.get('[role="dialog"]').should("be.visible").then(($dialog) => {
      expect($dialog[0].scrollWidth).to.be.at.most($dialog[0].clientWidth);
    });
    cy.get(".evidence-drop-zone").should("be.visible");
    cy.get('input[aria-label="Evidence file"]').selectFile({
      contents: Cypress.Buffer.from("%PDF-1.4 mobile"),
      fileName: "a-long-evidence-file-name-for-a-small-phone-screen.pdf",
      mimeType: "application/pdf",
    });
    cy.contains("a-long-evidence-file-name-for-a-small-phone-screen.pdf")
      .scrollIntoView()
      .should("be.visible");
    cy.contains("button", "Upload Evidence")
      .scrollIntoView()
      .should("be.visible")
      .and("not.be.disabled");
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
