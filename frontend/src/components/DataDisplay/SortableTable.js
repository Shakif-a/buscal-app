import * as React from "react";
import { useEffect, useState } from "react";
import TableDetails from "./TableDetails";
import Tooltip from "@mui/material/Tooltip";

//--------------------------Key Value Conversions----------------------------

function convertToNumber(obj, keys) {
  let updatedObj = {};
  for (let key in obj) {
    if (keys.includes(key)) {
      updatedObj[key] = Number(obj[key]);
    } else {
      updatedObj[key] = obj[key];
    }
  }
  return updatedObj;
}

// ---------------------------------------------------------------------------------------------
// ---------------------------------------Main function-----------------------------------------
// ---------------------------------------------------------------------------------------------

export default function SortableTable({
  headCells,
  arrayToUseForRows,
  keysToChangeFromStringToNumber,
  disablePrint,
  rowsPP,
  inventorySign = false,
  onRowClick,
  zone,
  section,
  warehouseFilter,
  activateButton,
  onButtonClick,
  columnTooltips,
  columnTextColorMap,
  currencyColumnIds,
  resolveCellTextColor,
}) {
  // --------------------------Constants----------------------------

  const [rows, setRows] = useState([]);

  // --------------------------Functions----------------------------

  function handleSearch() {
    const tableRows = arrayToUseForRows.map((obj) => {
      let result = convertToNumber(obj, keysToChangeFromStringToNumber);

      return result;
    });

    setRows(tableRows);
  }

  // --------------------------useEffects----------------------------

  useEffect(() => {
    handleSearch();
  }, [headCells, arrayToUseForRows, keysToChangeFromStringToNumber]);

  // --------------------------Return----------------------------

  // If tooltips are provided, wrap headerCells labels with Tooltip
  const headerCellsWithTooltips = columnTooltips
    ? headCells.map((cell) => ({
        ...cell,
        label: columnTooltips[cell.id] ? (
          <Tooltip title={columnTooltips[cell.id]} arrow>
            <span>{cell.label}</span>
          </Tooltip>
        ) : (
          cell.label
        ),
      }))
    : headCells;

  return (
    <section className="flex">
      <div className="">
        <TableDetails
          rowsPP={rowsPP}
          rows={rows}
          headerCells={headerCellsWithTooltips}
          exportHeaderCells={headCells}
          disablePrint={disablePrint}
          inventorySign={inventorySign}
          onRowClick={onRowClick}
          zone={zone}
          section={section}
          warehouseFilter={warehouseFilter}
          activateButton={activateButton}
          onButtonClick={onButtonClick}
          columnTextColorMap={columnTextColorMap}
          currencyColumnIds={currencyColumnIds}
          resolveCellTextColor={resolveCellTextColor}
        />
      </div>
    </section>
  );
}

// --------------------------TEMPLATE FOR TABLE ----------------------------

// const [arrayToUseForRows, setArrayToUseForRows] = React.useState(arr);

// const keysToChangeFromStringToNumber = [
//   "stockOnHand",
//   "available",
// ];

// const headCells = [
//   {
//     id: "keyName",
//     label: "Part Code",
//   },
//   {
//     id: "keyName2",
//     label: "Description",
//   },
// ];

// <SortableTable
//   headCells={headCells}
//   arrayToUseForRows={arrayToUseForRows}
//   keysToChangeFromStringToNumber={keysToChangeFromStringToNumber}
// />;
