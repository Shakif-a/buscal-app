import * as React from "react";
import * as ExcelJS from "exceljs";
import PropTypes from "prop-types";
import { Box, alpha } from "@mui/material";
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
import { getCategoryColour } from "../UtilityFunctions";

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
  rowsPP,
  disablePrint,
  onRowClick,
}) {
  const [order, setOrder] = React.useState("desc");
  const [orderBy, setOrderBy] = React.useState("completionDate");
  const [selected, setSelected] = React.useState([]);
  const [page, setPage] = React.useState(0);
  const [dense, setDense] = React.useState(false);
  const [rowsPerPage, setRowsPerPage] = React.useState(rowsPP ? rowsPP : 5);
  let fontColour = "rgb(0, 0, 0)"; // Default to black
  let isCategory = false;

  // Check if rows.category exists
  if (rows && rows[0] && rows[0].category) {
    fontColour = "rgb(255, 255, 255)"; // Set font color to white
    isCategory = true;
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
      // Highlight negative days difference in red
      if (columnId === "daysDifference" && value < 0) {
        return (
          <span style={{ color: "#FFD700", fontWeight: "bold" }}>
            {value.toLocaleString()}
          </span>
        );
      }
      return value.toLocaleString();
    } else {
      return value;
    }
  }

  function printTable() {
    window.print();
  }

  const handleSelectAllClick = (event) => {
    if (event.target.checked) {
      const newSelected = rows?.map((n) => n.name);
      setSelected(newSelected);
      return;
    }
    setSelected([]);
  };

  const handleClick = (event, name) => {
    const selectedIndex = selected.indexOf(name);
    let newSelected = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, name);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);

    if (typeof onRowClick === "function") {
      onRowClick(name);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Export data to excel
  const handleExcelExport = async (rows) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Table Data");

    // Add header row with bold text
    const headerRow = worksheet.addRow(headerCells.map((cell) => cell.label));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Append rows data
    rows.forEach((row) => {
      const newRow = headerCells.map((cell) => {
        const cellValue = row[cell.id];
        return cellValue === 0 ? 0 : cellValue || "";
      });
      worksheet.addRow(newRow);
    });

    // Set all columns to a width of 15
    worksheet.columns = headerCells.map(() => ({ width: 15 }));

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
    a.download = "history_table.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const isSelected = (name) => selected.indexOf(name) !== -1;

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows =
    page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  function getRow(row, headerCells) {
    return (
      <>
        <TableCell
          component="th"
          //id={labelId}
          scope="row"
          padding="normal"
          align="center"
          style={{ color: fontColour }} // Set font colour to white
        >
          {row[headerCells[0].id]}
        </TableCell>
        {headerCells.map((x, i) => {
          return (
            i != 0 && (
              <TableCell key={i} align="center" style={{ color: fontColour }}>
                {renderCell(row[headerCells[i].id], headerCells[i].id)}
              </TableCell>
            )
          );
        })}
      </>
    );
  }

  function getReturnContent() {
    if (!rows || rows.length === 0) {
      return <p>No entries</p>;
    }
    return (
      <div>
        {disablePrint === true ? null : (
          <div className="mb-3">
            <div className="text-lg text-right">{currentDate}</div>
          </div>
        )}
        <Box sx={{ width: "100%" }}>
          <Paper sx={{ width: "100%", mb: 2 }}>
            <EnhancedTableToolbar numSelected={selected.length} />
            <div id="printableArea">
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
                    {/* if you don't need to support IE11, you can replace the `stableSort` call with:
                   rows.slice().sort(getComparator(order, orderBy)) */}
                    {stableSort(rows, getComparator(order, orderBy))
                      .slice(
                        page * rowsPerPage,
                        page * rowsPerPage + rowsPerPage
                      )
                      .map((row, index) => {
                        const isItemSelected = isSelected(row.id);

                        return (
                          <TableRow
                            onClick={(event) => handleClick(event, row.id)}
                            //role="checkbox"
                            //aria-checked={isItemSelected}
                            tabIndex={-1}
                            key={`row-${index}`}
                            // conditions to preserve previous status with F6 renders
                            selected={isCategory ? false : isItemSelected}
                            sx={{
                              backgroundColor:
                                row.completionStatus === "cancelled"
                                  ? "#A9A9A9"
                                  : getCategoryColour(row.category),
                              cursor: isCategory ? "pointer" : "default",

                              "&:hover": {
                                backgroundColor: alpha(
                                  getCategoryColour(row.category),
                                  0.8
                                ),
                              },
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
            </div>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 100, 1000]}
              component="div"
              count={rows.length}
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
            Print
          </button>
        )}
        <button
          id="exportButton"
          onClick={() => handleExcelExport(rows)}
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
