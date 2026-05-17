import ExcelJS from "exceljs";

/**
 * Exports data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {Array} headerCells - Array of header config objects with { id, label }
 * @param {string} fileName - Name for the exported file (without .xlsx extension)
 */
export const exportToExcel = async (data, headerCells, fileName) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");

    // Add header row
    const headerRow = worksheet.addRow(headerCells.map((cell) => cell.label));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" }, // Light gray background
      };
    });

    // Add data rows
    data.forEach((row) => {
      const newRow = headerCells.map((cell) => {
        const cellValue = row[cell.id];
        // Handle zero values and null/undefined
        return cellValue === 0 ? 0 : cellValue || "";
      });
      worksheet.addRow(newRow);
    });

    // Set column widths
    worksheet.columns = headerCells.map(() => ({ width: 20 }));

    // Page setup
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    // Generate buffer and trigger download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
  }
};
