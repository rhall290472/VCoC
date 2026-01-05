<?php

/**
 * submit_relay.php - Multi-day relay entry submission and edit handler
 *
 * This script handles the submission of relay team entries for a swimming competition
 * across multiple days (Thursday–Sunday). It supports:
 *   - New submissions
 *   - Editing existing submissions via a unique edit token
 *   - Validation and storage in a MySQL database
 *   - Appending entries to a Google Sheet for administrative use
 *   - Sending a richly formatted confirmation email with a one-time edit link
 *
 * Features:
 *   - Dynamic form generation based on the selected day and event configuration
 *   - Pre-filled forms when editing
 *   - Forced "Swim Prelim" checkboxes for certain relays (C on Thu/Fri, E/F on Sat/Sun)
 *   - Secure edit tokens (random_bytes)
 *   - PHPMailer for SMTP email delivery
 *   - Google Sheets API integration for real-time export
 *
 * Security considerations:
 *   - Uses prepared statements to prevent SQL injection
 *   - htmlspecialchars() on output to prevent XSS
 *   - Edit links are unguessable 32-byte tokens
 *   - Input is trimmed and validated
 *
 * Dependencies (via Composer):
 *   - phpmailer/phpmailer
 *   - google/apiclient
 *
 * Required configuration files:
 *   - config/config.php (database and SMTP constants)
 *   - config/relay-credentials.json (Google service account credentials)
 *
 * @author  Richard Hall
 * @version 1.0
 * @date    2026-01-05
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Google\Client;
use Google\Service\Sheets;
use Google\Service\Sheets\ValueRange;

require 'vendor/autoload.php';
require 'config/config.php';

/*
 * Establish database connection
 */
try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  die("Database connection failed: " . $e->getMessage());
}

/*
 * Fetch list of teams for the dropdown
 */
$stmt = $pdo->query("SELECT name FROM teams ORDER BY name ASC");
$teams = $stmt->fetchAll(PDO::FETCH_COLUMN);

/*
 * Event configuration per day
 * Defines which events exist on each day and how many relay lines (A, B, C, etc.) are available
 */

// Load meet configuration
//$meet_slug = $_GET['meet'] ?? '2026-wz-sc';  // e.g. ?meet=2026-sectionals
$meet_slug = $_GET['meet'] ?? 'csi-state-ag-sc';  // e.g. ?meet=2026-sectionals
$meet_file = __DIR__ . '/config/meets/' . basename($meet_slug) . '.json';

if (!file_exists($meet_file)) {
  die("Meet configuration not found.");
}

$meet_config = json_decode(file_get_contents($meet_file), true);
if (json_last_error() !== JSON_ERROR_NONE) {
  die("Invalid meet configuration JSON.");
}

// Convert to the format the rest of the script expects
// Convert to consistent internal format
$event_configs = [];
foreach ($meet_config['days'] as $day_key => $day_data) {
  $event_configs[$day_key] = [
    'events' => [],  // will be: gender => [event1, event2, ...]
    'lines'  => []
  ];

  // Normalize events: ensure each gender has an ARRAY of events
  foreach ($day_data['events'] as $gender_key => $event_data) {
    if (isset($event_data['id']) && isset($event_data['name'])) {
      // Old format: single object → wrap in array
      $event_configs[$day_key]['events'][$gender_key] = [$event_data];
    } else {
      // New format: already an array → use as-is
      $event_configs[$day_key]['events'][$gender_key] = $event_data;
    }
  }

  // Convert lines array ["A","B","C"] → ['a'=>'A', 'b'=>'B', 'c'=>'C']
  foreach ($day_data['lines'] as $i => $label) {
    $key = strtolower(chr(97 + $i)); // a, b, c, ...
    $event_configs[$day_key]['lines'][$key] = $label;
  }
}

// Optional overrides
define('GOOGLE_SHEETS_SPREADSHEET_ID', $meet_config['google_sheet_id'] ?? GOOGLE_SHEETS_SPREADSHEET_ID);
define('GOOGLE_SHEETS_RANGE', $meet_config['google_sheet_range'] ?? 'Sheet1!A:M');

define('GOOGLE_SHEETS_CREDENTIALS_PATH', __DIR__ . '/config/relay-credentials.json');

// Store forced prelim rules for later use
$forced_prelim_rules = $meet_config['forced_prelim'] ?? [];
/*
 * Handle edit mode – load existing submission if a valid edit token is provided
 */
$edit_token    = $_GET['edit'] ?? '';
$is_edit_mode  = false;
$first_name = $last_name = $email = $team = '';
$day = strtolower($_GET['day'] ?? '');
$entries_index = [];

// Determine if we are in edit mode and load existing data
if ($edit_token) {
  $stmt = $pdo->prepare("SELECT * FROM relay_submissions WHERE edit_token = ?");
  $stmt->execute([$edit_token]);
  $submission = $stmt->fetch(PDO::FETCH_ASSOC);

  if ($submission) {
    $first_name = htmlspecialchars($submission['first_name']);
    $last_name  = htmlspecialchars($submission['last_name']);
    $email      = htmlspecialchars($submission['email']);
    $team       = htmlspecialchars($submission['team']);
    $day        = strtolower($submission['day']);
    $is_edit_mode = true;

    if (!isset($event_configs[$day])) {
      echo "<h2>Invalid day for this submission.</h2>";
      exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM relay_entries WHERE submission_id = ?");
    $stmt->execute([$submission['id']]);
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // foreach ($event_configs[$day]['events'] as $gender_key => $event) {
    //   $entries_index[$gender_key] = [];
    //   foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
    //     $entries_index[$gender_key][$line_key] = [];
    //   }
    // }

    // foreach ($entries as $row) {
    //   foreach ($event_configs[$day]['events'] as $gender_key => $event) {
    //     if ($row['event_id'] == $event['id']) {
    // Initialize empty structure
    foreach ($event_configs[$day]['events'] as $gender_key => $events_list) {
      $entries_index[$gender_key] = [];
      foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
        $entries_index[$gender_key][$line_key] = [];
      }
    }

    // Load existing entries
    foreach ($entries as $row) {
      foreach ($event_configs[$day]['events'] as $gender_key => $events_list) {
        foreach ($events_list as $event) {
          if ($row['event_id'] == $event['id']) {
            $line = strtolower($row['line']);
            $entries_index[$gender_key][$line] = [
              'scratch' => $row['scratch'],
              'prelim'  => $row['swim_prelim'],
              's1' => htmlspecialchars($row['swimmer1'] ?? ''),
              's2' => htmlspecialchars($row['swimmer2'] ?? ''),
              's3' => htmlspecialchars($row['swimmer3'] ?? ''),
              's4' => htmlspecialchars($row['swimmer4'] ?? ''),
            ];
            break 2; // exit both inner loops once matched
          }
        }
      }
    }
  } else {
    echo "<h2>Sorry – this edit link is no longer valid.</h2>";
    exit;
  }
}
// Initialize empty structure for new submissions
else {
  if (!isset($event_configs[$day])) {
    die("Invalid or missing day parameter.");
  }
  foreach ($event_configs[$day]['events'] as $gender_key => $events_list) {
    $entries_index[$gender_key] = [];
    foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
      $entries_index[$gender_key][$line_key] = [];
    }
  }
}

$config = $event_configs[$day];

// Process form submission (new or update)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Validate required fields
  $first_name = trim($_POST['first_name'] ?? '');
  $last_name  = trim($_POST['last_name'] ?? '');
  $full_name  = $first_name . ' ' . $last_name;
  $email      = trim($_POST['email'] ?? '');
  $team       = trim($_POST['team'] ?? '');
  $post_day   = strtolower(trim($_POST['day'] ?? ''));

  if (empty($first_name) || empty($last_name) || empty($email) || empty($team) || !isset($event_configs[$post_day])) {
    die("Required fields are missing or invalid day.");
  }

  $day = $is_edit_mode ? $day : $post_day;
  $config = $event_configs[$day];

  $existing_token = $_POST['edit_token'] ?? '';
  $submission_id = null;
  $edit_token = $existing_token;

  // Handle update vs insert logic
  if ($is_edit_mode && $existing_token === $edit_token && isset($submission)) {
    // Update existing submission
    $submission_id = $submission['id'];
    $stmt = $pdo->prepare("UPDATE relay_submissions SET first_name = ?, last_name = ?, email = ?, team = ?, submitted_at = NOW() WHERE id = ? AND edit_token = ?");
    $stmt->execute([$first_name, $last_name, $email, $team, $submission_id, $edit_token]);
    $stmt = $pdo->prepare("DELETE FROM relay_entries WHERE submission_id = ?");
    $stmt->execute([$submission_id]);
  } else {
    // Create new submission with fresh edit token
    $edit_token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare("INSERT INTO relay_submissions (first_name, last_name, email, team, day, edit_token, submitted_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$first_name, $last_name, $email, $team, $day, $edit_token]);
    $submission_id = $pdo->lastInsertId();
  }

  // Helper functions for checkbox and swimmer fields
  function chk($name)
  {
    return isset($_POST[$name]) && $_POST[$name] === 'on' ? 'Yes' : 'No';
  }
  function swimmer($name)
  {
    return trim($_POST[$name] ?? '');
  }

  // Insert relay entries into database
  foreach ($config['events'] as $gender_key => $event) {
    // ... loop through lines and insert ...
    $event_id = $event['id'];
    foreach ($config['lines'] as $line_key => $line_label) {
      $scratch = chk("{$gender_key}_{$line_key}_scratch");
      $prelim  = chk("{$gender_key}_{$line_key}_prelim");
      $s1 = swimmer("{$gender_key}_{$line_key}_1");
      $s2 = swimmer("{$gender_key}_{$line_key}_2");
      $s3 = swimmer("{$gender_key}_{$line_key}_3");
      $s4 = swimmer("{$gender_key}_{$line_key}_4");

      $stmt = $pdo->prepare("INSERT INTO relay_entries (submission_id, event_id, line, scratch, swim_prelim, swimmer1, swimmer2, swimmer3, swimmer4) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
      $stmt->execute([$submission_id, $event_id, $line_label, ($scratch === 'Yes' ? 1 : 0), ($prelim === 'Yes' ? 1 : 0), $s1, $s2, $s3, $s4]);
    }
  }

  $relay_data = [];
  foreach ($config['events'] as $gender_key => $event) {
    $event_name = $event['name'];
    $relay_data[$event_name] = [];
    foreach ($config['lines'] as $line_key => $line_label) {
      $scratch = chk("{$gender_key}_{$line_key}_scratch");
      $prelim  = chk("{$gender_key}_{$line_key}_prelim");
      $s1 = swimmer("{$gender_key}_{$line_key}_1");
      $s2 = swimmer("{$gender_key}_{$line_key}_2");
      $s3 = swimmer("{$gender_key}_{$line_key}_3");
      $s4 = swimmer("{$gender_key}_{$line_key}_4");

      if ($scratch === 'Yes' || $prelim === 'Yes' || $s1 || $s2 || $s3 || $s4) {
        $relay_data[$event_name][$line_label] = [
          'Scratch'     => $scratch,
          'Swim Prelim' => $prelim,
          'Swimmer 1'   => $s1 ?: '&nbsp;',
          'Swimmer 2'   => $s2 ?: '&nbsp;',
          'Swimmer 3'   => $s3 ?: '&nbsp;',
          'Swimmer 4'   => $s4 ?: '&nbsp;',
        ];
      }
    }
  }

  $edit_url = EDIT_URL . $edit_token;
  $timezone = new DateTimeZone('-07:00');
  $submittedTime = new DateTime('now', $timezone);
  $formattedSubmitted = $submittedTime->format('Y-m-d H:i:s') . ' (UTC-7)';

  $day_cap = ucfirst($day);
  $email_body = "<html><head><title>Your $day_cap Relay Entry Confirmation</title></head><body style='font-family: Arial, sans-serif; line-height: 1.6;'>
  <h2>Thank you for your $day_cap Relay entry" . ($is_edit_mode ? " (updated)" : "") . ", {$full_name}!</h2>
  <p><strong>Team:</strong> {$team}<br><strong>Email:</strong> {$email}<br><strong>Submitted:</strong> {$formattedSubmitted}</p>
  <h3>Your Relay Entries</h3>";

  if (empty($relay_data)) {
    $email_body .= "<p><em>No relay entries were submitted.</em></p>";
  } else {
    foreach ($relay_data as $event => $lines) {
      $email_body .= "<h4>{$event}</h4><table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%; margin-bottom: 30px;'>
      <tr style='background-color: #f0f0f0;'><th>Relay</th><th>Scratch</th><th>Swim Prelim</th><th>Swimmer 1</th><th>Swimmer 2</th><th>Swimmer 3</th><th>Swimmer 4</th></tr>";
      foreach ($lines as $line => $data) {
        $email_body .= "<tr><td style='text-align: center; font-weight: bold;'>{$line}</td><td style='text-align: center;'>{$data['Scratch']}</td><td style='text-align: center;'>{$data['Swim Prelim']}</td>
        <td>{$data['Swimmer 1']}</td><td>{$data['Swimmer 2']}</td><td>{$data['Swimmer 3']}</td><td>{$data['Swimmer 4']}</td></tr>";
      }
      $email_body .= "</table>";
    }
  }

  $email_body .= "<p>If you need to make changes, use this personal edit link:</p>
  <p style='font-size: 18px;'><strong><a href='{$edit_url}'>Click here to edit your relay entry</a></strong></p>
  <p><em>Save this email — this is the only time you'll receive this link.</em></p>
  <p>Thank you for relay entries</p></body></html>";

  try {
    $client = new Client();
    $client->setApplicationName('Relay Entries');
    $client->setScopes([Sheets::SPREADSHEETS]);
    $client->setAuthConfig(GOOGLE_SHEETS_CREDENTIALS_PATH);
    $service = new Sheets($client);

    $rowsToAppend = [];
    $submitted_at = $submittedTime->format('Y-m-d H:i:s');
    $submitter_name = $first_name . ' ' . $last_name;

    foreach ($relay_data as $event_name => $lines) {
      foreach ($lines as $relay_line => $data) {
        $rowsToAppend[] = [
          ucfirst($day),
          $submitted_at,
          $submitter_name,
          $email,
          $team,
          $event_name,
          $relay_line,
          $data['Scratch'],
          $data['Swim Prelim'],
          $data['Swimmer 1'] !== '&nbsp;' ? $data['Swimmer 1'] : '',
          $data['Swimmer 2'] !== '&nbsp;' ? $data['Swimmer 2'] : '',
          $data['Swimmer 3'] !== '&nbsp;' ? $data['Swimmer 3'] : '',
          $data['Swimmer 4'] !== '&nbsp;' ? $data['Swimmer 4'] : '',
        ];
      }
    }

    if (!empty($rowsToAppend)) {
      $body = new ValueRange(['values' => $rowsToAppend]);
      $params = ['valueInputOption' => 'RAW'];
      $service->spreadsheets_values->append(GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_RANGE, $body, $params);
    }
  } catch (Exception $e) {
    error_log('Google Sheets append failed: ' . $e->getMessage());
    echo "<p><strong>Warning:</strong> Data saved, but export to Google Sheets failed. Admin notified.</p>";
  }

  $mail = new PHPMailer(true);
  try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    // Add BCC addresses from the config (supports single or multiple)
    if (isset($config['bcc']) && is_array($config['bcc'])) {
      foreach ($config['bcc'] as $bccEmail) {
        if (!empty(trim($bccEmail))) {
          $mail->addBCC(trim($bccEmail)); // Optional: add a name as second param, e.g. addBCC($bccEmail, 'Name')
        }
      }
    }

    $mail->setFrom(SMTP_USER, ucfirst($day) . ' Relays - ' . htmlspecialchars($team));
    $mail->addAddress($email, $full_name);
    //$mail->addBCC('acescsiar+relays@gmail.com');
    $mail->isHTML(true);
    $mail->Subject = ucfirst($day) . ' Relay Entry Confirmation & Edit Link - ' . $team;
    $mail->Body    = $email_body;
    $mail->send();

    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Thank You</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:50px;}h1{color:#333;}</style></head><body><h1>Thank You!</h1><p>Your relay entry has been submitted successfully.</p><p>A confirmation email with your edit link has been sent.</p></body></html>';
    exit();
  } catch (Exception $e) {
    echo "<h2>Entry submitted, but email failed.</h2><p>Error: {$mail->ErrorInfo}</p><p>You can still <a href='{$edit_url}'>edit your entry here</a>.</p>";
  }
}
?>

<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= ucfirst($day) ?> Relay <?= $is_edit_mode ? ' - Edit Entry' : '' ?></title>
  <link href="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js"></script>
  <link rel="stylesheet" href="css/relay-form.css">
</head>

<body>
  <h1><?= ucfirst($day) ?> Relay <?= $is_edit_mode ? ' - Edit Your Entry' : '' ?></h1>
  <?php if ($is_edit_mode): ?><p><strong>You are editing your previous submission.</strong></p><?php endif; ?>

  <form action="" method="POST">
    <?php if ($is_edit_mode): ?><input type="hidden" name="edit_token" value="<?= $edit_token ?>"><?php endif; ?>
    <input type="hidden" name="day" value="<?= $day ?>">

    <label for="first_name" class="required">Name</label>
    <input type="text" name="first_name" id="first_name" value="<?= $first_name ?>" placeholder="First Name" autocomplete="given-name" required>
    <input type="text" name="last_name" id="last_name" value="<?= $last_name ?>" placeholder="Last Name" autocomplete="family-name" required>

    <label for="email" class="required">Email</label>
    <input type="email" name="email" id="email" value="<?= $email ?>" placeholder="example@example.com" autocomplete="email" required>
    <p class="help-text"><strong>Important:</strong> A personal edit link will be sent to this email address after submission.</p>

    <label for="team" class="required">Team</label>
    <select name="team" required>
      <option value="">Please Select Your Team</option>
      <?php foreach ($teams as $team_name): ?>
        <option value="<?= htmlspecialchars($team_name) ?>" <?= $team === $team_name ? 'selected' : '' ?>><?= htmlspecialchars($team_name) ?></option>
      <?php endforeach; ?>
    </select>

    <?php
    function val($gender, $line, $field, $entries_index)
    {
      return $entries_index[$gender][$line][$field] ?? '';
    }
    function checked($gender, $line, $field, $entries_index)
    {
      return ($entries_index[$gender][$line][$field] ?? 0) == 1 ? 'checked' : '';
    }
    ?>

    <?php foreach ($config['events'] as $gender_key => $events_list): ?>
      <?php foreach ($events_list as $event): ?>
        <h2 class="event-title"><?= htmlspecialchars($event['name']) ?></h2>
        <table class="relay-table">
          <thead>
            <tr>
              <th>Relay</th>
              <th>Scratch</th>
              <th>Swim Prelim</th>
              <th>Swimmer 1</th>
              <th>Swimmer 2</th>
              <th>Swimmer 3</th>
              <th>Swimmer 4</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($config['lines'] as $line_key => $line_label): ?>
              <tr>
                <td data-label="Relay"><strong><?= $line_label ?></strong></td>
                <td data-label="Scratch">
                  <input type="checkbox" name="<?= $gender_key ?>_<?= $line_key ?>_scratch" <?= checked($gender_key, $line_key, 'scratch', $entries_index) ?>>
                </td>
                <td data-label="Swim Prelim">
                  <?php
                  $force_prelim = in_array($line_label, $forced_prelim_rules[$day] ?? []);
                  $is_checked = $force_prelim || (!empty($entries_index[$gender_key][$line_key]['prelim']));
                  $disabled = $force_prelim ? 'disabled' : '';
                  ?>
                  <input type="checkbox" name="<?= $gender_key ?>_<?= $line_key ?>_prelim" <?= $is_checked ? 'checked' : '' ?> <?= $disabled ?>>
                  <?php if ($force_prelim): ?>
                    <input type="hidden" name="<?= $gender_key ?>_<?= $line_key ?>_prelim" value="on">
                    <br><small style="color: #555; font-style: italic;">(Required)</small>
                  <?php endif; ?>
                </td>
                <td><input type="text" name="<?= $gender_key ?>_<?= $line_key ?>_1" value="<?= val($gender_key, $line_key, 's1', $entries_index) ?>"></td>
                <td><input type="text" name="<?= $gender_key ?>_<?= $line_key ?>_2" value="<?= val($gender_key, $line_key, 's2', $entries_index) ?>"></td>
                <td><input type="text" name="<?= $gender_key ?>_<?= $line_key ?>_3" value="<?= val($gender_key, $line_key, 's3', $entries_index) ?>"></td>
                <td><input type="text" name="<?= $gender_key ?>_<?= $line_key ?>_4" value="<?= val($gender_key, $line_key, 's4', $entries_index) ?>"></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endforeach; ?>
    <?php endforeach; ?>


    <div class="submit-btn">
      <input type="submit" value="<?= $is_edit_mode ? 'Update Entry' : 'Submit Entry' ?>">
    </div>
  </form>

  <script src="js/relay-swimmers.js"></script>

</body>

</html>