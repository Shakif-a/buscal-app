import * as React from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import { visuallyHidden } from "@mui/utils";
import moment from "moment";
import * as ExcelJS from "exceljs";

function descendingComparator(a, b, orderBy) {
  if (moment(a[orderBy], "DD/MM/YYYY", true).isValid()) {
    if (moment(b[orderBy], "DD-MM-YYYY") < moment(a[orderBy], "DD-MM-YYYY")) {
      return -1;
    }
    if (moment(b[orderBy], "DD-MM-YYYY") > moment(a[orderBy], "DD-MM-YYYY")) {
      return 1;
    }
    return 0;
  } else {
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  }
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

// This method is created for cross-browser compatibility, if you don't
// need to support IE11, you can use Array.prototype.sort() directly
function stableSort(array, comparator) {
  const stabilizedThis = array?.map((el, index) => [el, index]);
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) {
      return order;
    }
    return a[1] - b[1];
  });
  return stabilizedThis?.map((el) => el[0]);
}

function EnhancedTableHead(props) {
  const { order, orderBy, onRequestSort, headCells } = props;
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headCells?.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? "center" : "center"}
            padding={headCell.disablePadding ? "normal" : "normal"}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : "asc"}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === "desc" ? "sorted descending" : "sorted ascending"}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}

EnhancedTableHead.propTypes = {
  numSelected: PropTypes.number.isRequired,
  onRequestSort: PropTypes.func.isRequired,
  onSelectAllClick: PropTypes.func.isRequired,
  order: PropTypes.oneOf(["asc", "desc"]).isRequired,
  orderBy: PropTypes.string.isRequired,
  rowCount: PropTypes.number.isRequired,
};

const EnhancedTableToolbar = (props) => {
  const { numSelected } = props;

  return null;
};

EnhancedTableToolbar.propTypes = {
  numSelected: PropTypes.number.isRequired,
};

export default function TableDetails({
  rows,
  headerCells,
  exportHeaderCells,
  rowsPP,
  disablePrint,
  onRowClick,
  inventorySign,
  zone,
  section,
  warehouseFilter,
  activateButton,
  onButtonClick,
  isFontWhite,
  columnTextColorMap,
  currencyColumnIds,
  resolveCellTextColor,
}) {
  const [order, setOrder] = React.useState("asc");
  const [orderBy, setOrderBy] = React.useState("deficitQuantity");
  const [selected, setSelected] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [dense, setDense] = React.useState(false);
  const [rowsPerPage, setRowsPerPage] = React.useState(rowsPP ? rowsPP : 5);

  let fontColour = "rgb(0, 0, 0)"; // Default to black
  let isCategory = false;

  // Check if rows.category exists
  if (rows && rows[0] && rows[0].category) {
    isCategory = true;
  }
  if (isFontWhite) {
    fontColour = "rgb(255, 255, 255)";
  }

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const currentDate = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
  });

  function renderCell(value, columnId) {
    if (typeof value === "number") {
      if (currencyColumnIds && currencyColumnIds.includes(columnId)) {
        return value.toLocaleString("en-AU", {
          style: "currency",
          currency: "AUD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      return value.toLocaleString();
    } else {
      return value;
    }
  }

  function handleStockExcelExport(newRows) {
    const excelHeaderCells = exportHeaderCells || headerCells;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory");

    const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");

    // Add static text and empty cells for input areas at the top
    const headerData = [
      ["Micromax"],
      ["Zone", "Section", "WHS", ""],
      [zone || "", section || "", warehouseFilter || ""], // Fill with props if they exist
      ["", "", "", "", "", ""], // Empty row for spacing
      ["", "", "", "Date and Time", timestamp],
    ];

    // Append the headerData to the worksheet
    headerData.forEach((row, rowIndex) => {
      worksheet.addRow(row);
    });

    // Add header row with bold text
    const headerRow = worksheet.addRow(
      excelHeaderCells.map((cell) => cell.label),
    );
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Keep track of the start of newRows data
    const startOfNewRows = worksheet.lastRow.number + 1;

    // Append new rows data
    newRows.forEach((row) => {
      const newRow = excelHeaderCells.map((cell) => row[cell.id] || "");
      worksheet.addRow(newRow);
    });

    // Append empty row for spacing
    worksheet.addRow(["", "", "", "", "", ""]);

    // Append signature rows
    worksheet.addRow(["Counted By:", "", "", "", "Processed By:"]);
    worksheet.mergeCells(
      `A${worksheet.lastRow.number}:B${worksheet.lastRow.number}`,
    );
    worksheet.mergeCells(
      `E${worksheet.lastRow.number}:F${worksheet.lastRow.number}`,
    );

    worksheet.addRow([
      "____________________",
      "",
      "",
      "",
      "____________________",
    ]);
    worksheet.mergeCells(
      `A${worksheet.lastRow.number}:D${worksheet.lastRow.number}`,
    );
    worksheet.mergeCells(
      `E${worksheet.lastRow.number}:F${worksheet.lastRow.number}`,
    );

    // Set the column widths
    const colWidths = [6, 7, 5, 15, 40, 6, 11, 8, 8, 8, 13, 15];
    worksheet.columns = colWidths.map((width) => ({ width }));

    // Add borders only to cells that contain newRows data
    for (
      let rowNumber = startOfNewRows;
      rowNumber < startOfNewRows + newRows.length;
      rowNumber++
    ) {
      const row = worksheet.getRow(rowNumber);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        // Wrap text in the fifth column (column E)
        if (cell._column._number === 5) {
          cell.alignment = { wrapText: true };
        }
      });
    }

    // Double the height of each row
    worksheet.eachRow((row) => {
      row.height = row.height ? row.height * 2 : 30; // Default height is around 15, so set it to 30
    });

    // Set the default page and print layout
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    // Generate a download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
  // Export data to excel
  const handleExcelExport = async (rows) => {
    const excelHeaderCells = exportHeaderCells || headerCells;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Table Data");

    // Add header row with bold text
    const headerRow = worksheet.addRow(
      excelHeaderCells.map((cell) => cell.label),
    );
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Append rows data
    rows.forEach((row) => {
      const newRow = excelHeaderCells.map((cell) => {
        const cellValue = row[cell.id];
        return cellValue === 0 ? 0 : cellValue || "";
      });
      worksheet.addRow(newRow);
    });

    // Set all columns to a width of 15
    worksheet.columns = excelHeaderCells.map(() => ({ width: 15 }));

    // Set the default page and print layout
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    // Generate a download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  function printTable() {
    const printContents = document.getElementById("printableArea").innerHTML;
    const originalContents = document.body.innerHTML;

    document.body.innerHTML = printContents;

    window.print();

    document.body.innerHTML = originalContents;
    window.location.reload();
  }

  function processRows(rows, inventorySign) {
    if (!inventorySign) return rows;

    const stockFields = [
      "qtyInWhs01",
      "qtyInDemoWhs",
      "qtyInTS01Whs",
      "qtyInNSW01Whs",
      "qtyInQLD01Whs",
      "qtyInVIC01Whs",
      "qtyInWA01Whs",
    ];

    return rows.flatMap((row) => {
      const newRows = [];
      let whsAdded = false;

      for (const field of stockFields) {
        if (row[field] !== undefined && row.stockOnHand === row[field]) {
          const newRow = { ...row };
          switch (field) {
            case "qtyInWhs01":
              newRow.whs = "WH1";
              break;
            case "qtyInDemoWhs":
              newRow.whs = "Demo";
              break;
            case "qtyInTS01Whs":
              newRow.whs = "TS1";
              break;
            case "qtyInNSW01Whs":
              newRow.whs = "NSW1";
              break;
            case "qtyInQLD01Whs":
              newRow.whs = "QLD1";
              break;
            case "qtyInVIC01Whs":
              newRow.whs = "VIC1";
              break;
            case "qtyInWA01Whs":
              newRow.whs = "WA1";
              break;
            default:
              // For future addition
              break;
          }
          newRows.push(newRow);
          whsAdded = true;
        }
      }

      if (!whsAdded) {
        stockFields.forEach((field, index) => {
          if (row[field] !== undefined && row[field] > 0) {
            const newRow = { ...row };
            newRow.stockOnHand = row[field];
            switch (field) {
              case "qtyInWhs01":
                newRow.whs = "WH1";
                break;
              case "qtyInDemoWhs":
                newRow.whs = "Demo";
                break;
              case "qtyInTS01Whs":
                newRow.whs = "TS1";
                break;
              case "qtyInNSW01Whs":
                newRow.whs = "NSW1";
                break;
              case "qtyInQLD01Whs":
                newRow.whs = "QLD1";
                break;
              case "qtyInVIC01Whs":
                newRow.whs = "VIC1";
                break;
              case "qtyInWA01Whs":
                newRow.whs = "WA1";
                break;
              default:
                break;
            }

            if (index > 0) {
              newRow.zone = "";
              newRow.section = "";
              newRow.bin = "";
            }

            newRows.push(newRow);
          }
        });
      }

      // Calculate the number of warehouses with stock
      const stockCount = stockFields.reduce((count, field) => {
        return row[field] > 0 ? count + 1 : count;
      }, 0);

      // Add the "Total" row only if there is stock in more than one warehouse
      if (stockCount > 1) {
        const totalRow = {
          ...row,
          description: "Total",
          zone: "",
          section: "",
          bin: "",
        };
        newRows.push(totalRow);
      }

      return newRows;
    });
  }

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = rows?.map((n) => n.name);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event, row) => {
    const name = row.customerCode;
    const customername = row.customerName;

    if (typeof onRowClick === "function") {
      onRowClick(name, customername);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isSelected = (name) => selected.indexOf(name) !== -1;

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  const newRows = processRows(rows, inventorySign);

  function getRow(row, headerCells) {
    const getFallbackCellColor = (columnId) => {
      if (columnTextColorMap && columnTextColorMap[columnId]) {
        return columnTextColorMap[columnId];
      }

      return fontColour;
    };

    const getCellColor = (columnId, cellValue) => {
      const fallbackColor = getFallbackCellColor(columnId);

      if (typeof resolveCellTextColor === "function") {
        const resolvedColor = resolveCellTextColor(
          columnId,
          row,
          cellValue,
          fallbackColor,
        );

        return resolvedColor || fallbackColor;
      }

      return fallbackColor;
    };

    const renderBottom = (cellContent) => {
      return cellContent === "TOTAL" ? (
        <strong>{cellContent}</strong>
      ) : (
        cellContent
      );
    };

    return (
      <>
        <TableCell
          component="th"
          scope="row"
          padding="normal"
          align="center"
          style={{
            color: getCellColor(headerCells[0].id, row[headerCells[0].id]),
          }}
        >
          {activateButton ? (
            <Button
              onClick={(e) => {
                if (typeof onButtonClick === "function") {
                  onButtonClick(row[headerCells[0].id], e);
                }
              }}
            >
              {row[headerCells[0].id]}
            </Button>
          ) : (
            renderBottom(row[headerCells[0].id])
          )}
        </TableCell>
        {headerCells.map((x, i) => {
          const columnId = headerCells[i].id;
          const cellValue = row[columnId];

          return (
            i !== 0 && (
              <TableCell
                key={i}
                align="center"
                style={{ color: getCellColor(columnId, cellValue) }}
              >
                {renderCell(cellValue, columnId)}
              </TableCell>
            )
          );
        })}
      </>
    );
  }

  function getReturnContent() {
    return (
      <div>
        <Box sx={{ width: "100%" }}>
          <Paper sx={{ width: "100%", mb: 2 }}>
            <EnhancedTableToolbar numSelected={selected.length} />
            <div id="printableArea">
              {disablePrint === true ? null : (
                <div className="mb-3">
                  <div className="text-lg text-right">{currentDate}</div>
                </div>
              )}
              <TableContainer>
                <Table
                  sx={{ minWidth: 750 }}
                  aria-labelledby="tableTitle"
                  size={dense ? "small" : "medium"}
                >
                  <EnhancedTableHead
                    numSelected={selected.length}
                    order={order}
                    orderBy={orderBy}
                    onSelectAllClick={handleSelectAllClick}
                    onRequestSort={handleRequestSort}
                    rowCount={rows.length}
                    headCells={headerCells}
                  />
                  <TableBody>
                    {stableSort(newRows, getComparator(order, orderBy))
                      .slice(
                        page * rowsPerPage,
                        page * rowsPerPage + rowsPerPage,
                      )
                      .map((row, index) => {
                        const isItemSelected = isSelected(row.id);
                        const labelId = `enhanced-table-checkbox-${index}`;
                        const k = index;

                        return (
                          <TableRow
                            onClick={(event) => handleClick(event, row)}
                            tabIndex={-1}
                            key={`row-${index}`}
                            selected={isCategory ? false : isItemSelected}
                            sx={{
                              cursor: isCategory ? "pointer" : "default",
                            }}
                          >
                            {getRow(row, headerCells)}
                          </TableRow>
                        );
                      })}
                    {emptyRows > 0 && (
                      <TableRow
                        style={{
                          height: (dense ? 33 : 53) * emptyRows,
                        }}
                      >
                        <TableCell colSpan={6} />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {inventorySign === false ? null : (
                <div style={{ marginTop: "50px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                    }}
                  >
                    <div style={{ marginRight: "200px" }}>
                      Counted By:
                      <br />
                      <span
                        style={{
                          display: "block",
                          marginTop: "30px",
                        }}
                      >
                        --------------------------------------------
                      </span>
                    </div>
                    <div>
                      Processed By:
                      <br />
                      <span
                        style={{
                          display: "block",
                          marginTop: "30px",
                        }}
                      >
                        --------------------------------------------
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 100, 1000]}
              component="div"
              count={newRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </Paper>
        </Box>
        {disablePrint === true ? null : (
          <button
            id="myButton"
            onClick={() => printTable()}
            type="button"
            className="mt-3 text-white bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-cyan-300 dark:focus:ring-cyan-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
          >
            {inventorySign ? "Quick Print" : "Print"}
          </button>
        )}
        <button
          id="exportButton"
          onClick={() => {
            if (inventorySign) {
              handleStockExcelExport(newRows);
            } else {
              handleExcelExport(rows);
            }
          }}
          type="button"
          className="mt-3 text-white bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-cyan-300 dark:focus:ring-cyan-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center mr-2 mb-2"
        >
          Export to Excel
        </button>
      </div>
    );
  }

  return getReturnContent();
}
