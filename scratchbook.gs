/**
 * Virtual Clerk of Course App Scripts - Scratch Book
 * Version: 31Jul25 - Created
 */
// Configurable source sheet name
const SOURCE_SHEET_NAME = 'Sheet1'; // Change to your sheet name
const COLOR_SCR = "Yellow";  // Color for Scr
const DEFAULT_ROW_HEIGHT = 21;
const ROW_HEIGHT = 21; // Default row height in pixels
const COLUMN_A_WIDTH = 60; // Width for column A in pixels
const COLUMN_F_WIDTH = 20; // Width for column F in pixels


/**
 * Trigger on script installation
 */
function onInstall(e) {
  try {
    onOpen(e);
  } catch (error) {
    Logger.log("Error in onInstall: " + error.message);
    SpreadsheetApp.getUi().alert("Error during installation: " + error.message);
  }
}

/**
 * Create custom menu on spreadsheet open
 */
function onOpen(e) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (!ui) {
      throw new Error("Unable to access UI.");
    }
    ui.createMenu('VCoC')
      .addItem('Break out by event', 'breakOutByEvent')
      .addItem('Delete all sheets except the source', 'deleteAllSheetsExceptSource')
      .addSeparator()
      .addItem('Scr current swimmer', 'scrSwimmer')
      .addItem('Unscratch swimmer', 'UnscratchSwimmer')
      .addToUi();
  } catch (error) {
    Logger.log("Error in onOpen: " + error.message);
    SpreadsheetApp.getUi().alert("Error setting up menu: " + error.message);
  }
}
/*
*
*
*
*/
function breakOutByEvent() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(SOURCE_SHEET_NAME);

  if (!sourceSheet) {
    Logger.log(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    SpreadsheetApp.getUi().alert(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    return;
  }

  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();
  const data = sourceSheet.getRange(1, 1, lastRow, lastColumn).getValues();
  if (data.length < 1) {
    Logger.log('No data found in source sheet!');
    SpreadsheetApp.getUi().alert('No data found in source sheet!');
    return;
  }

  Logger.log('First 20 rows of first column:');
  let logMessage = 'First 10 rows of first column (for alert):\n';
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const firstCell = data[i][0] ? data[i][0].toString().trim() : '';
    Logger.log(`Row ${i + 1}: "${firstCell}"`);
    if (i < 10) {
      logMessage += `Row ${i + 1}: "${firstCell}"\n`;
    }
  }

  let currentEvent = null;
  let eventData = [];
  let allEvents = [];
  let seenEventNumbers = new Set();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = row[0] ? row[0].toString().trim() : '';

    if (row.every(cell => !cell || cell.toString().trim() === '')) {
      continue;
    }

    if (firstCell.match(/^Event\s*\d+\b/i)) {
      const eventNumber = firstCell.match(/^Event\s*\d+\b/i)[0].replace(/\s+/g, ' ').trim();
      const eventNum = eventNumber.match(/\d+/)[0];
      Logger.log(`Row ${i + 1}: Detected event "${eventNumber}" (number: ${eventNum}), raw: "${firstCell}"`);

      if (seenEventNumbers.has(eventNum)) {
        Logger.log(`Skipping duplicate event at row ${i + 1}: ${firstCell}`);
        continue;
      }
      seenEventNumbers.add(eventNum);

      if (currentEvent && eventData.length > 0) {
        allEvents.push({ eventName: currentEvent, data: eventData });
        Logger.log(`Saved event: ${currentEvent}, rows: ${eventData.length}`);
      }
      currentEvent = eventNumber;
      eventData = [row];
      continue;
    }

    if (currentEvent) {
      eventData.push(row);
      if (currentEvent.match(/\d+/) && currentEvent.match(/\d+/)[0] === '58') {
        Logger.log(`Adding row ${i + 1} to Event 58: ${JSON.stringify(row)}`);
      }
    }
  }

  if (currentEvent && eventData.length > 0) {
    const eventNum = currentEvent.match(/\d+/)[0];
    Logger.log(`Saving last event: ${currentEvent} (number: ${eventNum}), rows: ${eventData.length}`);
    if (!seenEventNumbers.has(eventNum)) {
      allEvents.push({ eventName: currentEvent, data: eventData });
      seenEventNumbers.add(eventNum);
    }
  }

  if (allEvents.length === 0) {
    Logger.log('No valid events found in the data!');
    SpreadsheetApp.getUi().alert(
      `No valid events found in "${SOURCE_SHEET_NAME}"!\n` +
      `Expected rows in Column A starting with "Event " followed by a number.\n` +
      `${logMessage}`
    );
    return;
  }

  allEvents.forEach((event, index) => {
    const eventNum = event.eventName.match(/\d+/)[0]; // Extract just the number
    let sheetName = eventNum; // Use only the number for sheet name
    let newSheet = spreadsheet.getSheetByName(sheetName);

    if (newSheet) {
      newSheet.clear();
    } else {
      newSheet = spreadsheet.insertSheet(sheetName);
    }

    const maxColumns = Math.max(...event.data.map(row => row.filter(cell => cell && cell.toString().trim() !== '').length));
    try {
      // Ensure at least 6 columns for column F
      let currentMaxColumns = newSheet.getMaxColumns();
      if (currentMaxColumns < 6) {
        newSheet.insertColumnsAfter(currentMaxColumns, 6 - currentMaxColumns);
        currentMaxColumns = newSheet.getMaxColumns();
        if (currentMaxColumns < 6) {
          throw new Error("Failed to add columns to reach column F.");
        }
      }

      const paddedData = event.data.map(row => {
        const paddedRow = [...row];
        while (paddedRow.length < maxColumns) {
          paddedRow.push('');
        }
        return paddedRow.slice(0, maxColumns);
      });
      newSheet.getRange(1, 1, paddedData.length, maxColumns).setValues(paddedData);
      newSheet.getRange(1, 1, 1, Math.min(6, maxColumns)).mergeAcross();

      // Set all row heights to 21 pixels
      if (paddedData.length > 0) {
        newSheet.setRowHeights(1, paddedData.length, ROW_HEIGHT);
      }

      // Auto-resize all columns, then set specific widths for A and F
      if (maxColumns > 0) {
        newSheet.autoResizeColumns(1, maxColumns);
        newSheet.setColumnWidth(1, COLUMN_A_WIDTH); // Column A to 60 pixels
        if (maxColumns >= 6) {
          newSheet.setColumnWidth(6, COLUMN_F_WIDTH); // Column F to 20 pixels
        }
        if (maxColumns >= 7) {
          newSheet.setColumnWidth(7, COLUMN_F_WIDTH); // Column G to 20 pixels
        }
        if (maxColumns >= 8) {
          newSheet.setColumnWidth(8, COLUMN_F_WIDTH); // Column H to 20 pixels
        }
      }

//      newSheet.getRange(1, 1, 1, maxColumns).setFontWeight('bold');
//      if (paddedData.length > 2) {
//        newSheet.getRange(3, 1, 1, maxColumns).setFontWeight('bold');
//      }

    placeEventSummaryTable();
    } catch (e) {
      Logger.log(`Error processing sheet ${sheetName}: ${e.message}`);
      SpreadsheetApp.getUi().alert(`Error processing sheet ${sheetName}: ${e.message}`);
    }
  });
}

/*
*
*
*
*/
function placeEventSummaryTable() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const ROW_HEIGHT = 21; // Default row height in pixels
  const COLUMN_A_WIDTH = 60; // Width for column A in pixels
  const COLUMN_F_WIDTH = 20; // Width for column F in pixels
  const TABLE_START_ROW = 4; // Start at row 2
  const TABLE_START_COLUMN = 10; // Start at column J (10)

  try {
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    // Define the table data with corrected formulas
    const tableData = [
      ["Lanes", "8"], // K2: Number of lanes
      ["=MOD(K8,K4)", ""], // J5: Remainder of swimmers after heats
      ["Entered", "=COUNTA(B3:B1000)"], // K5: Count of entries in B3:B1000
      ["Scratches", "=COUNTA(G3:G1000)"], // K6: Count of scratches in G3:G1000
      ["Seeded", "=IFERROR(K6-K7,0)"], // K7: Entered - Scratches
      ["", ""], // Spacer
      ["HEATS", "=(IF(K8/K4<1,0,ROUNDUP(K8/K4,0)))"], 
      ["FULL", "=IF(AND(J5<3,J5>0),K10-2,IF(J5=0,K10,IF(K10-1<0, 0, K10-1)))"], 
      ["1 @", ""], 
      ["Partial", ""], 
    ];

/*
      ["", ""], 
      ["Circle Seed", ""], // Header
      ["HEATS", "=K10"], // K16: Mirror total heats
      ["Heat 1", ""], // K17: Swimmers in Heat 1
      ["Heat 2", ""], // K18: Swimmers in Heat 2
      ["Heat 3", ""], // K19: Swimmers in Heat 3
      ["", ""], // Spacer
      ["Timed Final", ""], // Header
      ["HEATS", "=K10"], // K22: Mirror total heats
      ["FULL", ""], // K23: Mirror full heats
      ["Partial", ""], // K24: Mirror partial heat
      ["", ""], // Spacer

*/
    const numRows = tableData.length;
    const numColumns = 2; // Table has 2 columns (Label, Value)

    // Ensure enough columns for table (J:K) and column F
    const minColumnsRequired = Math.max(6, TABLE_START_COLUMN + numColumns - 1);
    let currentMaxColumns = sheet.getMaxColumns();
    if (currentMaxColumns < minColumnsRequired) {
      sheet.insertColumnsAfter(currentMaxColumns, minColumnsRequired - currentMaxColumns);
      currentMaxColumns = sheet.getMaxColumns();
    }

    // Ensure enough rows for table
    if (TABLE_START_ROW + numRows - 1 > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), (TABLE_START_ROW + numRows - 1) - sheet.getMaxRows());
    }

    // Write the table data to the sheet starting at J2
    if (numRows > 0 && numColumns > 0) {
      sheet.getRange(TABLE_START_ROW, TABLE_START_COLUMN, numRows, numColumns).setValues(tableData);
    } else {
      throw new Error("Table data is empty.");
    }

    // Set row heights to 21 pixels for table rows
    sheet.setRowHeights(TABLE_START_ROW, numRows, ROW_HEIGHT);

    // Auto-resize table columns (J:K), set widths for A and F
    sheet.autoResizeColumns(TABLE_START_COLUMN, numColumns);
    sheet.setColumnWidth(1, COLUMN_A_WIDTH);
    if (currentMaxColumns >= 6) {
      sheet.setColumnWidth(6, COLUMN_F_WIDTH);
    }

    // Bold the first row and section headers
    sheet.getRange(TABLE_START_ROW, TABLE_START_COLUMN, 1, numColumns).setFontWeight("bold");
    const headerRowsRelative = [7, 12, 18]; // J7, J12, J18 (HEATS, Circle Seed, Timed Final)
    headerRowsRelative.forEach(relativeRow => {
      const actualRow = TABLE_START_ROW + relativeRow - 1;
      if (actualRow <= TABLE_START_ROW + numRows - 1) {
        sheet.getRange(actualRow, TABLE_START_COLUMN, 1, numColumns).setFontWeight("bold");
      }
    });

/*
    // Define and apply borders for table sections
    const borderRanges = [
      { startRow: 4, numRows: 4 }, // J4:K7 (Lanes to Seeded)
      { startRow: 8, numRows: 3 }, // J8:K10 (HEATS to Partial)
      { startRow: 13, numRows: 4 }, // J13:K16 (Circle Seed to Heat 3)
      { startRow: 19, numRows: 3 }, // J19:K21 (Timed Final to Partial)
    ];

    borderRanges.forEach(range => {
      sheet.getRange(range.startRow, TABLE_START_COLUMN, range.numRows, numColumns)
        .setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
    });
*/
    SpreadsheetApp.flush();

    placeFormula();

  } catch (error) {
    Logger.log(`Error in placeEventSummaryTable: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error in placeEventSummaryTable: ${error.message}`);
  }
}

function placeFormula() {
  var formula1 = '=IF(AND($J$5<3,$J$5>0),$K$10-2,IF($J$5=0,$K$10,IF($K$10-1<0, 0, $K$10-1)))';
  var formula2 = '=IF(AND($J$5<3,$J$5>0),$K$4-(3-$J$5),IF($J$5=0,"-",$J$5))';
  var formula3 = '=IF(AND(J5<3,J5>0),3,"-")';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

var targetCell = 'K11';  // Target cell where the formula will be placed
  try {
    var cell = sheet.getRange(targetCell);
    cell.setFormula(formula1);
    Logger.log('Formula placed successfully in ' + targetCell);
  } catch (e) {
    Logger.log('Error placing formula: ' + e.message);
  }

  var targetCell = 'K12';  // Target cell where the formula will be placed
  try {
    var cell = sheet.getRange(targetCell);
    cell.setFormula(formula2);
    Logger.log('Formula placed successfully in ' + targetCell);
  } catch (e) {
    Logger.log('Error placing formula: ' + e.message);
  }

  var targetCell = 'K13';  // Target cell where the formula will be placed
  try {
    var cell = sheet.getRange(targetCell);
    cell.setFormula(formula3);
    Logger.log('Formula placed successfully in ' + targetCell);
  } catch (e) {
    Logger.log('Error placing formula: ' + e.message);
  }


  sheet.setColumnWidth(10, 70);   // Column J
  sheet.setColumnWidth(11, 30);   // Column K
}

/*
*
*
*
*/
function deleteAllSheetsExceptSource() {
  try {
    // Get the active spreadsheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check if the source sheet exists
    const sourceSheet = spreadsheet.getSheetByName(SOURCE_SHEET_NAME);
    if (!sourceSheet) {
      Logger.log(`Error: Source sheet "${SOURCE_SHEET_NAME}" not found!`);
      return;
    }
    
    // Get all sheets in the spreadsheet
    const sheets = spreadsheet.getSheets();
    
    // Check if there's only one sheet
    if (sheets.length === 1) {
      Logger.log("Only one sheet exists. No sheets will be deleted.");
      return;
    }
    
    // Loop through all sheets and delete those that aren't the source sheet
    sheets.forEach(sheet => {
      if (sheet.getName() !== SOURCE_SHEET_NAME) {
        spreadsheet.deleteSheet(sheet);
      }
    });
    
    Logger.log(`All sheets deleted except "${SOURCE_SHEET_NAME}"`);
    
  } catch (error) {
    Logger.log(`Error: ${error.message}`);
  }
}
/**
 * Scratch the current swimmer
 * 
 */
function scrSwimmer() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    const cell = sheet.getActiveCell();
    if (!cell) {
      throw new Error("No active cell selected.");
    }

    const row = cell.getRow();
    if (row < 1) {
      throw new Error("Invalid row selected.");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < row) {
      throw new Error("Selected row is beyond the last used row.");
    }

    // Check and ensure at least 7 columns exist
    const scratchColumn = 7; // Column G
    let maxColumns = sheet.getMaxColumns();
    if (maxColumns < scratchColumn) {
      const columnsToAdd = scratchColumn - maxColumns;
      sheet.insertColumnsAfter(maxColumns, columnsToAdd);
      maxColumns = sheet.getMaxColumns(); // Update maxColumns after adding
      if (maxColumns < scratchColumn) {
        throw new Error("Failed to add columns to reach column G.");
      }
    }

    // Get the last column with data, but ensure it includes at least 7 columns
    //const lastColumn = Math.max(sheet.getLastColumn(), scratchColumn);
    const lastColumn = 7;
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    // Set background color for the entire row
    sheet.getRange(row, 1, 1, lastColumn).setBackground(COLOR_SCR);

    // Set "Scratch" in column G
    sheet.getRange(row, scratchColumn).setValue("Scratch");

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in scrSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error in scrSwimmer: " + error.message);
  }
}



/**
 * Unscratch the current swimmer
 * 
 */
function UnscratchSwimmer() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var cell = sheet.getActiveCell();
    if (!cell) {
      throw new Error("No active cell selected.");
    }

    var row = cell.getRow();
    if (row < 1) {
      throw new Error("Invalid row selected.");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < row) {
      throw new Error("Selected row is beyond the last used row.");
    }

//    sheet.getRange(row, 1, 1, 2).clearContent();

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    sheet.getRange(row, 1, 1, 7).setBackground(null);

    if (typeof findLastUsedColumn !== "function") {
      throw new Error("Function findLastUsedColumn is not defined.");
    }
    var lastUsedColumn = findLastUsedColumn();
    if (lastUsedColumn < 1 || lastUsedColumn > lastColumn) {
      throw new Error("Invalid last used column: " + lastUsedColumn);
    }

    sheet.getRange(row, lastUsedColumn).setValue("");

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in UnscratchSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
}

/**
 * Find the last used column in the current row
 * 
 */
function findLastUsedColumn(rowNumber = null, columnWidth = 33) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error("No active spreadsheet found.");

    const sheet = spreadsheet.getActiveSheet();
    if (!sheet) throw new Error("No active sheet found.");

    // Use provided row number or fall back to active cell's row
    const currentRow = rowNumber !== null ? rowNumber : sheet.getActiveCell().getRow();
    if (currentRow < 1) throw new Error("Invalid row number.");

    const lastRow = sheet.getLastRow();
    if (lastRow < currentRow) throw new Error("Row is beyond the last used row.");

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) return 0; // Return 0 for empty sheet

    const rowData = sheet.getRange(currentRow, 1, 1, lastColumn).getValues()[0];
    let lastUsedColumn = 0; // Default to 0 if row is empty

    for (let i = rowData.length - 1; i >= 0; i--) {
      if (rowData[i] !== "") {
        lastUsedColumn = i + 1;
        break;
      }
    }

    if (lastUsedColumn > 0) {
      sheet.setColumnWidth(lastUsedColumn, columnWidth);
    }

    return lastUsedColumn;
  } catch (error) {
    Logger.log(`Error in findLastUsedColumn: ${error.message}`);
    throw error; // Rethrow for calling function
  }
}