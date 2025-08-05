/**
 * Virtual Clerk of Course App Scripts
 * Version: 02Aug25 - Optimized
 */

// Configuration
const CONFIG = {
  sourceSheetName: 'Sheet1',
  colors: { 
    scratch: 'Yellow',
    top: '#b7e1cd',
    white: '#FFFFFF',
    circle: '#92d050'
  },
  rowHeight: 21,
  columnWidths: {
    A: 60,
    F: 20,
    G: 20,
    H: 20,
    J: 70,
    K: 30
  },
  columns: { 
    F: 6, 
    G: 7, 
    H: 8,
    I: 9,
    J: 10,
    K: 11
  },
  table: {
    startRow: 4,
    circleRow: 15,
    tfRow: 21,
    startColumn: 10,
    numColumns: 2,
    minSwimmersPerHeat: 3
  }
};

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
    handleError(error.message, 'onInstall');
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
      .addItem('Top 8', 'Top8')
      .addItem('Top 16', 'Top16')
      .addItem('Unscratch swimmer', 'UnscratchSwimmer')
      .addToUi();
  } catch (error) {
    handleError(error.message, 'onOpen');
  }
}

/**
 * Breaks out event data into separate sheets and creates a summary table
 */
// Main function
function breakOutByEvent() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = getValidSheet(CONFIG.sourceSheetName);
    const numLanes = getNumLanesFromUser();

    const events = parseEvents(sourceSheet);
    if (events.length === 0) {
      throw new Error(`No valid events found in "${CONFIG.sourceSheetName}"!\nExpected rows in Column A starting with "Event " followed by a number.`);
    }

    events.forEach(event => processEvent(spreadsheet, event, numLanes));
  } catch (error) {
    handleError(error.message, 'breakOutByEvent');
  }
}

// Get number of lanes from user
function getNumLanesFromUser() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Enter Number of Lanes',
    'Please enter the number of lanes (1-16):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operation cancelled by user.');
    Logger.log('User cancelled the lanes prompt.');
    throw new Error('User cancelled');
  }

  const numLanes = parseInt(response.getResponseText());
  if (isNaN(numLanes) || numLanes < 1 || numLanes > 16) {
    ui.alert('Invalid input. Please enter a number between 1 and 16.');
    Logger.log(`Invalid number of lanes: ${response.getResponseText()}`);
    throw new Error('Invalid number of lanes');
  }
  return numLanes;
}

// Parse events from source sheet
function parseEvents(sourceSheet) {
  const data = sourceSheet.getRange(1, 1, sourceSheet.getLastRow(), sourceSheet.getLastColumn()).getValues();
  if (data.length < 1) throw new Error('No data found in source sheet!');

  let currentEvent = null;
  let eventData = [];
  let allEvents = [];
  const seenEventNumbers = new Set();

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = row[0] ? row[0].toString().trim() : '';

    if (row.every(cell => !cell || cell.toString().trim() === '')) continue;

    if (firstCell.match(/^Event\s*\d+\b/i)) {
      const eventNumber = firstCell.match(/^Event\s*\d+\b/i)[0].replace(/\s+/g, ' ').trim();
      const eventNum = eventNumber.match(/\d+/)[0];

      if (seenEventNumbers.has(eventNum)) {
        Logger.log(`Skipping duplicate event at row ${i + 1}: ${firstCell}`);
        continue;
      }
      seenEventNumbers.add(eventNum);

      if (currentEvent && eventData.length > 0) {
        allEvents.push({ eventName: currentEvent, data: eventData });
      }
      currentEvent = eventNumber;
      eventData = [row];
      continue;
    }

    if (currentEvent) eventData.push(row);
  }

  if (currentEvent && eventData.length > 0) {
    allEvents.push({ eventName: currentEvent, data: eventData });
  }

  return allEvents;
}

// Process each event
function processEvent(spreadsheet, event, numLanes) {
  const eventNum = event.eventName.match(/\d+/)[0];
  const sheetName = eventNum;
  let newSheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  newSheet.clear();

  const maxColumns = Math.max(...event.data.map(row => row.filter(cell => cell && cell.toString().trim() !== '').length));
  ensureColumns(newSheet, Math.max(6, maxColumns));

  const paddedData = event.data.map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < maxColumns) paddedRow.push('');
    return paddedRow.slice(0, maxColumns);
  });

  newSheet.getRange(1, 1, paddedData.length, maxColumns).setValues(paddedData);
  newSheet.getRange(1, 1, 1, Math.min(6, maxColumns)).mergeAcross();

  if (paddedData.length > 0) {
    newSheet.setRowHeights(1, paddedData.length, CONFIG.rowHeight);
  }

  formatSheet(newSheet, maxColumns);
  placeEventSummaryTable(newSheet, numLanes);
  protectRange(newSheet, sheetName);
  applyConditionalFormatting(newSheet);
}

// Format sheet columns
function formatSheet(sheet, maxColumns) {
  sheet.autoResizeColumns(1, maxColumns);
  sheet.setColumnWidth(1, CONFIG.columnWidths.A);
  if (maxColumns >= CONFIG.columns.F) sheet.setColumnWidth(CONFIG.columns.F, CONFIG.columnWidths.F);
  if (maxColumns >= CONFIG.columns.G) sheet.setColumnWidth(CONFIG.columns.G, CONFIG.columnWidths.G);
  if (maxColumns >= CONFIG.columns.H) sheet.setColumnWidth(CONFIG.columns.H, CONFIG.columnWidths.H);
}

// Protect range J4:K25
function protectRange(sheet, sheetName) {
  const range = sheet.getRange('J4:K25');
  const protection = range.protect().setDescription(`Protected Range J4:K25 on ${sheetName}`);
  protection.removeEditors(protection.getEditors());
  protection.setWarningOnly(false);
}

// Apply conditional formatting based on K10 value
function applyConditionalFormatting(sheet) {
  sheet.getRange('J5').setFontColor(CONFIG.colors.white);
  const k10Value = sheet.getRange('K10').getValue();
  if (k10Value < 3) {
    sheet.getRange('J10:K13').setFontColor(CONFIG.colors.white);
    sheet.getRange('J15:K19').setBackground(CONFIG.colors.circle);
  } else {
    sheet.getRange('J15:K19').setFontColor(CONFIG.colors.white);
  }
}/**
 * Places the event summary table on the specified sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The target sheet
 * @param {number} numLanes - Number of lanes provided by the user
 */
function placeEventSummaryTable(sheet, numLanes) {
  try {
    if (!sheet || typeof sheet.getRange !== 'function') {
      throw new Error('Invalid sheet object.');
    }

    const numLanesValue = Number(sheet.getRange('K4').getValue()) || numLanes;
    const entered = sheet.getRange('B3:B1000').getValues().filter(cell => cell[0]).length;
    const scratches = sheet.getRange('H3:H1000').getValues().filter(cell => cell[0]).length;
    const seededSwimmers = Math.max(0, entered - scratches);

    if (!Number.isFinite(numLanesValue) || numLanesValue <= 0) {
      Logger.log(`Invalid number of lanes in K4: ${numLanesValue}. Using default: ${numLanes}.`);
    }
    if (!Number.isFinite(seededSwimmers) || seededSwimmers < 0) {
      Logger.log(`Invalid number of seeded swimmers: ${seededSwimmers}. Using 0.`);
    }

    const tableData = [
      ['Lanes', numLanes.toString()],
      ['=MOD(K8,K4)', ''],
      ['Entered', '=COUNTA(B3:B1000)'],
      ['Scratches', '=COUNTA(H3:H1000)'],
      ['Seeded', '=IFERROR(K6-K7,0)'],
      ['', ''],
      ['HEATS', '=(IF(K8/K4<1,0,ROUNDUP(K8/K4,0)))'],
      ['FULL', `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),K10-2,IF(J5=0,K10,IF(K10-1<0,0,K10-1)))`],
      ['1 @', `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),K4-(3-J5),IF(J5=0,"-",J5))`],
      ['Partial', `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),3,"-")`],
      ['', '']
    ];

    const tableCircleSeed = [
      ['Circle Seed', ''],
      ['HEATS', '=K10'],
      ['Heat 1', `=IF(K16=0,0,IF(K16=1,K8,IF(K16=2,CEILING(K8/2,1),IF(AND(K8<=K4*3,K8>K4*2),K4,CEILING(K8/K16,1)))))`],
      ['Heat 2', `=IF(K16<=1,0,IF(K16=2,K8-K17,IF(AND(K8<=K4*3,K8>K4*2),K4,IF((K8-K17)/(K16-1)<${CONFIG.table.minSwimmersPerHeat},0,CEILING((K8-K17)/(K16-1),1)))))`],
      ['Heat 3', `=IF(K16<=2,0,IF(K8-K17-K18<${CONFIG.table.minSwimmersPerHeat},0,K8-K17-K18))`],
      ['', '']
    ];

    const tableTimedFinals = [
      ['Timed Final', ''],
      ['HEATS', '=K10'],
      ['FULL', `=IF(K10=0,0,IF(J5<${CONFIG.table.minSwimmersPerHeat},J5>0,K10-1,K10))`],
      ['1@', `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),0,J5)`],
      ['Partial', '']
    ];

    const tablesToWrite = [tableData, tableCircleSeed, tableTimedFinals];
    const numRows = tablesToWrite.reduce((sum, table) => sum + table.length, 0);
    const numColumns = CONFIG.table.numColumns;

    ensureColumns(sheet, Math.max(CONFIG.columns.F, CONFIG.table.startColumn + numColumns));
    if (CONFIG.table.startRow + numRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), (CONFIG.table.startRow + numRows - 1) - sheet.getMaxRows());
    }

    let currentRow = CONFIG.table.startRow;
    tablesToWrite.forEach(table => {
      if (table.length > 0) {
        sheet.getRange(currentRow, CONFIG.table.startColumn, table.length, numColumns).setValues(table);
        currentRow += table.length;
      }
    });

    sheet.setRowHeights(CONFIG.table.startRow, numRows, CONFIG.rowHeight);
    sheet.autoResizeColumns(CONFIG.table.startColumn, numColumns);
    sheet.setColumnWidth(1, CONFIG.columnWidths.A);
    if (sheet.getMaxColumns() >= CONFIG.columns.F) {
      sheet.setColumnWidth(CONFIG.columns.F, CONFIG.columnWidths.F);
    }
    sheet.setColumnWidth(CONFIG.table.startColumn, CONFIG.columnWidths.J);
    sheet.setColumnWidth(CONFIG.table.startColumn + 1, CONFIG.columnWidths.K);

    sheet.getRange(CONFIG.table.startRow, CONFIG.table.startColumn, 1, numColumns).setFontWeight('bold');
    [7, 12, 18].forEach(relativeRow => {
      const actualRow = CONFIG.table.startRow + relativeRow - 1;
      if (actualRow <= CONFIG.table.startRow + numRows - 1) {
        sheet.getRange(actualRow, CONFIG.table.startColumn, 1, numColumns).setFontWeight('bold');
      }
    });

    const borderRanges = [
      { startRow: CONFIG.table.startRow, numRows: 5 },
      { startRow: CONFIG.table.startRow + 6, numRows: 4 },
      { startRow: CONFIG.table.circleRow, numRows: 5 },
      { startRow: CONFIG.table.tfRow, numRows: 5 }
    ];
    borderRanges.forEach(range => {
      sheet.getRange(range.startRow, CONFIG.table.startColumn, range.numRows, numColumns)
        .setBorder(true, true, true, true, true, true, 'black', SpreadsheetApp.BorderStyle.SOLID);
    });

    const formulas = [
      { cell: 'K12', formula: `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),K4-(3-J5),IF(J5=0,"-",J5))` },
      { cell: 'J13', formula: `=IF(J5<${CONFIG.table.minSwimmersPerHeat},"1 @","-")` },
      { cell: 'K13', formula: `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),3,"-")` },
      { cell: 'K22', formula: '=(IF(K8/K4<1,0,ROUNDUP(K8/K4,0)))' },
      { cell: 'K23', formula: `=IF(AND(J5<3,J5>0),K10-2,IF(J5=0,K10,IF(K10-1<0,0,K10-1)))` },
      { cell: 'K24', formula: `=IF(AND(J5<3,J5>0),K4-(3-J5),IF(J5=0,"-",J5))` },
      { cell: 'J25', formula: `=IF(J5<3,"1 @","-")` },
      { cell: 'K25', formula: `=IF(AND(J5<3,J5>0),3,"-")` }
    ];

    formulas.forEach(({ cell, formula }) => {
      try {
        sheet.getRange(cell).setFormula(formula);
      } catch (e) {
        Logger.log(`Error placing formula in ${cell}: ${e.message}`);
      }
    });

    SpreadsheetApp.flush();
  } catch (error) {
    handleError(error.message, 'placeEventSummaryTable');
  }
}

/**
 * Deletes all sheets except the source sheet
 */
function deleteAllSheetsExceptSource() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = spreadsheet.getSheetByName(CONFIG.sourceSheetName);
    if (!sourceSheet) throw new Error(`Source sheet "${CONFIG.sourceSheetName}" not found!`);

    const sheets = spreadsheet.getSheets();
    if (sheets.length === 1) {
      Logger.log('Only one sheet exists. No sheets deleted.');
      return;
    }

    sheets.forEach(sheet => {
      if (sheet.getName() !== CONFIG.sourceSheetName) {
        spreadsheet.deleteSheet(sheet);
      }
    });

    Logger.log(`All sheets deleted except "${CONFIG.sourceSheetName}"`);
  } catch (error) {
    handleError(error.message, 'deleteAllSheetsExceptSource');
  }
}

/**
 * Marks the current swimmer as scratched
 */
function scrSwimmer() {
  try {
    const sheet = getValidSheet();
    const cell = sheet.getActiveCell();
    if (!cell) throw new Error('No active cell selected.');
    const row = cell.getRow();
    if (row < 1) throw new Error('Invalid row selected.');
    if (row > sheet.getLastRow()) throw new Error('Selected row is beyond the last used row.');

    ensureColumns(sheet, CONFIG.columns.H);
    sheet.getRange(row, 1, 1, CONFIG.columns.H).setBackground(CONFIG.colors.scratch);
    sheet.getRange(row, CONFIG.columns.H).setValue('Scratch');
    SpreadsheetApp.flush();
  } catch (error) {
    handleError(error.message, 'scrSwimmer');
  }
}

/**
 * Marks the current swimmer as Top 8
 */
function Top8() {
  try {
    const sheet = getValidSheet();
    const cell = sheet.getActiveCell();
    if (!cell) throw new Error('No active cell selected.');
    const row = cell.getRow();
    if (row < 1) throw new Error('Invalid row selected.');
    if (row > sheet.getLastRow()) throw new Error('Selected row is beyond the last used row.');

    ensureColumns(sheet, CONFIG.columns.H);
    sheet.getRange(row, 1, 1, CONFIG.columns.H).setBackground(CONFIG.colors.top);
    sheet.getRange(row, CONFIG.columns.H).setValue('Top 8');
    SpreadsheetApp.flush();
  } catch (error) {
    handleError(error.message, 'Top8');
  }
}

/**
 * Marks the current swimmer as Top 16
 */
function Top16() {
  try {
    const sheet = getValidSheet();
    const cell = sheet.getActiveCell();
    if (!cell) throw new Error('No active cell selected.');
    const row = cell.getRow();
    if (row < 1) throw new Error('Invalid row selected.');
    if (row > sheet.getLastRow()) throw new Error('Selected row is beyond the last used row.');

    ensureColumns(sheet, CONFIG.columns.H);
    sheet.getRange(row, 1, 1, CONFIG.columns.H).setBackground(CONFIG.colors.top);
    sheet.getRange(row, CONFIG.columns.H).setValue('Top 16');
    SpreadsheetApp.flush();
  } catch (error) {
    handleError(error.message, 'Top16');
  }
}

/**
 * Unscratches the current swimmer
 */
function UnscratchSwimmer() {
  try {
    const sheet = getValidSheet();
    const cell = sheet.getActiveCell();
    if (!cell) throw new Error('No active cell selected.');
    const row = cell.getRow();
    if (row < 1) throw new Error('Invalid row selected.');
    if (row > sheet.getLastRow()) throw new Error('Selected row is beyond the last used row.');

    ensureColumns(sheet, CONFIG.columns.H);
    sheet.getRange(row, 1, 1, CONFIG.columns.H).setBackground(null);
    sheet.getRange(row, CONFIG.columns.H).setValue('');
    SpreadsheetApp.flush();
  } catch (error) {
    handleError(error.message, 'UnscratchSwimmer');
  }
}
