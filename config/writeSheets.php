<?php
require 'vendor/autoload.php';

use Google\Client;
use Google\Service\Sheets;

// Configuration
$spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your Google Sheet ID
$range = 'Sheet1!A:C'; // Adjust range as needed

// Initialize Google Client
function getClient()
{
  $client = new Client();
  $client->setApplicationName('Google Sheets PHP Integration');
  $client->setScopes(Google\Service\Sheets::SPREADSHEETS);
  $client->setAuthConfig('credentials.json'); // Path to your service account credentials
  return $client;
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  try {
    $client = getClient();
    $service = new Google\Service\Sheets($client);

    // Get form data
    $name = filter_input(INPUT_POST, 'name', FILTER_SANITIZE_STRING);
    $email = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
    $message = filter_input(INPUT_POST, 'message', FILTER_SANITIZE_STRING);

    // Prepare data for Google Sheets
    $values = [
      [$name, $email, $message, date('Y-m-d H:i:s')]
    ];

    $body = new Google\Service\Sheets\ValueRange([
      'values' => $values
    ]);

    $params = [
      'valueInputOption' => 'RAW'
    ];

    // Append data to Google Sheet
    $result = $service->spreadsheets_values->append(
      $spreadsheetId,
      $range,
      $body,
      $params
    );

    $success = "Data successfully saved to Google Sheet!";
  } catch (Exception $e) {
    $error = "Error: " . $e->getMessage();
  }
}
?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data to Google Sheet</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      padding: 20px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    label {
      display: block;
      margin-bottom: 5px;
    }

    input,
    textarea {
      width: 100%;
      padding: 8px;
      margin-bottom: 10px;
    }

    button {
      padding: 10px 20px;
      background-color: #4CAF50;
      color: white;
      border: none;
      cursor: pointer;
    }

    button:hover {
      background-color: #45a049;
    }

    .message {
      margin-top: 20px;
      padding: 10px;
      border-radius: 5px;
    }

    .success {
      background-color: #dff0d8;
      color: #3c763d;
    }

    .error {
      background-color: #f2dede;
      color: #a94442;
    }
  </style>
</head>

<body>
  <h2>Submit Data to Google Sheet</h2>

  <?php if (isset($success)): ?>
    <div class="message success"><?php echo $success; ?></div>
  <?php elseif (isset($error)): ?>
    <div class="message error"><?php echo $error; ?></div>
  <?php endif; ?>

  <form method="POST">
    <div class="form-group">
      <label for="name">Name:</label>
      <input type="text" id="name" name="name" required>
    </div>
    <div class="form-group">
      <label for="email">Email:</label>
      <input type="email" id="email" name="email" required>
    </div>
    <div class="form-group">
      <label for="message">Message:</label>
      <textarea id="message" name="message" rows="4" required></textarea>
    </div>
    <button type="submit">Submit</button>
  </form>
</body>

</html>