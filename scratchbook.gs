/**
 * Virtual Clerk of Course App Scripts - Scratch Book
 * Version: 31Jul25 - Created
 */
// Configurable source sheet name
const SOURCE_SHEET_NAME = 'Sheet1'; // Change to your sheet name
const COLOR_SCR = "Yellow";  // Color for Scr


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


function breakOutByEvent() {
  // Get the active spreadsheet
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(SOURCE_SHEET_NAME);
  if (!sourceSheet) {
    Logger.log(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    SpreadsheetApp.getUi().alert(`Source sheet "${SOURCE_SHEET_NAME}" not found! Please check the sheet name in the spreadsheet tabs.`);
    return;
  }

  // Get all data from the source sheet
  const data = sourceSheet.getDataRange().getValues();
  if (data.length < 1) {
    Logger.log('No data found in source sheet!');
    SpreadsheetApp.getUi().alert('No data found in source sheet!');
    return;
  }

  // Log first 20 rows of first column for debugging
  Logger.log('First 20 rows of first column:');
  let logMessage = 'First 10 rows of first column (for alert):\n';
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const firstCell = data[i][0] ? data[i][0].toString().trim() : '';
    Logger.log(`Row ${i + 1}: "${firstCell}"`);
    if (i < 10) {
      logMessage += `Row ${i + 1}: "${firstCell}"\n`;
    }
  }

  // Initialize variables
  let currentEvent = null;
  let eventData = [];
  let allEvents = [];
  let seenEventNumbers = new Set(); // Track event numbers to skip duplicates

  // Parse data to group by events
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const firstCell = row[0] ? row[0].toString().trim() : '';

    // Skip completely empty rows
    if (row.every(cell => !cell || cell.toString().trim() === '')) {
      continue;
    }

    // Check if row starts a new event (e.g., "Event 1", "Event 15")
    if (firstCell.match(/^Event\s*\d+/i)) {
      // Extract event number (e.g., "Event 15")
      const eventNumber = firstCell.match(/^Event\s*\d+/i)[0].replace(/\s+/g, ' ').trim();
      const eventNum = eventNumber.match(/\d+/)[0]; // Extract just the number (e.g., "15")

      // Check for duplicate event
      if (seenEventNumbers.has(eventNum)) {
        Logger.log(`Skipping duplicate event at row ${i + 1}: ${firstCell}`);
        continue; // Skip this event
      }
      seenEventNumbers.add(eventNum); // Mark event as seen

      // Save previous event data if exists
      if (currentEvent && eventData.length > 0) {
        allEvents.push({ eventName: currentEvent, data: eventData });
      }
      // Start new event
      currentEvent = eventNumber; // Use exact event number (e.g., "Event 15")
      eventData = [row]; // Start with event title row
      Logger.log(`Detected event at row ${i + 1}: ${firstCell}`);
      continue;
    }

    // Add all rows to current event (including blank rows and headers)
    if (currentEvent) {
      eventData.push(row);
    }
  }

  // Save the last event
  if (currentEvent && eventData.length > 0) {
    const eventNum = currentEvent.match(/\d+/)[0];
    if (!seenEventNumbers.has(eventNum)) {
      allEvents.push({ eventName: currentEvent, data: eventData });
      seenEventNumbers.add(eventNum);
    }
  }

  // Log if no valid events were found
  if (allEvents.length === 0) {
    Logger.log('No valid events found in the data!');
    SpreadsheetApp.getUi().alert(
      `No valid events found in "${SOURCE_SHEET_NAME}"!\n` +
      `Expected rows in Column A starting with "Event " followed by a number (e.g., "Event 1 Girls...").\n` +
      `Please check:\n1. Sheet name is "${SOURCE_SHEET_NAME}".\n2. Column A has event titles like "Event 1", "Event 15", etc.\n3. No extra spaces or hidden characters.\n` +
      `Share the log output from View > Logs with your support contact.\n` +
      `${logMessage}`
    );
    return;
  }

  // Create a new sheet for each event
  allEvents.forEach((event, index) => {
    let sheetName = event.eventName; // Use exact event number (e.g., "Event 15")
    let newSheet = spreadsheet.getSheetByName(sheetName);

    // If sheet exists, clear it; otherwise, create new
    if (newSheet) {
      newSheet.clear();
    } else {
      newSheet = spreadsheet.insertSheet(sheetName);
    }

    // Determine maximum column count for this event's data
    const maxColumns = Math.max(...event.data.map(row => row.filter(cell => cell && cell.toString().trim() !== '').length));

    // Write event data to the sheet
    try {
      // Pad rows to ensure consistent column count
      const paddedData = event.data.map(row => {
        const paddedRow = [...row];
        while (paddedRow.length < maxColumns) {
          paddedRow.push('');
        }
        return paddedRow.slice(0, maxColumns); // Trim any extra columns
      });
      newSheet.getRange(1, 1, paddedData.length, maxColumns).setValues(paddedData);

      // Merge columns A-F in row 1 (event title)
      newSheet.getRange(1, 1, 1, Math.min(6, maxColumns)).mergeAcross();

      // Auto-resize all columns to fit contents (except Column A)
      if (maxColumns > 1) {
        newSheet.autoResizeColumns(2, maxColumns - 1); // Auto-resize columns B onward
      }
      // Set Column A to 60 pixels
      newSheet.setColumnWidth(1, 60);

      // Apply basic formatting
      newSheet.getRange(1, 1, 1, maxColumns).setFontWeight('bold'); // Event title
      if (paddedData.length > 2) {
        newSheet.getRange(3, 1, 1, maxColumns).setFontWeight('bold'); // Headers (if present)
      }
    } catch (e) {
      Logger.log(`Error processing sheet ${sheetName}: ${e.message}`);
      SpreadsheetApp.getUi().alert(`Error processing sheet ${sheetName}: ${e.message}`);
    }
  });

  SpreadsheetApp.getUi().alert('Sheets created successfully for each event!');
}

function deleteAllSheetsExceptSource() {
  // Get the active spreadsheet
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(SOURCE_SHEET_NAME);
  if (!sourceSheet) {
    Logger.log(`Source sheet "${SOURCE_SHEET_NAME}" not found!`);
    SpreadsheetApp.getUi().alert(`Source sheet "${SOURCE_SHEET_NAME}" not found! No sheets were deleted.`);
    return;
  }

  // Log initial sheet count
  let allSheets = spreadsheet.getSheets();
  Logger.log(`Initial sheet count: ${allSheets.length}`);

  // Process sheets in batches
  const batchSize = 5; // Process up to 5 sheets per batch
  const maxRetries = 2; // Retry up to 2 times per sheet
  while (allSheets.length > 1) { // Continue until only the source sheet remains
    const batch = allSheets.slice(0, Math.min(batchSize, allSheets.length));
    let deletedInBatch = false;

    for (const sheet of batch) {
      if (sheet.getName() !== SOURCE_SHEET_NAME) {
        let retries = 0;
        let success = false;
        while (retries <= maxRetries && !success) {
          try {
            // Verify sheet still exists
            const sheetToDelete = spreadsheet.getSheetByName(sheet.getName());
            if (sheetToDelete) {
              Logger.log(`Attempting to delete sheet: ${sheet.getName()} (ID: ${sheetToDelete.getSheetId()}) (Retry ${retries})`);
              spreadsheet.deleteSheet(sheetToDelete);
              Logger.log(`Deleted sheet: ${sheet.getName()}`);
              deletedInBatch = true;
              success = true;
            } else {
              Logger.log(`Sheet ${sheet.getName()} no longer exists.`);
              success = true; // Skip if already gone
            }
          } catch (e) {
            Logger.log(`Error deleting sheet ${sheet.getName()} (ID: ${sheet.getSheetId()}) (Retry ${retries}): ${e.message}`);
            retries++;
            if (retries > maxRetries) {
              Logger.log(`Failed to delete sheet ${sheet.getName()} after ${maxRetries} retries. Skipping.`);
            }
            Utilities.sleep(500); // Short delay before retry
          }
        }
      }
    }

    // Refresh sheet list after batch
    allSheets = spreadsheet.getSheets();
    if (!deletedInBatch) {
      Logger.log('No sheets deleted in this batch; exiting loop.');
      break;
    }

    // Delay after each batch
    Utilities.sleep(1000);
  }

  // Log final sheet count
  Logger.log(`Final sheet count: ${allSheets.length}`);
  SpreadsheetApp.getUi().alert(`All sheets except "${SOURCE_SHEET_NAME}" have been deleted.`);
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

//    sheet.getRange(row, 1, 1, 2).clearContent();

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
}
