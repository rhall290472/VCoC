/**
 * Virtual Clerk of Course App Scripts
 * Version: 02Aug25 - Optimized
 */

// Configuration
const CONFIG = {
  sourceSheetName: 'Sheet1',
  colors: { scratch: 'Yellow' },
  rowHeight: 21,
  columnWidths: {
    A: 60,
    F: 20,
    G: 20,
    H: 20,
    J: 70,
    K: 30
  },
  columns: { F: 6, G: 7, H: 8 },
  table: {
    startRow: 4,
    startColumn: 10,
    numColumns: 2
  }
};


const SOURCE_SHEET_NAME = 'Sheet1'; // Change to your sheet name
const COLOR_SCR = "Yellow";  // Color for Scr
const DEFAULT_ROW_HEIGHT = 21;
const ROW_HEIGHT = 21; // Default row height in pixels
const COLUMN_A_WIDTH = 60; // Width for column A in pixels
const COLUMN_F_WIDTH = 20; // Width for column F in pixels

const COLUMN_F = 6;
const COLUMN_G = 7;
const COLUMN_H = 8;
const COLUMN_I = 9;
const COLUMN_J = 10;
const COLUMN_K = 11;


/**
 * Utility to handle errors consistently
 * @param {string} message - Error message
 * @param {string} [context] - Function or context where error occurred
 */
function handleError(message, context = 'Unknown') {
  Logger.log(`[${context}] Error: ${message}`);
  SpreadsheetApp.getUi().alert(`[${context}] Error: ${message}`);
}

/**
 * Validates and returns the active or named sheet
 * @param {string} [sheetName] - Optional sheet name
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object
 */
function getValidSheet(sheetName = null) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getActiveSheet();
  if (!sheet) throw new Error(`Sheet "${sheetName || 'active'}" not found.`);
  return sheet;
}

/**
 * Ensures the sheet has enough columns
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to check
 * @param {number} requiredColumns - Number of columns needed
 */
function ensureColumns(sheet, requiredColumns) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < requiredColumns) {
    sheet.insertColumnsAfter(maxColumns, requiredColumns - maxColumns);
  }
}


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
 * Creates custom menu on spreadsheet open
 */
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    if (!ui) throw new Error('Unable to access UI.');
    ui.createMenu('VCoC')
      .addItem('Break out by event', 'breakOutByEvent')
      .addItem('Delete all sheets except source', 'deleteAllSheetsExceptSource')
      .addSeparator()
      .addItem('Scratch current swimmer', 'scrSwimmer')
      .addItem('Unscratch swimmer', 'UnscratchSwimmer')
      .addToUi();
  } catch (error) {
    handleError(error.message, 'onOpen');
  }
}

/**
 * Breaks out data by event into separate sheets
 */
/**
 * Breaks out event data into separate sheets and creates a summary table
 */
function breakOutByEvent() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(SOURCE_SHEET_NAME);
  const ui = SpreadsheetApp.getUi();

  // Prompt user for number of lanes
  const response = ui.prompt(
    'Enter Number of Lanes',
    'Please enter the number of lanes (1-16):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled by user.');
    Logger.log('User cancelled the lanes prompt.');
    return;
  }

  const numLanes = parseInt(response.getResponseText());
  if (isNaN(numLanes) || numLanes < 1 || numLanes > 16) {
    ui.alert('Invalid input. Please enter a number between 1 and 16.');
    Logger.log(`Invalid number of lanes: ${response.getResponseText()}`);
    return;
  }

  if (!sourceSheet) {
    Logger.log(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    ui.alert(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    return;
  }

  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();
  const data = sourceSheet.getRange(1, 1, lastRow, lastColumn).getValues();
  if (data.length < 1) {
    Logger.log('No data found in source sheet!');
    ui.alert('No data found in source sheet!');
    return;
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
    ui.alert(
      `No valid events found in "${SOURCE_SHEET_NAME}"!\n` +
      `Expected rows in Column A starting with "Event " followed by a number.\n` +
      `${logMessage}`
    );
    return;
  }

  allEvents.forEach((event, index) => {
    const eventNum = event.eventName.match(/\d+/)[0];
    let sheetName = eventNum;
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

      // Auto-resize all columns, then set specific widths for A, F, G, H
      if (maxColumns > 0) {
        newSheet.autoResizeColumns(1, maxColumns);
        newSheet.setColumnWidth(1, COLUMN_A_WIDTH);
        if (maxColumns >= 6) {
          newSheet.setColumnWidth(6, COLUMN_F_WIDTH);
        }
        if (maxColumns >= 7) {
          newSheet.setColumnWidth(7, COLUMN_F_WIDTH);
        }
        if (maxColumns >= 8) {
          newSheet.setColumnWidth(8, COLUMN_F_WIDTH);
        }
      }

      placeEventSummaryTable(newSheet, numLanes);
    } catch (e) {
      Logger.log(`Error processing sheet ${sheetName}: ${e.message}`);
      ui.alert(`Error processing sheet ${sheetName}: ${e.message}`);
    }
  });
}

/**
 * Places the event summary table on the specified sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The target sheet
 * @param {number} numLanes - Number of lanes provided by the user
 */
/**
 * Places the event summary table on the specified sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The target sheet
 * @param {number} numLanes - Number of lanes provided by the user
 */
function placeEventSummaryTable(sheet, numLanes) {
  const ROW_HEIGHT = 21;
  const COLUMN_A_WIDTH = 60;
  const COLUMN_F_WIDTH = 20;
  const TABLE_START_ROW = 4;
  const TABLE_CIRCLE_ROW = 15;
  const TABLE_TF_ROW = 21;
  const TABLE_START_COLUMN = 10;
  const MIN_SWIMMERS_PER_HEAT = 3;

  try {
    if (!sheet) {
      throw new Error("No active sheet provided.");
    }

    // Calculate seeded swimmers (Entered - Scratches)
    const entered = sheet.getRange("B3:B1000").getValues().filter(cell => cell[0]).length;
    const scratches = sheet.getRange("H3:H1000").getValues().filter(cell => cell[0]).length;
    const seeded = entered - scratches;

    const tableData = [
      ["Lanes", numLanes.toString()], // J4/K4: Number of lanes
      ["=MOD(K8,K4)", ""], // J5: Remainder of swimmers after dividing by lanes
      ["Entered", "=COUNTA(B3:B1000)"], // J6/K6: Count of entries
      ["Scratches", "=COUNTA(H3:H1000)"], // J6/K7: Count of scratches
      ["Seeded", "=IFERROR(K6-K7,0)"], // J8/K8: Entered - Scratches
      ["", ""], // Spacer
      ["HEATS", "=(IF(K8/K4<1,0,ROUNDUP(K8/K4,0)))"], // J10/K10: Total heats, ensuring at least 3 swimmers per heat
      ["FULL", "=IF(AND(J5<3,J5>0),K10-2,IF(J5=0,K10,IF(K10-1<0, 0, K10-1)))"], // J11/K11: Full heats, reduce by 1 if partial heat < 3
      ["1 @", "=IF(AND(J5<3,J5>0),K4-(3-J5),IF(J5=0,"-",J5))"], // J12/K12: Indicate if partial heat has fewer than 3 swimmers
      ["Partial", "=IF(AND(J5<3,J5>0),3,"-")"], // J13/K13: Swimmers in partial heat, 0 if < 3
      ["", ""], // Spacer
    ];

    const tableCircleSeed = [
      ["Circle Seed", ""], // Header
      ["HEATS", "=K10"], // K16: Mirror total heats
      ["Heat 1", "=IF(K16=0,0,IF(K16=1,K8,IF(K16=2,CEILING(K8/2,1),IF(AND(K8<=K4*3,K8>K4*2),K4,CEILING(K8/K16,1)))))"], // K17: Swimmers in Heat 1, ensuring at least 3
      ["Heat 2", "=IF(K16<=1,0,IF(K16=2,K8-K17,IF(AND(K8<=K4*3,K8>K4*2),K4,IF((K8-K17)/(K16-1)<" + MIN_SWIMMERS_PER_HEAT + ",0,CEILING((K8-K17)/(K16-1),1)))))"], // K18: Swimmers in Heat 2, 0 if < 3
      ["Heat 3", "=IF(K16<=2,0,IF(K8-K17-K18<" + MIN_SWIMMERS_PER_HEAT + ",0,K8-K17-K18))"], // K19: Swimmers in Heat 3, 0 if < 3
      ["", ""], // Spacer
    ];

    const tableTimedFinals = [
      ["Timed Final", ""], // Header
      ["HEATS", "=K10"], // K22: Mirror total heats
      ["FULL", "=IF(K10=0,0,IF(J5<" + MIN_SWIMMERS_PER_HEAT + " AND J5>0,K10-1,K10))"], // K23: Mirror full heats
      ["Partial", "=IF(AND(J5<" + MIN_SWIMMERS_PER_HEAT + ",J5>0),0,J5)"], // K24: Mirror partial heat, 0 if < 3
      ["", ""], // Spacer
    ];

    const numRows = tableData.length + tableCircleSeed.length + tableTimedFinals.length;
    const numColumns = 2;

    // Ensure enough columns
    const minColumnsRequired = Math.max(6, TABLE_START_COLUMN + numColumns);
    let currentMaxColumns = sheet.getMaxColumns();
    if (currentMaxColumns < minColumnsRequired) {
      sheet.insertColumnsAfter(currentMaxColumns, minColumnsRequired - currentMaxColumns);
      currentMaxColumns = sheet.getMaxColumns();
    }

    // Ensure enough rows
    if (TABLE_START_ROW + numRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), (TABLE_START_ROW + numRows - 1) - sheet.getMaxRows());
    }

    // Write table data
    if (numRows > 0 && numColumns > 0) {
      sheet.getRange(TABLE_START_ROW, TABLE_START_COLUMN, tableData.length, numColumns).setValues(tableData);
    } else {
      throw new Error("Table data is empty.");
    }

    // Circle seeded data if we need it
    

    // Set row heights
    sheet.setRowHeights(TABLE_START_ROW, numRows, ROW_HEIGHT);

    // Set column widths
    sheet.autoResizeColumns(TABLE_START_COLUMN, numColumns);
    sheet.setColumnWidth(1, COLUMN_A_WIDTH);
    if (currentMaxColumns >= 6) {
      sheet.setColumnWidth(6, COLUMN_F_WIDTH); 
    }
    sheet.setColumnWidth(COLUMN_J, 70);
    sheet.setColumnWidth(COLUMN_K, 30);

    // Bold headers
    sheet.getRange(TABLE_START_ROW, TABLE_START_COLUMN, 1, numColumns).setFontWeight("bold");
    const headerRowsRelative = [7, 12, 18];
    headerRowsRelative.forEach(relativeRow => {
      const actualRow = TABLE_START_ROW + relativeRow - 1;
      if (actualRow <= TABLE_START_ROW + numRows - 1) {
        sheet.getRange(actualRow, TABLE_START_COLUMN, 1, numColumns).setFontWeight("bold");
      }
    });

    // Apply borders
    const borderRanges = [
      { startRow: 4, numRows: 5 },
      { startRow: 10, numRows: 4 },
      { startRow: 15, numRows: 5 },
      { startRow: 21, numRows: 4 },
    ];

    borderRanges.forEach(range => {
      sheet.getRange(range.startRow, TABLE_START_COLUMN, range.numRows, numColumns)
        .setBorder(true, true, true, true, true, true, "black", SpreadsheetApp.BorderStyle.SOLID);
    });

  const formulas = [
    {
      cell: 'K12',
      formula: '=IF(AND(J5<3,J5>0),K4-(3-J5),IF(J5=0,"-",J5))'
    },
    {
      cell: 'J13',
      formula: '=IF(J5<3,"1 @","-")'
    },
    {
      cell: 'K13',
      formula: '=IF(AND(J5<3,J5>0),3,"-")'
    }
  ];

  formulas.forEach(({cell, formula}) => {
    try {
      sheet.getRange(cell).setFormula(formula);
    } catch (e) {
      Logger.log(`Error placing formula in ${cell}: ${e.message}`);
    }
  });




    SpreadsheetApp.flush();
    protectAndHideJ4K24J5();
    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log(`Error in placeEventSummaryTable: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error in placeEventSummaryTable: ${error.message}`);
  }
}


/**
 * Protects range J4:K24 and hides contents of cell J5 in the active sheet.
 * Version: 02Aug25
 */
function protectAndHideJ4K24J5() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) throw new Error('No active sheet found');

    // Protect range J4:K24
    const rangeToProtect = sheet.getRange('J4:K24');
    const protection = rangeToProtect.protect().setDescription('Protected Range J4:K24');
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);

    // Hide cell J5 by setting font color to match background
    const rangeJ5 = sheet.getRange('J5');
    rangeJ5.setFontColor('#FFFFFF').setBackground('#FFFFFF');

  } catch (error) {
    Logger.log(`Error: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Error: ${error.message}`);
  }
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

    // Check and ensure at least H columns exist
    const scratchColumn = COLUMN_H; // Column H
    let maxColumns = sheet.getMaxColumns();
    if (maxColumns < scratchColumn) {
      const columnsToAdd = scratchColumn - maxColumns;
      sheet.insertColumnsAfter(maxColumns, columnsToAdd);
      maxColumns = sheet.getMaxColumns(); // Update maxColumns after adding
      if (maxColumns < scratchColumn) {
        throw new Error("Failed to add columns to reach column H.");
      }
    }

    // Get the last column with data, but ensure it includes at least 7 columns
    //const lastColumn = Math.max(sheet.getLastColumn(), scratchColumn);
    const lastColumn = COLUMN_H;
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    // Set background color for the entire row
    sheet.getRange(row, 1, 1, COLUMN_H).setBackground(COLOR_SCR);

    // Set "Scratch" in column H
    sheet.getRange(row, COLUMN_H).setValue("Scratch");

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

    lastColumn = COLUMN_H;
    sheet.getRange(row, 1, 1, COLUMN_H).setBackground(null);

    sheet.getRange(row, COLUMN_H).setValue("");

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