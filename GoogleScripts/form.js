/**
 * Virtual Clerk of Course App Scripts - FORMS
 *
 * Version: 27Jul25 - Start
 * Version: 30Jul25 - Added trigger to stop accepting responses
 */


const APP_CONFIG = {
  spreadsheetUrl: 'https://docs.google.com/...',
  formId: '18Hvt5HCGnex...',
  teamSheetName: 'TeamData',
  eventSheetNames: ['ThurData', 'FriData', 'SatData', 'SunData']
};

/**
 * The URL of the Google Spreadsheet containing meet data.
 * @constant {string}
 */
const MEET_DATA_URL = 'https://docs.google.com/spreadsheets/d/1zGuiBwQCNarAin85FHNt7dS-oB1X-npWBkJJQ9XXIkE/edit?gid=0#gid=0';

/**
 * The ID of the Google Form for setting response triggers.
 * @constant {string}
 */
const FORM_ID = '18Hvt5HCGnexIg0ZNOO1Xk9n3QKt9MQpJ424td0JwDp8';

/**
 * The date and time to stop accepting form responses.
 * @constant {Date}
 */
const stopDateTime = new Date(2025, 6, 30, 19, 40); // Example: July 31, 2025, 09:40 PM

/**
 * Initializes the Google Form by populating team dropdowns and setting up a trigger to stop responses.
 * @throws {Error} If form initialization fails or data retrieval encounters an error.
 */
function openForm() {
  try {
    // Populate event dropdowns for each day
    //populateEvents('ThurData');
    //populateEvents('FriData');
    //populateEvents('SatData');
    //populateEvents('SunData');

    // Populate team dropdown
    populateTeams();

    Logger.log("Form initialized successfully.");
  } catch (error) {
    Logger.log("Error in openForm: " + error.message);
    FormApp.getUi().alert("Error initializing form: " + error.message);
  }

  //setFormStopTrigger();
}

/**
 * Populates event dropdowns in the form with data from a specified spreadsheet sheet.
 * @param {string} eventData - The name of the spreadsheet sheet containing event data.
 * @throws {Error} If the event data sheet name is invalid, no active form is found, or data retrieval fails.
 */
function populateEvents(eventData) {
  try {
    // Validate input
    if (!eventData || typeof eventData !== 'string' || eventData.trim() === '') {
      throw new Error("Invalid event data sheet name: " + eventData);
    }

    // Get the active form
    var form = FormApp.getActiveForm();
    if (!form) {
      throw new Error("No active form found.");
    }

    // Get event data from spreadsheet
    var googleSheetsQuestions = getEvents(eventData);
    if (!googleSheetsQuestions || !Array.isArray(googleSheetsQuestions) || googleSheetsQuestions.length < 1) {
      throw new Error("No valid event data retrieved for sheet: " + eventData);
    }

    // Get form items
    var itemsArray = form.getItems();
    if (!itemsArray || itemsArray.length === 0) {
      throw new Error("No items found in the form.");
    }

    // Process each form item
    itemsArray.forEach(function(item, itemIndex) {
      if (!item) {
        throw new Error("Invalid form item at index: " + itemIndex);
      }
      var itemTitle = item.getTitle();
      googleSheetsQuestions[0].forEach(function(header_value, header_index) {
        if (header_value === itemTitle) {
          var choiceArray = [];
          for (var j = 1; j < googleSheetsQuestions.length; j++) {
            var value = googleSheetsQuestions[j][header_index];
            if (value !== '' && value !== null && value !== undefined) {
              choiceArray.push(value.toString());
            }
          }
          if (choiceArray.length === 0) {
            Logger.log("No valid choices found for item: " + itemTitle);
            return;
          }

          // Update form item based on type
          var itemType = item.getType();
          if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
            item.asMultipleChoiceItem().setChoiceValues(choiceArray);
          } else if (itemType === FormApp.ItemType.CHECKBOX) {
            item.asCheckboxItem().setChoiceValues(choiceArray);
          } else if (itemType === FormApp.ItemType.LIST) {
            item.asListItem().setChoiceValues(choiceArray);
          } else {
            Logger.log("Unsupported item type for " + itemTitle + ": " + itemType);
          }
        }
      });
    });

    Logger.log("Events populated successfully for sheet: " + eventData);
  } catch (error) {
    Logger.log("Error in populateEvents (" + eventData + "): " + error.message);
    throw error; // Rethrow to be caught by openForm
  }
}

/**
 * Retrieves event data from a specified sheet in the Google Spreadsheet.
 * @param {string} eventData - The name of the spreadsheet sheet containing event data.
 * @returns {Array<Array>} The data from the specified sheet as a 2D array.
 * @throws {Error} If the sheet name is invalid, the spreadsheet cannot be opened, or the sheet is empty.
 */
function getEvents(eventData) {
  try {
    // Validate input
    if (!eventData || typeof eventData !== 'string' || eventData.trim() === '') {
      throw new Error("Invalid event data sheet name: " + eventData);
    }

    // Open spreadsheet
    var ss = SpreadsheetApp.openByUrl(MEET_DATA_URL);
    if (!ss) {
      throw new Error("Failed to open spreadsheet at: " + MEET_DATA_URL);
    }

    // Get sheet
    var questionSheet = ss.getSheetByName(eventData);
    if (!questionSheet) {
      throw new Error("Sheet not found: " + eventData);
    }

    // Get data
    var lastRow = questionSheet.getLastRow();
    var lastColumn = questionSheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {
      throw new Error("Sheet " + eventData + " is empty.");
    }

    var returnData = questionSheet.getRange(1, 1, lastRow, lastColumn).getValues();
    if (!returnData || returnData.length === 0) {
      throw new Error("No data retrieved from sheet: " + eventData);
    }

    return returnData;
  } catch (error) {
    Logger.log("Error in getEvents (" + eventData + "): " + error.message);
    throw error; // Rethrow to be caught by calling function
  }
}

/**
 * Populates team dropdowns in the form with data from the 'TeamData' spreadsheet sheet.
 * @throws {Error} If no active form is found, no valid team data is retrieved, or form items are invalid.
 */
function populateTeams() {
  try {
    // Get the active form
    var form = FormApp.getActiveForm();
    if (!form) {
      throw new Error("No active form found.");
    }

    // Get team data from spreadsheet
    var googleSheetsQuestions = getTeams();
    if (!googleSheetsQuestions || !Array.isArray(googleSheetsQuestions) || googleSheetsQuestions.length < 1) {
      throw new Error("No valid team data retrieved.");
    }

    // Get form items
    var itemsArray = form.getItems();
    if (!itemsArray || itemsArray.length === 0) {
      throw new Error("No items found in the form.");
    }

    // Process each form item
    itemsArray.forEach(function(item, itemIndex) {
      if (!item) {
        throw new Error("Invalid form item at index: " + itemIndex);
      }
      var itemTitle = item.getTitle();
      googleSheetsQuestions[0].forEach(function(header_value, header_index) {
        if (header_value === itemTitle) {
          var choiceArray = [];
          for (var j = 1; j < googleSheetsQuestions.length; j++) {
            var value = googleSheetsQuestions[j][header_index];
            if (value !== '' && value !== null && value !== undefined) {
              choiceArray.push(value.toString());
            }
          }
          if (choiceArray.length === 0) {
            Logger.log("No valid choices found for item: " + itemTitle);
            return;
          }

          // Update form item based on type
          var itemType = item.getType();
          if (itemType === FormApp.ItemType.MULTIPLE_CHOICE) {
            item.asMultipleChoiceItem().setChoiceValues(choiceArray);
          } else if (itemType === FormApp.ItemType.CHECKBOX) {
            item.asCheckboxItem().setChoiceValues(choiceArray);
          } else if (itemType === FormApp.ItemType.LIST) {
            item.asListItem().setChoiceValues(choiceArray);
          } else {
            Logger.log("Unsupported item type for " + itemTitle + ": " + itemType);
          }
        }
      });
    });

    Logger.log("Teams populated successfully.");
  } catch (error) {
    Logger.log("Error in populateTeams: " + error.message);
    throw error; // Rethrow to be caught by openForm
  }
}

/**
 * Retrieves team data from the 'TeamData' sheet in the Google Spreadsheet.
 * @returns {Array<Array>} The data from the 'TeamData' sheet as a 2D array.
 * @throws {Error} If the spreadsheet cannot be opened, the 'TeamData' sheet is not found, or the sheet is empty.
 */
function getTeams() {
  try {
    // Open spreadsheet
    var ss = SpreadsheetApp.openByUrl(MEET_DATA_URL);
    if (!ss) {
      throw new Error("Failed to open spreadsheet at: " + MEET_DATA_URL);
    }

    // Get sheet
    var questionSheet = ss.getSheetByName('TeamData');
    if (!questionSheet) {
      throw new Error("Sheet not found: TeamData");
    }

    // Get data
    var lastRow = questionSheet.getLastRow();
    var lastColumn = questionSheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) {