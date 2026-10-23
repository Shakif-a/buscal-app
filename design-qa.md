# Evidence upload design QA

## Reference

- Source visual: `/var/folders/4s/rnq8cc892xl28zqrqfx3plnr0000gn/T/codex-clipboard-656e4de4-edea-4123-931f-5ebd200b82ef.png`
- Reviewed area: the Moodle file manager and drag-and-drop upload zone
- BusCal implementation: `/cypress/fixtures/okr.html` on the local frontend preview

## Views checked

- Desktop upload dialog at the default browser size
- Mobile upload dialog at 375 x 667
- Empty, dragging, selected file, unsupported file, oversized file, and multiple-file states

## Comparison history

- The first mobile version kept the action bar fixed and covered part of the form.
- The action buttons now follow the form on small screens, so the note and file details remain visible.
- The final design keeps the reference's large dashed drop area, clear upload icon, limits, and accepted formats while using the existing BusCal colours and dialog structure.

## Final result

Passed. No unresolved high, medium, or low priority design issues were found in the reviewed upload flow.
