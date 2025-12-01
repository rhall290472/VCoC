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
}

/**
 * MAIN SPLIT FUNCTION – now completely bulletproof
 */
function splitEventsInColumnsGHIJ() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const DATA_START_ROW = 2;
  const COLUMNS_TO_CHECK = [7, 8, 9, 10];    // G=7, H=8, I=9, J=10

  // 1. Get current data (including header)
  const lastRow = sheet.getLastRow();
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

  // 3. Write back safely – NEVER touches row 1 (the real header)
  if (newDataRows.length > 0) {
    // Clear only the data area (row 2 and below)
    if (lastRow >= 2) {
      const clearRange = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getLastColumn());
      clearRange.clearContent();               // ← correct method name
    }

    // Write new data starting at row 2
    const target = sheet.getRange(2, 1, newDataRows.length, newDataRows[0].length);
    target.setValues(newDataRows);
  }

  console.log(`Success! Sheet now has ${1 + newDataRows.length} rows (including header)`);
}