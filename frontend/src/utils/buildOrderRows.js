// buildOrderRows.js
import { convertKeysToNumberFormat } from "../components/Helper/Helper";

const KEYS_TO_CONVERT = ["stockOnHand", "available", "committed", "ordered"];

export function buildOrderRows(partNotes, ososByPartCode, oposByPartCode) {
  // Step 1: Filter to parts that have at least one SO
  const matchedPartNotes = partNotes.filter(
    (partNote) => ososByPartCode[partNote.partCode]?.length > 0,
  );

  // Step 2: Convert numeric fields
  const convertedPartNotes = convertKeysToNumberFormat(
    matchedPartNotes,
    KEYS_TO_CONVERT,
  );

  // Build a lookup for converted part fields by partCode
  const partFieldsByCode = {};
  for (const part of convertedPartNotes) {
    partFieldsByCode[part.partCode] = {
      partCode: part.partCode,
      description: part.description,
      stockOnHand: part.stockOnHand,
      committed: part.committed,
      ordered: part.ordered,
      available: part.available,
    };
  }

  // Step 3: Build SO rows sorted by customer → SO → available,
  // with matching PO rows injected immediately after each SO row.
  const soRows = [];
  for (const part of convertedPartNotes) {
    const matchedSOs = ososByPartCode[part.partCode] || [];
    for (const so of matchedSOs) {
      soRows.push({
        _type: "so",
        partCode: part.partCode,
        description: part.description,
        stockOnHand: part.stockOnHand,
        committed: part.committed,
        ordered: part.ordered,
        available: part.available,
        soNumber: so.soNumber ?? "",
        customerName: so.customerName ?? "",
        creationDate: so.creationDate ?? "",
        soDeliveryDate: so.dueDate ?? "",
        poDeliveryDate: "",
      });
    }
  }

  // Sort SO rows: customer → SO number → available ascending
  soRows.sort((a, b) => {
    if (a.customerName < b.customerName) return -1;
    if (a.customerName > b.customerName) return 1;
    if (a.soNumber < b.soNumber) return -1;
    if (a.soNumber > b.soNumber) return 1;
    return a.available - b.available;
  });

  // Inject PO rows immediately after each SO row that shares the partCode
  const consolidatedRows = [];
  for (const soRow of soRows) {
    consolidatedRows.push(soRow);
    const matchedPOs = oposByPartCode[soRow.partCode] || [];
    for (const po of matchedPOs) {
      consolidatedRows.push({
        _type: "po",
        partCode: po.itemNo ?? "",
        description: po.itemDescription ?? "",
        stockOnHand: "",
        committed: "",
        ordered: po.outstandingQty ?? "",
        available: "",
        soNumber: soRow.soNumber, // keep soNumber for banding
        customerName: "",
        creationDate: "",
        soDeliveryDate: "",
        poDeliveryDate: po.dueDate ?? "",
      });
    }
  }

  // Step 4: Orphan POs — itemNo has no SO anywhere in the dataset.
  // Collect all partCodes that have at least one SO.
  const partCodesWithSO = new Set(Object.keys(ososByPartCode));

  for (const [itemNo, pos] of Object.entries(oposByPartCode)) {
    if (partCodesWithSO.has(itemNo)) continue; // already handled above
    for (const po of pos) {
      consolidatedRows.push({
        _type: "po_orphan",
        partCode: po.itemNo ?? "",
        description: po.itemDescription ?? "",
        stockOnHand: "",
        committed: "",
        ordered: po.outstandingQty ?? "",
        available: "",
        soNumber: "",
        customerName: "",
        creationDate: "",
        soDeliveryDate: "",
        poDeliveryDate: po.dueDate ?? "",
      });
    }
  }

  return consolidatedRows;
}
