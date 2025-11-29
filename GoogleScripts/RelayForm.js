function onFormSubmit(e) {
  const form = FormApp.getActiveForm();
  const formResponse = e.response;
  const email = formResponse.getRespondentEmail(); // Works if "Collect email addresses" is ON
  // OR if you have a specific email question: const email = e.values[INDEX_OF_EMAIL_QUESTION];

  if (!email) {
    console.error("No email found for this submission.");
    return;
  }

  // Generate the unique edit URL
  const editUrl = formResponse.getEditResponseUrl();

  // Customize your email
  const subject = "Thank you for your submission! Here's your edit link";
  
  const body = `
    <h2>Thank you for submitting the form!</h2>
    <p>You can edit or update your responses at any time using the link below:</p>
    
    <p style="margin: 20px 0;">
      <a href="${editUrl}" style="background-color: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Edit Your Response
      </a>
    </p>
    
    <p><strong>Important:</strong> This link is unique to your submission and will always bring you back to your answers.</p>
    
    <hr>
    <small>This email was sent automatically by Google Forms + Apps Script.</small>
  `;

  try {
    GmailApp.sendEmail(email, subject, "", {
      htmlBody: body,
      name: "Form Submission Confirmation" // Optional: sender name
    });
    
    console.log(`Edit link emailed to: ${email}`);
  } catch (error) {
    console.error("Failed to send email:", error.toString());
  }
}

// Optional: Create a trigger automatically when you run this once
function createTrigger() {
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
}