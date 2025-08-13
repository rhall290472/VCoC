/**
 * Virtual Clerk of Course App Scripts - Richard Hall
 * Version: 02Aug25 - Optimized
 * Version: 08Aug25 - Circlle seeding fix
 * Version: 13Aug25 - Add function updateAllEventSummaryTables
 */

/**
 * Configuration object for the Virtual Clerk of Course application
 * @const {Object} CONFIG
 * @property {string} sourceSheetName - Name of the source sheet
 * @property {Object} colors - Color configurations for formatting
 * @property {string} colors.scratch - Color for scratched swimmers
 * @property {string} colors.top - Color for top-ranked swimmers
 * @property {string} colors.white - Default white color
 * @property {string} colors.circle - Color for circle seed rows
 * @property {number} rowHeight - Standard row height in pixels
 * @property {Object} columnWidths - Widths for specific columns
 * @property {Object} columns - Column indices for specific operations
 * @property {Object} table - Table configuration
 * @property {number} table.startRow - Starting row for summary tables
 * @property {number} table.circleRow - Row for circle seed table
 * @property {number} table.tfRow - Row for timed finals table
 * @property {number} table.startColumn - Starting column for tables
 * @property {number} table.numColumns - Number of columns in tables
 * @property {number} table.minSwimmersPerHeat - Minimum swimmers per heat
 */
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
 * Logs and displays an error message to the user
 * @param {string} message - The error message to display
 * @param {string} [context='Unknown'] - The function or context where the error occurred
 */
function handleError(message, context = 'Unknown') {
  Logger.log(`[${context}] Error: ${message}`);
  SpreadsheetApp.getUi().alert(`[${context}] Error: ${message}`);
}

/**
 * Retrieves and validates a spreadsheet sheet by name or active sheet
 * @param {string} [sheetName=null] - Name of the sheet to retrieve, or null for active sheet
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The validated sheet object
 * @throws {Error} If the specified or active sheet is not found
 */
function getValidSheet(sheetName = null) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = sheetName ? spreadsheet.getSheetByName(sheetName) : spreadsheet.getActiveSheet();
  if (!sheet) throw new Error(`Sheet "${sheetName || 'active'}" not found.`);
  return sheet;
}

/**
 * Ensures the sheet has at least the specified number of columns
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to check and modify
 * @param {number} requiredColumns - The minimum number of columns required
 */
function ensureColumns(sheet, requiredColumns) {
  const maxColumns = sheet.getMaxColumns();
  if (maxColumns < requiredColumns) {
    sheet.insertColumnsAfter(maxColumns, requiredColumns - maxColumns);
  }
}

/**
 * Executes on script installation, setting up the custom menu
 * @param {Object} e - The installation event object
 */
function onInstall(e) {
  try {
    onOpen(e);
  } catch (error) {
    handleError(error.message, 'onInstall');
  }
}

/**
 * Creates a custom menu in the spreadsheet UI when the spreadsheet is opened
 * @param {Object} e - The open event object
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
 * Processes event data from the source sheet and creates separate sheets for each event with summary tables
 */
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

/**
 * Prompts the user to input the number of lanes and validates the input
 * @returns {number} The validated number of lanes
 * @throws {Error} If the user cancels or provides invalid input
 */
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

/**
 * Parses event data from the source sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sourceSheet - The source sheet containing event data
 * @returns {Array<Object>} Array of event objects with name and data
 * @throws {Error} If no data is found in the source sheet
 */
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

/**
 * Processes an individual event, creating and formatting a new sheet
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet - The active spreadsheet
 * @param {Object} event - Event object with name and data
 * @param {number} numLanes - Number of lanes for the event
 */
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

/**
 * Formats the columns of a sheet based on configuration
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to format
 * @param {number} maxColumns - The maximum number of columns to format
 */
function formatSheet(sheet, maxColumns) {
  sheet.autoResizeColumns(1, maxColumns);
  sheet.setColumnWidth(1, CONFIG.columnWidths.A);
  if (maxColumns >= CONFIG.columns.F) sheet.setColumnWidth(CONFIG.columns.F, CONFIG.columnWidths.F);
  if (maxColumns >= CONFIG.columns.G) sheet.setColumnWidth(CONFIG.columns.G, CONFIG.columnWidths.G);
  if (maxColumns >= CONFIG.columns.H) sheet.setColumnWidth(CONFIG.columns.H, CONFIG.columnWidths.H);
}

/**
 * Protects a specific range (J4:K25) in the sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to apply protection to
 * @param {string} sheetName - The name of the sheet for the protection description
 */
function protectRange(sheet, sheetName) {
  const range = sheet.getRange('J4:K25');
  const protection = range.protect().setDescription(`Protected Range J4:K25 on ${sheetName}`);
  protection.removeEditors(protection.getEditors());
  protection.setWarningOnly(false);
}

/**
 * Applies conditional formatting to the sheet based on cell K10 value
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to format
 */
function applyConditionalFormatting(sheet) {
  sheet.getRange('J5').setFontColor(CONFIG.colors.white);
  const k10Value = sheet.getRange('K10').getValue();
  if (k10Value <= 3) {
    sheet.getRange('J10:K13').setFontColor(CONFIG.colors.white);
    sheet.getRange('J15:K19').setBackground(CONFIG.colors.circle);
  } else {
    sheet.getRange('J15:K19').setFontColor(CONFIG.colors.white);
  }
}

/**
 * Places and formats the event summary table on the specified sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The target sheet
 * @param {number} numLanes - Number of lanes provided by the user
 * @throws {Error} If the sheet is invalid or other errors occur
 */
function placeEventSummaryTable(sheet, numLanes) {
  try {
    if (!sheet || typeof sheet.getRange !== 'function') {
      throw new Error('Invalid sheet object.');
    }

    // Validate configuration
    if (!Number.isFinite(numLanes) || numLanes <= 0 || numLanes > 16) {
      throw new Error(`Invalid numLanes: ${numLanes}. Must be between 1 and 16.`);
    }

    // Cache range values
    const numLanesValue = Number(sheet.getRange('K4').getValue()) || numLanes;
    const entered = sheet.getRange('B3:B1000').getValues().filter(cell => cell[0]).length;
    const scratches = sheet.getRange('H3:H1000').getValues().filter(cell => cell[0]).length;
    const seededSwimmers = Math.max(0, entered - scratches);

    // Log invalid values
    if (!Number.isFinite(numLanesValue) || numLanesValue <= 0) {
      Logger.log(`Invalid number of lanes in K4: ${numLanesValue}. Using default: ${numLanes}.`);
    }
    if (!Number.isFinite(seededSwimmers) || seededSwimmers < 0) {
      Logger.log(`Invalid number of seeded swimmers: ${seededSwimmers}. Using 0.`);
    }

    // Define table configurations
    const tables = {
      main: {
        data: [
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
        ],
        border: { startRow: CONFIG.table.startRow, numRows: 5 }
      },
      circleSeed: {
        data: [
          ['Circle Seed', ''],
          ['HEATS', ''],
          ['Heat 1', ''],
          ['Heat 2', ''],
          ['Heat 3', ''],
          ['', '']
        ],
        border: { startRow: CONFIG.table.circleRow, numRows: 5 }
      },
      timedFinals: {
        data: [
          ['Timed Final', ''],
          ['HEATS', '=K10'],
          ['FULL', `=IF(K10=0,0,IF(J5<${CONFIG.table.minSwimmersPerHeat},J5>0,K10-1,K10))`],
          ['1@', `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),0,J5)`],
          ['Partial', '']
        ],
        border: { startRow: CONFIG.table.tfRow, numRows: 5 }
      }
    };

    // Additional formulas to set separately
    const additionalFormulas = [
      { cell: 'K12', formula: `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),K4-(3-J5),IF(J5=0,"-",J5))` },
      { cell: 'J13', formula: `=IF(J5<${CONFIG.table.minSwimmersPerHeat},"1 @","-")` },
      { cell: 'K13', formula: `=IF(AND(J5<${CONFIG.table.minSwimmersPerHeat},J5>0),3,"-")` },
      { cell: 'K16', formula: `=IF(AND(K8<K4*3,K8>K4*2),3,ROUNDUP(K8/K4,0))`},
      { cell: 'K17', formula: `=ROUNDUP(K8/K16,0)`},
      { cell: 'K18', formula: `=IF(K16=1,0,ROUND((K8-L36-0.5)/(K16),0))`},
      { cell: 'K19', formula: `=ROUNDDOWN((K8-K17-K18),0)`},
      { cell: 'K22', formula: '=(IF(K8/K4<1,0,ROUNDUP(K8/K4,0)))' },
      { cell: 'K23', formula: `=IF(AND(J5<3,J5>0),K10-2,IF(J5=0,K10,IF(K10-1<0,0,K10-1)))` },
      { cell: 'K24', formula: `=IF(AND(J5<3,J5>0),K4-(3-J5),IF(J5=0,"-",J5))` },
      { cell: 'J25', formula: `=IF(J5<3,"1 @","-")` },
      { cell: 'K25', formula: `=IF(AND(J5<3,J5>0),3,"-")` }
    ];

    // Calculate total rows and ensure sufficient columns/rows
    const tablesToWrite = [tables.main.data, tables.circleSeed.data, tables.timedFinals.data];
    const numRows = tablesToWrite.reduce((sum, table) => sum + table.length, 0);
    const numColumns = CONFIG.table.numColumns;

    ensureColumns(sheet, Math.max(CONFIG.columns.F, CONFIG.table.startColumn + numColumns));
    if (CONFIG.table.startRow + numRows > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), (CONFIG.table.startRow + numRows - 1) - sheet.getMaxRows());
    }

    // Write table data
    let currentRow = CONFIG.table.startRow;
    tablesToWrite.forEach(table => {
      if (table.length > 0) {
        sheet.getRange(currentRow, CONFIG.table.startColumn, table.length, numColumns).setValues(table);
        currentRow += table.length;
      }
    });

    // Set row heights and column widths
    sheet.autoResizeColumns(CONFIG.table.startColumn, numColumns);
    sheet.setRowHeights(CONFIG.table.startRow, numRows, CONFIG.rowHeight);
    const columnWidths = [
      { column: 1, width: CONFIG.columnWidths.A },
      { column: CONFIG.columns.F, width: CONFIG.columnWidths.F, condition: sheet.getMaxColumns() >= CONFIG.columns.F },
      { column: CONFIG.table.startColumn, width: CONFIG.columnWidths.J },
      { column: CONFIG.table.startColumn + 1, width: CONFIG.columnWidths.K }
    ];
    columnWidths.forEach(({ column, width, condition = true }) => {
      if (condition) sheet.setColumnWidth(column, width);
    });
    

    // Apply bold formatting
    const boldRows = [CONFIG.table.startRow, CONFIG.table.startRow + 6, CONFIG.table.startRow + 11, CONFIG.table.startRow + 17];
    boldRows.forEach(row => {
      if (row <= CONFIG.table.startRow + numRows - 1) {
        sheet.getRange(row, CONFIG.table.startColumn, 1, numColumns).setFontWeight('bold');
      }
    });

    // Apply borders
    const borderRanges = [
      tables.main.border,
      { startRow: CONFIG.table.startRow + 6, numRows: 4 },
      tables.circleSeed.border,
      tables.timedFinals.border
    ];
    borderRanges.forEach(range => {
      sheet.getRange(range.startRow, CONFIG.table.startColumn, range.numRows, numColumns)
        .setBorder(true, true, true, true, true, true, 'black', SpreadsheetApp.BorderStyle.SOLID);
    });

    // Set additional formulas
    additionalFormulas.forEach(({ cell, formula }) => {
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
 * Deletes all sheets in the spreadsheet except the source sheet
 * @throws {Error} If the source sheet is not found
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
 * Updates summary tables for all sheets except Sheet1
 */
function updateAllEventSummaryTables() {
  try {
    const start = new Date().getTime();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    const numLanes = getNumLanesFromUser();
    const properties = PropertiesService.getScriptProperties();
    const batchSize = 5;

    let startIndex = parseInt(properties.getProperty('summaryTableIndex') || '0');
    const eligibleSheets = sheets.filter(sheet => sheet.getName() !== CONFIG.sourceSheetName);

    if (eligibleSheets.length === 0) {
      throw new Error('No sheets found to update (excluding Sheet1).');
    }
    if (eligibleSheets.length > 200) {
      throw new Error(`Too many sheets (${eligibleSheets.length}). Google Sheets supports up to 200 tabs.`);
    }

    for (let i = startIndex; i < eligibleSheets.length; i++) {
      if (new Date().getTime() - start > 300000) {
        properties.setProperty('summaryTableIndex', i.toString());
        ScriptApp.newTrigger('updateAllEventSummaryTables')
          .timeBased()
          .after(1000)
          .create();
        Logger.log(`Paused at sheet ${i} (${eligibleSheets[i].getName()}). Scheduling next batch.`);
        return;
      }
      Logger.log(`Updating summary table for sheet: ${eligibleSheets[i].getName()}`);
      placeEventSummaryTable(eligibleSheets[i], numLanes);
    }

    properties.deleteProperty('summaryTableIndex');
    Logger.log(`updateAllEventSummaryTables completed in ${(new Date().getTime() - start) / 1000} seconds`);
  } catch (error) {
    handleError(error.message, 'updateAllEventSummaryTables');
  }
}


/**
 * Marks the currently selected swimmer as scratched
 * @throws {Error} If no active cell is selected or the row is invalid
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
 * Marks the currently selected swimmer as Top 8
 * @throws {Error} If no active cell is selected or the row is invalid
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
 * Marks the currently selected swimmer as Top 16
 * @throws {Error} If no active cell is selected or the row is invalid
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
 * Removes the scratch status from the currently selected swimmer
 * @throws {Error} If no active cell is selected or the row is invalid
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