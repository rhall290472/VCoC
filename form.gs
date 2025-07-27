// Global constant for the spreadsheet URL
const MEET_DATA_URL = 'https://docs.google.com/spreadsheets/d/1zGuiBwQCNarAin85FHNt7dS-oB1X-npWBkJJQ9XXIkE/edit?gid=0#gid=0';
                       
// Trigger to initialize form
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
}

/**************************************************************************/
//
// Populate events for prelim scratch fields
//
/**************************************************************************/
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

/**************************************************************************/
//
// Retrieve event data from spreadsheet
//
/**************************************************************************/
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

/**************************************************************************/
//
// Populate teams for prelim scratch fields
//
/**************************************************************************/
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

/**************************************************************************/
//
// Retrieve team data from spreadsheet
//
/**************************************************************************/
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
      throw new Error("Sheet TeamData is empty.");
    }

    var returnData = questionSheet.getRange(1, 1, lastRow, lastColumn).getValues();
    if (!returnData || returnData.length === 0) {
      throw new Error("No data retrieved from sheet: TeamData");
    }

    return returnData;
  } catch (error) {
    Logger.log("Error in getTeams: " + error.message);
    throw error; // Rethrow to be caught by calling function
  }
}


/**
 * Configuration object for easy customization
 */
const CONFIG = {
  EMAIL_QUESTION_TITLE: 'Email', // Exact title of the email question in the form
  EMAIL_SUBJECT: 'Your Form Submission Responses',
  FORM_COLLECTS_EMAIL: false, // Set to true if form collects respondent email automatically
  EMAIL_QUOTA_WARNING: 90 // Warn if remaining email quota falls below this (out of 100 for free accounts)
};

/**
 * Triggered on form submission to email responses to the user-provided email
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
  try {
    // Get the form response from the event object
    const formResponse = e.response;
    if (!formResponse) {
      Logger.log('Error: No form response found in event object.');
      return;
    }
    
    const itemResponses = formResponse.getItemResponses();
    let email = '';
    let messageBody = `
      <h3>Thank You for Your Submission</h3>
      <p>Below are your form responses:</p>
      <ul>
    `;
    
    // Check if form collects respondent email automatically
    if (CONFIG.FORM_COLLECTS_EMAIL) {
      email = formResponse.getRespondentEmail();
      if (!email) {
        Logger.log('Error: No respondent email collected by form.');
      }
    }
    
    // Loop through item responses to find email (if not collected automatically) and build message
    for (let i = 0; i < itemResponses.length; i++) {
      const itemResponse = itemResponses[i];
      const question = itemResponse.getItem().getTitle();
      // Handle array responses (e.g., checkboxes)
      const answer = Array.isArray(itemResponse.getResponse()) 
        ? itemResponse.getResponse().join(', ') 
        : itemResponse.getResponse();
      
      // If form doesn't collect email automatically, look for email question
      if (!CONFIG.FORM_COLLECTS_EMAIL && question === CONFIG.EMAIL_QUESTION_TITLE) {
        email = answer;
      }
      
      // Add question and answer to email body
      messageBody += `<li><strong>${question}</strong>: ${answer}</li>`;
    }
    messageBody += '</ul>';
    
    // Validate email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      Logger.log(`Error: Invalid or missing email address: ${email}`);
      return;
    }
    
    // Check remaining email quota
    const remainingQuota = MailApp.getRemainingDailyQuota();
    if (remainingQuota < CONFIG.EMAIL_QUOTA_WARNING) {
      Logger.log(`Warning: Low email quota. Remaining: ${remainingQuota}`);
    }
    if (remainingQuota <= 0) {
      Logger.log('Error: Email quota exceeded. Cannot send email.');
      return;
    }
    
    // Send email
    MailApp.sendEmail({
      to: email,
      subject: CONFIG.EMAIL_SUBJECT,
      htmlBody: messageBody
    });
    
    Logger.log(`Email sent successfully to ${email}`);
    
  } catch (error) {
    Logger.log(`Error in onFormSubmit: ${error.message}`);
    if (error.message.includes('Service invoked too many times')) {
      Logger.log('Possible email quota issue. Check MailApp.getRemainingDailyQuota().');
    }
  }
}
