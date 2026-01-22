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
 * Version: 06Jan26 - Added Protected Heat
 * Version: 07Jan26 - Draw heat line THICK
 * Version: 18Jan26 - extractEventNumberFromFilename
 * Version: 21Jan26 - Include all .html file to make this a single standalone app
 * 
 * 
 */
const SCRIPT_VERSION = "21Jan26";  // Update this whenever you make changes
const VERSION_DESCRIPTION = "Include all .html file to make this a single standalone app";  // Optional: short note


const COLOR_TIE = "#FF66FF"; // Color for ties
const COLOR_DQ = "Pink";    // Color for DQ
const COLOR_NS = "#90ee90";   // Color for NS
const COLOR_SCR = "Yellow";  // Color for Scr
const COLOR_DFS = "Orange";  // Color for DFS
const COLOR_INTENT = "Cyan"; // Color for Intent to Scr
const COLOR_PROT = "#adff2f";  // Green for protected - adjust to your preference

const SUCCESS = "SUCCESS";


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
      .addItem('Import Event by Name...', 'importSheetByName')
      .addItem('Publish Event...', 'getViewOnlySheetUrl')
      .addSeparator()
      .addItem('Scr current swimmer', 'scrSwimmer')
      .addItem('Intent to Scratch', 'IntentscrSwimmer')
      .addItem('Unscratch swimmer', 'UnscratchSwimmer')
      .addItem('Rerank swimmers', 'renumberRankings')
      .addItem('Protected 16&U', 'protSwimmer')
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
  var message = `Virtual Clerk of Course (VCoC)-sheets.js\n\nVersion: ${SCRIPT_VERSION}\n${VERSION_DESCRIPTION}\n\n`;

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
    <button onclick="google.script.run.protSwimmer()">Protected 16&U</button><br><br>
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

  console.log("expandAllRows");
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
  markSwimmer("scratch");
}

function protSwimmer() {
  markSwimmer("protected");
}

function markSwimmer(mode) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) throw new Error("No active sheet found.");

    var cell = sheet.getActiveCell();
    if (!cell) throw new Error("No active cell selected.");

    var row = cell.getRow();
    if (row < 2) throw new Error("Select a valid swimmer row (row 2 or below)."); // Assuming header in row 1

    var lastRow = sheet.getLastRow();
    if (lastRow < row) throw new Error("Selected row is beyond the last used row.");

    // Clear first two columns (common to both modes)
    sheet.getRange(row, 1, 1, 2).clearContent();

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) throw new Error("Sheet has no columns.");

    // Set row background color based on mode
    var color = (mode === "scratch") ? COLOR_SCR : COLOR_PROT;
    sheet.getRange(row, 1, 1, lastColumn).setBackground(color);

    // Find last used column (assuming your function exists)
    if (typeof findLastUsedColumn !== "function") {
      throw new Error("Function findLastUsedColumn is not defined.");
    }
    var lastUsedColumn = findLastUsedColumn();
    if (lastUsedColumn < 1 || lastUsedColumn > lastColumn) {
      throw new Error("Invalid last used column.");
    }

    // Set label in last used column
    var label = (mode === "scratch") ? "Scr" : "Prot"; // Or "16&U" / "Protected" - change as needed
    sheet.getRange(row, lastUsedColumn).setValue(label);

    SpreadsheetApp.flush();

  } catch (error) {
    Logger.log("Error in markSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
    return;
  }

  renumberRankings();
  SpreadsheetApp.flush();
  // Optional: Ui alert on success
  //SpreadsheetApp.getUi().alert(mode === "scratch" ? "Swimmer scratched successfully." : "Swimmer marked as protected (16&U).");
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

    sheet.getRange(row, lastUsedColumn).clearContent();

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in UnscratchSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  renumberRankings();
  SpreadsheetApp.flush();
  return SUCCESS;
}

/**
 * Intent to scratch the current swimmer
 * 
 */
function IntentscrSwimmer() {
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

    sheet.getRange(row, 1, 1, lastColumn).setBackground(COLOR_INTENT);

    if (typeof findLastUsedColumn !== "function") {
      throw new Error("Function findLastUsedColumn is not defined.");
    }
    var lastUsedColumn = findLastUsedColumn();
    if (lastUsedColumn < 1 || lastUsedColumn > lastColumn) {
      throw new Error("Invalid last used column: " + lastUsedColumn);
    }

    sheet.getRange(row, lastUsedColumn).setValue("Intent to Scr");

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in IntentscrSwimmer: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  renumberRankings();
  SpreadsheetApp.flush();
  return SUCCESS;
}

/**
 * Finds the last used column in the active sheet.
 * @returns {number} The column number of the last used column.
 */
function findLastUsedColumn() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var lastColumn = sheet.getLastColumn();
  var values = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  for (var col = lastColumn; col >= 1; col--) {
    if (values[col - 1] !== "") {
      return col;
    }
  }

  return 1; // Default to column 1 if no used columns found
}

/**
 * Renumber rankings for swimmers.
 * 
 */
function renumberRankings() {
  console.log("renumberRankings");
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log("No swimmers to rank.");
      return SUCCESS;
    }

    var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    var data = dataRange.getValues();
    var backgrounds = dataRange.getBackgrounds();

    var rank = 1;
    var heat = 1;
    var lane = 5; // Starting lane
    var swimmersPerHeat = 10; // Assuming 10 lanes per heat

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var bg = backgrounds[i];

      // Skip if row is colored (scratched, etc.)
      if (bg[0] !== "#ffffff") { // Assuming white is default
        data[i][0] = ""; // Clear rank
        data[i][1] = ""; // Clear heat/lane
        continue;
      }

      // Assign rank
      data[i][0] = rank++;

      // Assign heat and lane
      data[i][1] = "H" + heat + "/L" + lane;

      // Update lane
      lane--;
      if (lane < 1) {
        lane = 10; // Reset to last lane
        heat++; // Next heat
      }
    }

    // Write back the updated values
    dataRange.setValues(data);

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in renumberRankings: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCCESS;
}

/**
 * Draw heat line on the active row.
 * 
 */
function drawHeatLine() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var row = sheet.getActiveCell().getRow();
    if (row < 1) {
      throw new Error("Invalid row selected.");
    }

    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 1) {
      throw new Error("Sheet has no columns.");
    }

    var range = sheet.getRange(row, 1, 1, lastColumn);

    range.setBorder(true, null, null, null, null, null, "black", SpreadsheetApp.BorderStyle.SOLID_THICK);

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in drawHeatLine: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCCESS;
}

/**
 * Remove all borders (heat lines) from the sheet.
 * 
 */
function removeAllBorders(sheet = SpreadsheetApp.getActiveSheet()) {
  try {
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();

    if (lastRow < 1 || lastColumn < 1) {
      Logger.log("Empty sheet; no borders to remove.");
      return SUCCESS;
    }

    var range = sheet.getRange(1, 1, lastRow, lastColumn);
    range.setBorder(null, null, null, null, null, null);

    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in removeAllBorders: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCCESS;
}

/**
 * Mark event as Closed.
 * 
 */
function MarkEventClosed() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    sheet.getRange(1, 1).setValue("Closed");
    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in MarkEventClosed: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCCESS;
}

/**
 * Mark event as Revised.
 * 
 */
function MarkEventRevised() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error("No active sheet found.");
    }

    sheet.getRange(1, 1).setValue("Revised");
    SpreadsheetApp.flush();
  } catch (error) {
    Logger.log("Error in MarkEventRevised: " + error.message);
    SpreadsheetApp.getUi().alert("Error: " + error.message);
  }
  return SUCCESS;
}

/**
 * Insert announced time as image over sheet.
 * 
 */
function insertTimesImageOverSheet() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
      input { width: 100%; padding: 10px; margin: 15px 0; font-size: 16px; box-sizing: border-box; }
      button { padding: 10px 20px; margin: 10px; font-size: 16px; cursor: pointer; }
      #okBtn { background: #4285f4; color: white; border: none; }
      #cancelBtn { background: #f1f1f1; border: 1px solid #ddd; }
    </style>
  </head>
  <body>
    <p>Enter Announced time (e.g., 10:30 AM):</p>
    <input type="text" id="timeInput" placeholder="10:30 AM" autofocus>
    <br>
    <button id="okBtn">OK</button>
    <button id="cancelBtn">Cancel</button>

    <script>
      document.getElementById('okBtn').onclick = function() {
        const time = document.getElementById('timeInput').value.trim();
        if (!time) {
          alert('Please enter a time.');
          return;
        }
        google.script.host.close();
        google.script.run
          .withSuccessHandler(() => { /* Success handled in server */ })
          .processAnnouncedTime(time);
      };

      document.getElementById('cancelBtn').onclick = function() {
        google.script.host.close();
      };

      document.getElementById('timeInput').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') document.getElementById('okBtn').click();
      });

      document.getElementById('timeInput').focus();
    </script>
  </body>
</html>
  `)
    .setWidth(300)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Announced Time');
}

/**
 * Process announced time (stub - implement as needed).
 * 
 */
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
 * Import sheet by name using dialog.
 * 
 */
function importSheetByName() {
  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
      input { width: 100%; padding: 10px; margin: 15px 0; font-size: 16px; box-sizing: border-box; }
      button { padding: 10px 20px; margin: 10px; font-size: 16px; }
      #importBtn { background: #4285f4; color: white; border: none; cursor: pointer; }
      #cancelBtn { background: #f1f1f1; border: 1px solid #ddd; cursor: pointer; }
    </style>
  </head>
  <body>
    <input type="text" id="fileName" placeholder="File name (with or without extension)" autofocus>
    <br>
    <button id="importBtn">Import</button>
    <button id="cancelBtn">Cancel</button>

<script>
  document.getElementById('importBtn').onclick = function() {
    const fileName = document.getElementById('fileName').value.trim();
    if (!fileName) {
      alert('Please enter a file name.');
      return;
    }

    // Close the import dialog immediately to avoid "Working..." issues
    google.script.host.close();

    // Run the import on the server
    google.script.run
      .withSuccessHandler(function(result) {
        if (result.success) {
          alert(result.message);  // Feedback that import worked

          // THIS IS THE KEY LINE:
          // Call the server-side function to show the Event Number dialog
          if (result.lastSheetName) {
            google.script.run.showEventNumberPrompt(result.lastSheetName);
          }
        } else {
          alert('Import failed: ' + result.message);
        }
      })
      .withFailureHandler(function(error) {
        alert('Error: ' + error.message);
      })
      .processImport(fileName);
  };

  document.getElementById('cancelBtn').onclick = function() {
    google.script.host.close();
  };

  document.getElementById('fileName').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('importBtn').click();
    }
  });

  document.getElementById('fileName').focus();
</script>
</body>
</html>
  `)
    .setWidth(300)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Event');
}

/**
 * Searches Drive for a spreadsheet containing the given name (most recent match),
 * copies its first sheet into the current spreadsheet, cleans it up, and tries
 * to detect event number from the original sheet name.
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
    const parentFolder = currentFile.getParents().next();  // assumes same folder

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
      return { success: false, message: `No exact match for "${fileNameToImport}" in this folder.` };
    }

    // Handle Google Sheet or Excel
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
      const converted = Drive.Files.create(resource, sourceFile.getBlob(), { convert: true });
      tempFileId = converted.id;
      sourceSs = SpreadsheetApp.openById(tempFileId);
    }

    const sourceSheets = sourceSs.getSheets();
    if (sourceSheets.length === 0) {
      return { success: false, message: 'Source file has no sheets.' };
    }

    // Copy ONLY the first sheet — most heat sheets have one main tab
    const sourceSheet = sourceSheets[0];
    const copiedSheet = sourceSheet.copyTo(currentSs);

    // Immediate unique temp name to avoid "Copy of" prefix issues
    const ts = Utilities.formatDate(new Date(), 'GMT', 'yyyyMMdd_HHmmssSSS');
    const tempName = `Imported_${ts}`;
    copiedSheet.setName(tempName);

    currentSs.setActiveSheet(copiedSheet);
    SpreadsheetApp.flush();

    // Clean up any temp conversion file
    if (tempFileId) {
      try { DriveApp.getFileById(tempFileId).setTrashed(true); } catch (e) { }
    }

    // Try extraction — prefer source sheet name over filename
    const nameForExtraction = sourceSheet.getName().trim() || fileNameToImport;
    // ─── Extraction & rename decision ───
    const detected = extractEventNumberFromFilename(fileNameToImport);

    const ui = SpreadsheetApp.getUi();
    let feedback = `Filename: "${fileNameToImport}"\nDetected event number: ${detected || "NONE"}`;

    if (detected) {
      const newName = 'Event ' + detected;
      try {
        copiedSheet.setName(newName);
        expandAllRows();
        feedback += `\n\nSUCCESS: Sheet renamed to "${newName}"`;
        //ui.alert('Auto-rename successful', feedback, ui.ButtonSet.OK);
        return { success: true, message: feedback, autoRenamed: true };
      } catch (e) {
        feedback += `\n\nRename FAILED: ${e.message}\nKept as: ${tempName}`;
        ui.alert('Auto-rename failed', feedback, ui.ButtonSet.OK);
        // Do NOT call showEventNumberPrompt here
        return { success: true, message: feedback };
      }
    } else {
      feedback += '\n\nNo event number found in filename → manual entry required';
      ui.alert('No auto-detection', feedback, ui.ButtonSet.OK);
      showEventNumberPrompt(tempName);
      return { success: true, message: feedback };
    }

  } catch (err) {
    Logger.log('Critical import error: ' + err);
    return { success: false, message: err.message };
  }
}

/**
 * Extract event number from filename.
 * 
 */
function extractEventNumberFromFilename(name) {
  console.log("extractEventNumberFromFilename: " + name);
  if (!name) return null;

  name = name.trim().toLowerCase();

  // New: match patterns like e21, E45, evt09, etc.
  const quickEvent = name.match(/^(?:e|evt|event)?\s*(\d{1,3})\b/i);
  if (quickEvent && quickEvent[1]) {
    return quickEvent[1];
  }
  // Strategy 1: "event xx" pattern
  const eventMatch = name.match(/event\s*(\d+)/i);
  if (eventMatch && eventMatch[1]) {
    return eventMatch[1];
  }

  // Strategy 2: Leading number like "042 - ..." or "89 Girls..."
  const leadingMatch = name.match(/^(\d{1,4})/);
  if (leadingMatch && leadingMatch[1]) {
    // Only use if it's 3 digits or less (avoid taking year like 20250117)
    if (parseInt(leadingMatch[1], 10) <= 999) {
      return leadingMatch[1];
    }
  }

  // Strategy 3: Number right before dash or common separator
  const dashMatch = name.match(/(\d{1,4})\s*[-–—]\s*/);
  if (dashMatch && dashMatch[1]) {
    return dashMatch[1];
  }

  // Last resort: any standalone 2–3 digit number
  // (less safe — only if previous failed)
  const anyNumber = name.match(/\b(\d{2,3})\b/);
  if (anyNumber && anyNumber[1]) {
    return anyNumber[1];
  }

  return null;
}

/**
 * Shows the Event Number dialog and passes the sheet name safely
 */
function showEventNumberPrompt(lastSheetName) {
  console.log("showEventNumberPrompt");
  const template = HtmlService.createTemplate(`
<!DOCTYPE html>
<html>

<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      text-align: center;
    }

    h3 {
      margin-top: 0;
    }

    input {
      width: 100%;
      padding: 10px;
      margin: 15px 0;
      font-size: 16px;
      box-sizing: border-box;
    }

    button {
      padding: 10px 20px;
      margin: 10px;
      font-size: 16px;
    }

    #okBtn {
      background: #4285f4;
      color: white;
    }

    #cancelBtn {
      background: #f1f1f1;
    }
  </style>
</head>

<body>
  <h3>Sheet Imported Successfully</h3>
  <p>Please enter the event number:</p>
  <input type="text" id="eventNum" placeholder="e.g., 5, 12, 101" autofocus>

  <br>
  <button id="okBtn">OK</button>
  <button id="cancelBtn">Cancel</button>

  <script>
  // Safely injected from server via template
  const sheetName = '<?!= sheetName ?>';

  // ... rest of your script remains exactly as before
  document.getElementById('okBtn').onclick = function () {
    const eventNum = document.getElementById('eventNum').value.trim();
    if (!eventNum || isNaN(eventNum) || eventNum === '') {
      alert('Please enter a valid event numbera (numeric only).');
      return;
    }

    google.script.host.close();

    google.script.run
      .withSuccessHandler(function () {
        google.script.host.editor.getUi()
          .toast('Sheet renamed to "Event ' + eventNum + '" and activated.', 'Success', 8);
      })
      .withFailureHandler(function (error) {
        google.script.host.editor.getUi()
          .alert('Rename failed: ' + error.message);
      })
      .renameSheetToEvent(sheetName, eventNum);
  };

    document.getElementById('cancelBtn').onclick = function () {
      google.script.host.close();
    };

    // Allow Enter key to submit
    document.getElementById('eventNum').addEventListener('keyup', function (e) {
      if (e.key === 'Enter') {
        document.getElementById('okBtn').click();
      }
    });

    // Focus the input field
    document.getElementById('eventNum').select();
  </script>
</body>

</html>
  `);
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
// (see previous response for full processImport code)

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
    console.log("renameSheetToEvent");
    expandAllRows();  // Clean up the newly renamed sheet

    return SUCCESS;  // Consistent with other functions in your script
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
    const sheetId = sheet.getSheetId();           // This is correct — gid value
    const editUrl = ss.getUrl();                   // e.g. https://docs.google.com/spreadsheets/d/ABC123/edit

    // Reliable view-only URL with direct tab jump (works as of 2026)
    let baseUrl = editUrl.replace(/\/edit.*$/, ''); // strip /edit#gid=... etc.
    const viewOnlyUrl = `${baseUrl}/preview#gid=${sheetId}`;

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

    Logger.log(`View-Only URL for "${sheetName}" (gid=${sheetId}): ${viewOnlyUrl}`);

  } catch (error) {
    Logger.log("Error: " + error.message);
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
  return SUCCESS;
}

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