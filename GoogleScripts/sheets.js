/**
 *  *  * ** Triggers are required/needed for this script to work.
 * Trigger is need to break out mutiple scratches to indivdaul rows. OnFormSubmit
 * 3 html files need to be included in the sheet
 *  1. EventNumberDialog.html
 *  2. ImportDialog.html
 *  3. TimePrompt.html
 * 
 * ALSO need to add service drive app
 * Virtual Clerk of  Course App Scripts (sheets.js)
 * 
 * Version: 22Jul25 - Added rerank swimmers.
 * Version: 23Jul25 - More work on renumber swimmers
 * Version: 25Jul25 - Added back deleted addthirtyminutes function
 * Version: 27Jul25 - Added color code for all execptions
 * Version: 06Aug25 - Added sidebar menu option
 * Version: 15Dec25 - Trying to fix the persistent working message when running scripts
 * Version: 16Dec25 - Add import sheet, get URL for sheet
 * Version: 31Dec25 - Updated sidebar
 * Version: 03Jan26 - splitEventsInColumnsGHIJ Updated
 * 
 * 
 */
const SCRIPT_VERSION = "03Jan26";  // Update this whenever you make changes
const VERSION_DESCRIPTION = "splitEventsInColumnsGHIJ Updated";  // Optional: short note


const COLOR_TIE = "#FF66FF"; // Color for ties
const COLOR_DQ = "Pink";    // Color for DQ
const COLOR_NS = "Green";   // Color for NS
const COLOR_SCR = "Yellow";  // Color for Scr
const COLOR_DFS = "Orange";  // Color for DFS
const COLOR_INTENT = "Cyan"; // Color for Intent to Scr

const SUCESS = "SUCCESS";


/**
 * Trigger on script installation
 * 
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
 * 
 */
function onOpen(e) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (!ui) {
      throw new Error("Unable to access UI.");
    }
    // Add menu to open sidebar
    ui.createMenu('VCoC')
      .addItem('Open VCoC Sidebar', 'showSidebar')
      .addSeparator()
      .addItem('Import Sheet by Name...', 'importSheetByName')
      .addItem('Publish sheet...', 'getViewOnlySheetUrl')
      .addSeparator()
      .addItem('Scr current swimmer', 'scrSwimmer')
      .addItem('Intent to Scratch', 'IntentscrSwimmer')
      .addItem('Unscratch swimmer', 'UnscratchSwimmer')
      .addItem('Rerank swimmers', 'renumberRankings')
      .addSeparator()
      .addItem('Draw heat line', 'drawHeatLine')
      .addItem('Remove all heat lines', 'removeAllBorders')
      .addSeparator()
      .addItem('Mark event Closed', 'MarkEventClosed')
      .addItem('Mark event Revised', 'MarkEventRevised')
      .addSeparator()
      .addItem('Announced time', 'insertTimesImageOverSheet')
      .addSeparator()
      .addSubMenu(
        ui.createMenu('About')
          .addItem('Show Version', 'showVersion')
      )
      .addToUi();
  } catch (error) {
    Logger.log("Error in onOpen: " + error.message);
    SpreadsheetApp.getUi().alert("Error setting up menu: " + error.message);
  }
}
/**
 * Displays the current script version in a dialog
 */
function showVersion() {
  var ui = SpreadsheetApp.getUi();
  var message = `Virtual Clerk of Course (VCoC)\n\nVersion: ${SCRIPT_VERSION}\n${VERSION_DESCRIPTION}\n\n`;

  ui.alert('VCoC Version', message, ui.ButtonSet.OK);
}
function showSidebar() {
  var html = HtmlService.createHtmlOutput(`
    <button onclick="google.script.run.importSheetByName()">Import Sheet by Name...</button><br><br>
    <button onclick="google.script.run.getViewOnlySheetUrl()">Publish sheet...</button><br><br>
    <button onclick="google.script.run.scrSwimmer()">Scratch Current Swimmer</button><br><br>
    <button onclick="google.script.run.IntentscrSwimmer()">Intent to Scratch</button><br><br>
    <button onclick="google.script.run.UnscratchSwimmer()">Unscratch Swimmer</button><br><br>
    <button onclick="google.script.run.renumberRankings()">Rerank Swimmers</button><br><br>
    <button onclick="google.script.run.drawHeatLine()">Draw Heat Line</button><br><br>
    <button onclick="google.script.run.removeAllBorders()">Remove All Heat Lines</button><br><br>
    <button onclick="google.script.run.MarkEventClosed()">Mark Event Closed</button><br><br>
    <button onclick="google.script.run.MarkEventRevised()">Mark Event Revised</button><br><br>
    <button onclick="google.script.run.insertTimesImageOverSheet()">Announced Time</button>
  `)
    .setTitle('VCoC Controls')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}
/**
 * Expands all rows in the active sheet, deletes the first row if data exists,
 * removes empty rows, sets uniform row height, and removes borders.
 * @throws {Error} If critical operations fail
 */
function expandAllRows() {
  const DEFAULT_ROW_HEIGHT = 21;

  try {
    // Get active spreadsheet and sheet with null checks
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error("No active spreadsheet found");

    const sheet = spreadsheet.getActiveSheet();
    if (!sheet) throw new Error("No active sheet found");

    // Get data range and validate
    let lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      Logger.log("Sheet is empty; no action taken");
      return; // Early return for empty sheet
    }

    // Delete first row if data exists
    if (lastRow >= 1) {
      sheet.deleteRow(1);
      lastRow = sheet.getLastRow(); // Update lastRow after deletion
    }

    // Delete empty rows
    if (lastRow > 0) {
      const range = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
      const values = range.getValues();
      let rowsToDelete = [];

      // Identify empty rows (all cells are empty or whitespace-only)
      for (let i = values.length - 1; i >= 0; i--) {
        const isRowEmpty = values[i].every(cell => (cell || '').toString().trim() === '');
        if (isRowEmpty) {
          rowsToDelete.push(i + 1); // Row numbers are 1-based
        }
      }

      // Delete empty rows from bottom to top to avoid index shifting
      rowsToDelete.forEach(rowIndex => {
        sheet.deleteRow(rowIndex);
      });

      Logger.log(`Deleted ${rowsToDelete.length} empty rows`);
    }
    // Set row heights for remaining rows
    const remainingRows = sheet.getLastRow();
    if (remainingRows > 0) {
      sheet.setRowHeightsForced(1, remainingRows, DEFAULT_ROW_HEIGHT);
    } else {
      Logger.log("No rows remain after deletions");
    }

    // Check and call removeAllBorders if defined
    if (typeof removeAllBorders === "function") {
      removeAllBorders(sheet); // Pass sheet for better encapsulation
    } else {
      Logger.log("removeAllBorders function not defined; skipping border removal");
    }

    // Ensure changes are applied
    SpreadsheetApp.flush();
    renumberRankings();
    SpreadsheetApp.flush();

  } catch (error) {
    // Enhanced error handling
    const errorMessage = `Error in expandAllRows: ${error.message}\nStack: ${error.stack}`;
    Logger.log(errorMessage);
    try {
      SpreadsheetApp.getUi().alert("Operation Failed", errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiError) {
      Logger.log(`UI alert failed: ${uiError.message}`);
    }
    throw error; // Re-throw to allow calling function to handle if needed
  }
  return "SUCCESS";
}

/**
 * Scratch the current swimmer
 * 
 */
function scrSwimmer() {
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

    sheet.getRange(row, 1, 1, 2).clearContent();

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    sheet.getRange(row, 1, 1, lastColumn).setBackground(COLOR_SCR);

    if (typeof findLastUsedColumn !== "function") {
      throw new Error("Function findLastUsedColumn is not defined.");
    }
    var lastUsedColumn = findLastUsedColumn();
    if (lastUsedColumn < 1 || lastUsedColumn > lastColumn) {
      throw new Error("Invalid last used column: " + lastUsedColumn);
    }

    sheet.getRange(row, lastUsedColumn).setValue("Scr");

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in scrSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  renumberRankings();
  SpreadsheetApp.flush();
  return SUCESS;
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

    sheet.getRange(row, 1, 1, 2).clearContent();

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    sheet.getRange(row, 1, 1, lastColumn).setBackground(null);

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
  renumberRankings();
  SpreadsheetApp.flush();
  return SUCESS;
}

/**
 * Intent to scratch the current swimmer
 * 
 */
function IntentscrSwimmer() {
  try {
    var ui = SpreadsheetApp.getUi();
    if (!ui) {
      throw new Error("Unable to access UI.");
    }

    var result = ui.prompt(
      'Event Number Entry',
      'Please enter the swimmer\'s last event number:',
      ui.ButtonSet.OK_CANCEL
    );

    var button = result.getSelectedButton();
    var eventNumber = result.getResponseText();

    if (button === ui.Button.OK) {
      if (!eventNumber || isNaN(eventNumber) || eventNumber.trim() === "") {
        throw new Error("Please enter a valid number.");
      }

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

      var lastColumn = sheet.getLastColumn();
      if (lastColumn < 1) {
        throw new Error("Sheet has no columns.");
      }

      sheet.getRange(row, 1, 1, lastColumn).setBackground(COLOR_INTENT);

      if (typeof findLastUsedColumn !== "function") {
        throw new Error("Function findLastUsedColumn is not defined.");
      }
      var lastUsedColumn = findLastUsedColumn();
      if (lastUsedColumn < 1 || lastUsedColumn > lastColumn) {
        throw new Error("Invalid last used column: " + lastUsedColumn);
      }

      sheet.getRange(row, lastUsedColumn)
        .setValue("Intent " + eventNumber)
        .setHorizontalAlignment("left");

      SpreadsheetApp.flush();
    } else if (button === ui.Button.CANCEL) {
      Logger.log("Intent scratch operation cancelled.");
    }
  } catch (error) {
    Logger.log("Error in IntentscrSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCESS;
}

/**
 * Draw heat divider line below the selected swimmer
 * 
 */
function drawHeatLine() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var range = sheet.getActiveRange();
    if (!range) {
      throw new Error("No active range selected.");
    }

    var row = range.getRow();
    if (row < 1) {
      throw new Error("Invalid row selected.");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < row) {
      throw new Error("Selected row is beyond the last used row.");
    }

    var numColumns = sheet.getLastColumn();
    if (numColumns < 1) {
      throw new Error("Sheet has no columns.");
    }

    var rowRange = sheet.getRange(row, 1, 1, numColumns);
    rowRange.setBorder(
      false, false, true, false, false, false,
      "black", SpreadsheetApp.BorderStyle.SOLID
    );

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in drawHeatLine: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCESS;
}

/**
 * Find the last used column in the current row
 * 
 */
function findLastUsedColumn() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error("No active spreadsheet found.");
    }

    var sheet = spreadsheet.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var currentRow = sheet.getActiveCell().getRow();
    if (currentRow < 1) {
      throw new Error("Invalid active row.");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < currentRow) {
      throw new Error("Active row is beyond the last used row.");
    }

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    var rowData = sheet.getRange(currentRow, 1, 1, lastColumn).getValues()[0];
    var lastUsedColumn = 1;
    for (var i = rowData.length - 1; i >= 0; i--) {
      if (rowData[i] !== "" && rowData[i] !== null) {
        lastUsedColumn = i + 1;
        break;
      }
    }

    sheet.setColumnWidth(lastUsedColumn, 33);
    return lastUsedColumn;
  } catch (error) {
    Logger.log("Error in findLastUsedColumn: " + error.message);
    throw error; // Rethrow to be caught by calling function
  }
  return SUCESS;
}

/**
 * Remove all borders from the sheet
 * 
 */
function removeAllBorders() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error("No active spreadsheet found.");
    }

    var sheet = spreadsheet.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      throw new Error("Sheet is empty or has no data rows.");
    }

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    var range = sheet.getRange(1, 1, lastRow, lastColumn);
    range.setBorder(false, false, false, false, false, false);

    SpreadsheetApp.flush(); SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in removeAllBorders: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCESS;
}

/**
 * Helper function to convert column letter to column index
 * 
 */
function columnLetterToIndex(columnLetter) {
  try {
    if (!columnLetter || typeof columnLetter !== "string" || columnLetter.trim() === "") {
      throw new Error("Column letter must be a non-empty string.");
    }
    columnLetter = columnLetter.toUpperCase();
    var index = 0;
    for (var i = 0; i < columnLetter.length; i++) {
      var charCode = columnLetter.charCodeAt(i);
      if (charCode < 65 || charCode > 90) {
        throw new Error("Invalid column letter: " + columnLetter);
      }
      index *= 26;
      index += (charCode - "A".charCodeAt(0) + 1);
    }
    if (index < 1) {
      throw new Error("Calculated column index is invalid: " + index);
    }
    return index;
  } catch (error) {
    Logger.log("Error in columnLetterToIndex: " + error.message);
    throw error; // Rethrow to be caught by calling function
  }
  return SUCESS;
}

/**
 * MarkEventClosed
 * 
 */
function MarkEventClosed() {
  // Define the spreadsheet and sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SpreadsheetApp.getActiveSheet();

  // Define the cell position (e.g., B2 -> column 2, row 2)
  var column = 15;
  var row = 1;


  /**
   * Insert image from Google Drive
   * 
   */
  var fileId = "1YBIydDBt0aB7qOPXx4GGxrHY3DmZHC54"; // Replace with your Google Drive file ID
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    sheet.insertImage(blob, column, row);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error inserting image from Google Drive: " + e.message);
  }
  SpreadsheetApp.flush();
  return SUCESS;
}

/**
 * Mark Event Revised
 * 
 */
function MarkEventRevised() {
  // Define the spreadsheet and sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SpreadsheetApp.getActiveSheet();

  // Define the cell position (e.g., B2 -> column 2, row 2)
  var column = 15;
  var row = 2;


  // Method 2: Insert image from Google Drive (uncomment to use)

  var fileId = "1yYFXZL6fHdxvJS6LrpQ9wiMSooZCrmmY"; // Replace with your Google Drive file ID
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    sheet.insertImage(blob, column, row);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error inserting image from Google Drive: " + e.message);
  }
  SpreadsheetApp.flush();
  return SUCESS;
}

/**
 * Insert the Announcemnt time and clacuate the close time
 * 
 */
function insertTimesImageOverSheet() {
  // Show custom HTML dialog instead of built-in prompt
  const html = HtmlService.createHtmlOutputFromFile('TimePrompt')
    .setWidth(350)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Announced Time');
}


function processAnnouncedTime(time1) {
  var sheet = SpreadsheetApp.getActiveSheet();

  // Target a safe empty cell: Column AK (37), Row 1 (top-right, unlikely to have data)
  var targetCell = sheet.getRange('AK1');  // Change to another empty cell if needed (e.g., 'AL1')

  // Clear any previous content/formula in target cell
  targetCell.clearContent();

  // Remove any old floating images (just in case)
  sheet.getImages().forEach(function (img) { img.remove(); });

  var time2 = addThirtyMinutes(time1);  // Your existing helper function

  try {
    // Temporary data in far-away cells (two columns for clean table layout)
    sheet.getRange('A131:B133').setValues([
      ['Announced:', 'Time'],
      ['Read:', time1],
      ['Closes:', time2]
    ]);

    // Create chart blob (good visible size)
    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.TABLE)
      .addRange(sheet.getRange('A131:B133'))
      .setPosition(5, 5, 0, 0)
      .setOption('width', 240)
      .setOption('height', 120)
      .build();

    sheet.insertChart(chart);
    var imageBlob = chart.getBlob();
    sheet.removeChart(chart);

    // Clear temp data
    sheet.getRange('A131:B133').clearContent();

    // Upload to Drive for direct view URL
    var tempFile = DriveApp.getRootFolder().createFile(imageBlob.setName('announced_time_temp.png'));
    tempFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var imageUrl = 'https://drive.google.com/uc?export=view&id=' + tempFile.getId();

    // CRITICAL: Set fixed cell dimensions BEFORE inserting formula (prevents auto-expansion)
    sheet.setRowHeight(1, 130);      // Fixed height with padding
    sheet.setColumnWidth(37, 260);   // Column AK (37) – wide enough for table

    // Insert in-cell image: Mode 1 = stretch/resize to exactly fit the cell
    targetCell.setFormula('=IMAGE("' + imageUrl + '", 1)');

    // Clean up temporary Drive file after delay
    Utilities.sleep(2000);
    tempFile.setTrashed(true);

  } catch (e) {
    SpreadsheetApp.getUi().alert('Error creating announced time: ' + e.message);
  }

  SpreadsheetApp.flush();
  return "SUCCESS";
}


function addThirtyMinutes(timeStr) {
  // Parse the input time string
  var parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!parts) return "Invalid time format";

  var hours = parseInt(parts[1]);
  var minutes = parseInt(parts[2]);
  var period = parts[3].toUpperCase();

  // Add 30 minutes
  minutes += 30;

  // Handle minute overflow
  if (minutes >= 60) {
    minutes -= 60;
    hours += 1;
  }

  // Handle hour overflow and AM/PM switch
  if (hours >= 12) {
    if (hours > 12) hours -= 12;
    period = (period === "AM") ? "PM" : "AM";
  }

  // Format the time string
  return hours + ":" + (minutes < 10 ? "0" + minutes : minutes) + " " + period;
}

/**
 * Renumber the swimmer with lots of conditions
 *
 */
function renumberRankings() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  var sheetName = sheet.getName();

  // Process only if the active sheet is named "Event X"
  if (!sheetName.match(/^Event \d+$/)) {
    SpreadsheetApp.getUi().alert("Active sheet is not an 'Event' sheet! Please select a sheet named 'Event X'.");
    return;
  }

  var data = sheet.getDataRange().getValues();
  var prelimRow = -1;

  // Find the first "Preliminaries" row
  for (var row = 0; row < data.length; row++) {
    if (data[row][0] === "Preliminaries") {
      prelimRow = row;
      break;
    }
  }

  if (prelimRow === -1) {
    SpreadsheetApp.getUi().alert("No 'Preliminaries' row found in the active sheet!");
    return;
  }

  var rankColumn = 0; // Column B (0-based index)
  var timeColumn1 = 25; // Prelim Time (0-based index)
  var timeColumn2 = 40; // Alternate Prelim Time
  var scrColumn1 = 33; // Scr column
  var scrColumn2 = 47; // Alternate Scr column
  var timeColumn, scrColumn;
  var lastColumn = sheet.getLastColumn();

  // Initialize variables
  var currentRank = 1;
  var lastTime = null;
  var tiedRows = [];

  // Function to find the time column with a period
  function findTimeColumnWithPeriod(activeRow, lastColumn) {
    var rowValues = sheet.getRange(activeRow, 1, 1, lastColumn).getValues()[0];
    for (var col = lastColumn - 1; col >= 0; col--) {
      var value = rowValues[col];
      if (value && value.toString().includes('.')) {
        timeColumn = col;
        switch (col) {
          case 40:
            scrColumn = 47;
            break;
          case 25:
            scrColumn = 33;
            break;
          case 35:
            scrColumn = 43;
            break;
          default:
            scrColumn = null; // Handle unexpected columns
        }
        return true;
      }
    }
    return false;
  }

  // Process rows starting from the row after the first "Preliminaries"
  for (var row = prelimRow + 1; row < data.length; row++) {
    // Check for another "Preliminaries" row
    if (data[row][0] === "Preliminaries") {
      // Process any pending tied rows
      if (tiedRows.length > 1) {
        for (var tiedRow of tiedRows) {
          sheet.getRange(tiedRow + 1, rankColumn + 1).setValue("*" + currentRank);
          sheet.getRange(tiedRow + 1, 1, 1, lastColumn).setBackground(COLOR_TIE);
        }
        currentRank += tiedRows.length;
      } else if (tiedRows.length === 1) {
        sheet.getRange(tiedRows[0] + 1, rankColumn + 1).setValue(currentRank);
        sheet.getRange(tiedRows[0] + 1, 1, 1, lastColumn).setBackground(null);
        currentRank += 1;
      }
      // Reset rank and tied rows for new section
      currentRank = 1;
      lastTime = null;
      tiedRows = [];
      // Find new time and scr columns for this section
      if (!findTimeColumnWithPeriod(row + 2, lastColumn)) {
        SpreadsheetApp.getUi().alert("No valid time column found after 'Preliminaries' at row " + (row + 1));
        return;
      }
      continue;
    }

    // Find time and scr columns for the first section
    if (row === prelimRow + 1) {
      if (!findTimeColumnWithPeriod(row + 1, lastColumn)) {
        SpreadsheetApp.getUi().alert("No valid time column found after 'Preliminaries' at row " + (prelimRow + 1));
        return;
      }
    }

    var timeCell = data[row][timeColumn];
    var scrCell = data[row][scrColumn];
    var rankCell = data[row][rankColumn];

    // Skip rows with no time or marked as Scr, DFS, DQ, NS
    if (!timeCell || timeCell === "" || scrCell === "Scr" || timeCell === "DFS" || timeCell === "DQ" || timeCell === "NS" || timeCell === "DNF") {
      // Clear rank if it exists
      if (rankCell !== "") {
        sheet.getRange(row + 1, rankColumn + 1).setValue("");
      }
      // Set background colors for DFS, DQ, DNF, NS, Scr
      var normalizedTimeCell = timeCell ? timeCell.toString().trim().toUpperCase() : "";
      var normalizedScrCell = scrCell ? scrCell.toString().trim().toUpperCase() : "";
      if (normalizedTimeCell === "DFS") {
        sheet.getRange(row + 1, 1, 1, lastColumn).setBackground(COLOR_DFS);
      } else if (normalizedTimeCell === "DQ") {
        sheet.getRange(row + 1, 1, 1, lastColumn).setBackground(COLOR_DQ);
      } else if (normalizedTimeCell === "DNF") {
        sheet.getRange(row + 1, 1, 1, lastColumn).setBackground(COLOR_DQ);
      } else if (normalizedTimeCell === "NS") {
        sheet.getRange(row + 1, 1, 1, lastColumn).setBackground(COLOR_NS);
      } else if (normalizedScrCell === "SCR") {
        sheet.getRange(row + 1, 1, 1, lastColumn).setBackground(COLOR_SCR);
      }
      continue;
    }



    // Check for tie (same time as previous valid row)
    if (lastTime !== null && timeCell === lastTime) {
      tiedRows.push(row); // Add to tied group
    } else {
      // Process previous tied group, if any
      if (tiedRows.length > 1) {
        // Assign asterisk and current rank to all tied rows, highlight in yellow
        for (var tiedRow of tiedRows) {
          sheet.getRange(tiedRow + 1, rankColumn + 1).setValue("*" + currentRank);
          sheet.getRange(tiedRow + 1, 1, 1, lastColumn).setBackground(COLOR_TIE);
        }
        currentRank += tiedRows.length; // Increment rank by number of tied rows
      } else if (tiedRows.length === 1) {
        // Single row (no tie), assign rank without asterisk
        sheet.getRange(tiedRows[0] + 1, rankColumn + 1).setValue(currentRank);
        sheet.getRange(tiedRows[0] + 1, 1, 1, lastColumn).setBackground(null); // Clear highlighting
        currentRank += 1;
      }
      tiedRows = [row]; // Start new group with current row
    }

    lastTime = timeCell; // Update lastTime for next iteration
  }

  // Process any remaining tied rows
  if (tiedRows.length > 1) {
    for (var tiedRow of tiedRows) {
      sheet.getRange(tiedRow + 1, rankColumn + 1).setValue("*" + currentRank);
      sheet.getRange(tiedRow + 1, 1, 1, lastColumn).setBackground(COLOR_TIE);
    }
  } else if (tiedRows.length === 1) {
    sheet.getRange(tiedRows[0] + 1, rankColumn + 1).setValue(currentRank);
    sheet.getRange(tiedRows[0] + 1, 1, 1, lastColumn).setBackground(null);
  }
  SpreadsheetApp.flush();
  return SUCESS;
}

/**
 * Helper function
 */
/**
 * Helper: Find the time column containing a decimal point and set corresponding scr column
 */
// function findTimeColumnWithPeriod(sheet, activeRow, lastColumn) {
// var rowValues = sheet.getRange(activeRow, 1, 1, lastColumn).getValues()[0];
// for (var col = lastColumn - 1; col >= 0; col--) {
// var value = rowValues[col];
// if (value && typeof value === 'string' && value.includes('.')) {
// // Or better: if it's a time like 1:23.45 or 23.45
// var str = value.toString().trim();
// if (str.match(/\d+\.\d+/)) {  // contains decimal
// var timeCol = col;
// var scrCol;
// switch (col) {
// case 40: scrCol = 47; break;
// case 25: scrCol = 33; break;
// case 35: scrCol = 43; break;
// default: scrCol = null;
// }
// return { timeColumn: timeCol, scrColumn: scrCol };
// }
// }
// }
// return null;
// }

/**
 * FUnction to copy results into this sheet.
 */
/**
 * Menu item: Prompt user for a file name in the same folder,
 * auto-convert Excel if needed, then copy all tabs.
 * Fixed: Eliminates hanging "Working..." message
 */
/**
 * Menu item: Open HTML dialog for file name input, then import sheets
 */
function importSheetByName() {
  const html = HtmlService.createHtmlOutputFromFile('ImportDialog')
    .setWidth(400)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Sheet by Name');
}

/**
 * Called from HTML dialog - performs the actual import ONLY
 * After success, client-side code will handle the event number prompt
 */
/**
 * Performs the import and returns the name of the last imported sheet
 */
function processImport(fileNameToImport) {
  try {
    if (!fileNameToImport || fileNameToImport.trim() === '') {
      return { success: false, message: 'No file name provided.' };
    }

    fileNameToImport = fileNameToImport.trim();

    const currentSs = SpreadsheetApp.getActiveSpreadsheet();
    const currentFile = DriveApp.getFileById(currentSs.getId());
    const parentFolder = currentFile.getParents().next();

    const files = parentFolder.getFilesByName(fileNameToImport);
    let sourceFile = null;
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName() === fileNameToImport) {
        sourceFile = file;
        break;
      }
    }

    if (!sourceFile) {
      return { success: false, message: `No file named "${fileNameToImport}" found in the same folder.` };
    }

    const isExcel = [MimeType.MICROSOFT_EXCEL, MimeType.MICROSOFT_EXCEL_LEGACY].includes(sourceFile.getMimeType());

    let sourceSs;
    let tempFileId = null;
    if (!isExcel) {
      sourceSs = SpreadsheetApp.openById(sourceFile.getId());
    } else {
      const resource = {
        name: 'Temp_Import_' + sourceFile.getName().replace(/\.[^/.]+$/, ""),
        mimeType: MimeType.GOOGLE_SHEETS,
        parents: [{ id: parentFolder.getId() }]
      };
      const convertedFile = Drive.Files.create(resource, sourceFile.getBlob(), { convert: true });
      tempFileId = convertedFile.id;
      sourceSs = SpreadsheetApp.openById(tempFileId);
    }

    const sourceSheets = sourceSs.getSheets();
    if (sourceSheets.length === 0) {
      return { success: false, message: 'The file has no tabs to import.' };
    }

    let importedCount = 0;
    let lastCopiedSheet = null;

    sourceSheets.forEach(sheet => {
      lastCopiedSheet = sheet.copyTo(currentSs);  // This is the copied sheet in destination
      importedCount++;
    });

    // Cleanup temp file
    if (tempFileId) {
      try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (e) { }
    }

    SpreadsheetApp.flush();

    // Return the name of the newly copied sheet (usually the only/main one)
    const lastSheetName = lastCopiedSheet ? lastCopiedSheet.getName() : null;
    showEventNumberPrompt(lastSheetName);

    return {
      success: true,
      message: `Imported ${importedCount} sheet(s) successfully!`,
      lastSheetName: lastSheetName
    };

  } catch (error) {
    Logger.log('Import Error: ' + error.message + '\n' + error.stack);
    return { success: false, message: 'Import failed: ' + error.message };
  }
}

/**
 * Shows the Event Number dialog and passes the sheet name safely
 */
function showEventNumberPrompt(lastSheetName) {
  const template = HtmlService.createTemplateFromFile('EventNumberDialog');
  template.sheetName = lastSheetName || '';
  const html = template.evaluate()
    .setWidth(360)
    .setHeight(220);
  SpreadsheetApp.getUi().showModalDialog(html, 'Set Event Number');
}

/**
 * Renames a specific sheet to "Event xx"
 */
// Already in your processImport() — just ensure it returns lastSheetName as shown earlier
// (see previous response for full processImport code)

// New function needed:
function renameSheetToEvent(sheetName, eventNum) {
  Logger.log('renameSheetToEvent has been called: ' + sheetName);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Imported sheet "' + sheetName + '" not found.');
    }
    const newName = 'Event ' + eventNum;
    sheet.setName(newName);
    ss.setActiveSheet(sheet);

    expandAllRows();  // Clean up the newly renamed sheet

    return SUCESS;  // Consistent with other functions in your script
  } catch (error) {
    Logger.log('Rename error: ' + error);
    throw error;  // Will trigger failure handler in client
  }
}

/**
 * Shows a dialog with the view-only URL for the active sheet and a Copy button
 */
function getViewOnlySheetUrl() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    const sheetName = sheet.getName();
    const sheetId = sheet.getSheetId();
    const editUrl = ss.getUrl();

    // View-only URL with direct tab link
    const viewOnlyUrl = editUrl.replace(/\/edit.*$/, '/preview') + `#gid=${sheetId}`;

    // Create HTML dialog with copy button
    const html = HtmlService.createHtmlOutput(`
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
        <h3 style="margin-top: 0;">View-Only Link for: ${sheetName}</h3>
        <p>This link opens the spreadsheet in <strong>view-only mode</strong> and jumps directly to this sheet.</p>
        
        <textarea id="urlText" readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 12px; padding: 10px; box-sizing: border-box; margin-bottom: 15px;">
${viewOnlyUrl}
        </textarea>
        
        <button onclick="copyToClipboard()" style="background: #1a73e8; color: white; border: none; padding: 10px 20px; font-size: 14px; cursor: pointer; border-radius: 4px;">
          Copy to Clipboard
        </button>
        <span id="copyStatus" style="margin-left: 10px; color: green; font-weight: bold;"></span>
        
        <script>
          function copyToClipboard() {
            const textarea = document.getElementById('urlText');
            textarea.select();
            document.execCommand('copy');
            
            document.getElementById('copyStatus').textContent = 'Copied!';
            setTimeout(() => {
              document.getElementById('copyStatus').textContent = '';
            }, 2000);
          }
          
          // Auto-select text when dialog opens
          window.onload = function() {
            document.getElementById('urlText').select();
          };
        </script>
      </div>
    `)
      .setWidth(560)
      .setHeight(380);

    SpreadsheetApp.getUi().showModalDialog(html, 'View-Only Sheet URL - Click to Copy');

    // Also log it
    Logger.log("View-Only Sheet URL: " + viewOnlyUrl);

  } catch (error) {
    Logger.log("Error in getViewOnlySheetUrl: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
}


/**
 * These function will split out multiple scratch into indivdaul scratches
 * 
 * *** Requires a Trigger ***
 * 
 */
/**
 * SAFE TEST FUNCTION – run this anytime from the editor
 */
function TEST_SPLIT_NOW() {
  console.log("Manual test started...");
  Utilities.sleep(1000);                    // tiny pause just in case
  splitEventsInColumnsGHIJ();
}

/**
 * REAL FORM SUBMIT TRIGGER – fires automatically on every form response
 */
function onFormSubmit(e) {
  Utilities.sleep(2000);                    // give form time to finish writing
  console.log("Form submitted – processing splits...");
  splitEventsInColumnsGHIJ();
  SpreadsheetApp.flush();
  return SUCESS;
}

/**
 * MAIN SPLIT FUNCTION – now completely bulletproof
 */
// function splitEventsInColumnsGHIJ() {
//   const sheet = SpreadsheetApp.getActiveSheet();
//   const DATA_START_ROW = 2;
//   const COLUMNS_TO_CHECK = [7, 8, 9, 10];    // G=7, H=8, I=9, J=10

//   // 1. Get current data (including header)
//   const lastRow = sheet.getLastRow();
//   if (lastRow < DATA_START_ROW) {
//     console.log("No data yet");
//     return;
//   }

//   const fullRange = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
//   const values = fullRange.getValues();     // 2D array with header in row 0
//   const header = values[0];                  // keep real header untouched
//   const dataRows = values.slice(1);          // everything below header

//   const newDataRows = [];                    // will hold processed rows only

//   // 2. Process each data row
//   for (let row of dataRows) {
//     const splits = [];

//     // Check G, H, I, J for commas
//     COLUMNS_TO_CHECK.forEach(col1 => {
//       const col0 = col1 - 1;
//       const cell = row[col0];
//       if (typeof cell === 'string' && cell.includes(',')) {
//         const parts = cell.split(',').map(s => s.trim()).filter(s => s !== '');
//         if (parts.length > 1) {
//           splits.push({ col: col0, parts: parts });
//         }
//       }
//     });

//     if (splits.length === 0) {
//       newDataRows.push(row);
//       continue;
//     }

//     // Split this row
//     const maxSplits = Math.max(...splits.map(s => s.parts.length));
//     for (let i = 0; i < maxSplits; i++) {
//       const newRow = row.slice();
//       splits.forEach(item => {
//         newRow[item.col] = i < item.parts.length
//           ? item.parts[i]
//           : item.parts[item.parts.length - 1];   // repeat last value
//         // or use '' for blank after last item
//       });
//       newDataRows.push(newRow);
//     }
//   }

//   // 3. Write back safely – NEVER touches row 1 (the real header)
//   if (newDataRows.length > 0) {
//     // Clear only the data area (row 2 and below)
//     if (lastRow >= 2) {
//       const clearRange = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn());
//       clearRange.clearContent();               // ← correct method name
//     }

//     // Write new data starting at row 2
//     const target = sheet.getRange(2, 1, newDataRows.length, newDataRows[0].length);
//     target.setValues(newDataRows);
//   }

//   console.log(`Success! Sheet now has ${1 + newDataRows.length} rows (including header)`);

//   SpreadsheetApp.flush();
//   return SUCESS;
// }
/**
 * MAIN SPLIT FUNCTION – now completely bulletproof
 */
function splitEventsInColumnsGHIJ() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(30000)) {  // Wait up to 30 seconds for lock
    try {
      const sheet = SpreadsheetApp.getActiveSheet();
      const DATA_START_ROW = 2;
      const COLUMNS_TO_CHECK = [7, 8, 9, 10];    // G=7, H=8, I=9, J=10

      // 1. Get current data (including header)
      let lastRow = sheet.getLastRow();
      if (lastRow < DATA_START_ROW) {
        console.log("No data yet");
        return;
      }

      const fullRange = sheet.getRange(1, 1, lastRow, sheet.getLastColumn());
      const values = fullRange.getValues();     // 2D array with header in row 0
      const header = values[0];                  // keep real header untouched
      const dataRows = values.slice(1);          // everything below header

      const newDataRows = [];                    // will hold processed rows only

      // 2. Process each data row
      for (let row of dataRows) {
        const splits = [];

        // Check G, H, I, J for commas
        COLUMNS_TO_CHECK.forEach(col1 => {
          const col0 = col1 - 1;
          const cell = row[col0];
          if (typeof cell === 'string' && cell.includes(',')) {
            const parts = cell.split(',').map(s => s.trim()).filter(s => s !== '');
            if (parts.length > 1) {
              splits.push({ col: col0, parts: parts });
            }
          }
        });

        if (splits.length === 0) {
          newDataRows.push(row);
          continue;
        }

        // Split this row
        const maxSplits = Math.max(...splits.map(s => s.parts.length));
        for (let i = 0; i < maxSplits; i++) {
          const newRow = row.slice();
          splits.forEach(item => {
            newRow[item.col] = i < item.parts.length
              ? item.parts[i]
              : item.parts[item.parts.length - 1];   // repeat last value
            // or use '' for blank after last item
          });
          newDataRows.push(newRow);
        }
      }

      // Calculate rows needed
      const rowsNeeded = newDataRows.length;
      const oldDataRows = lastRow - 1;
      if (rowsNeeded > oldDataRows) {
        const extraRows = rowsNeeded - oldDataRows;
        sheet.insertRowsAfter(lastRow, extraRows);
        lastRow += extraRows;  // Update lastRow after insertion
      }

      // 3. Write back safely – NEVER touches row 1 (the real header)
      if (newDataRows.length > 0) {
        // Clear only the data area (row 2 to current max needed)
        const clearRange = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn());
        clearRange.clearContent();               // ← correct method name

        // Write new data starting at row 2
        const target = sheet.getRange(2, 1, newDataRows.length, newDataRows[0].length);
        target.setValues(newDataRows);
      }

      console.log(`Success! Sheet now has ${1 + newDataRows.length} rows (including header)`);

      SpreadsheetApp.flush();
      return 'SUCCESS';
    } finally {
      lock.releaseLock();
    }
  } else {
    console.log("Could not acquire lock. Try again later.");
  }
}