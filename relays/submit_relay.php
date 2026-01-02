<?php
// submit_relay.php - Expanded multi-day version
// Handles: Display form, new submissions, editing existing entries, detailed confirmation email, and Google Sheets export

error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// At the top, replace any old Google use statements with these:
use Google\Client;
use Google\Service\Sheets;
use Google\Service\Sheets\ValueRange;

require 'vendor/autoload.php';
require 'config/config.php';  // Contains DB and SMTP constants

// ---------- Google Sheets Configuration ----------
define('GOOGLE_SHEETS_SPREADSHEET_ID', '1MD_npqt5_0Uvq02-WNVQy6ZQ3d2YoVHMKMg_CfnPxPE');
define('GOOGLE_SHEETS_CREDENTIALS_PATH', __DIR__ . '/config/relay-credentials.json'); // Absolute path for reliability
define('GOOGLE_SHEETS_RANGE', 'Sheet1!A:M');

// Database connection
try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  die("Database connection failed: " . $e->getMessage());
}

$stmt = $pdo->query("SELECT name FROM teams ORDER BY name ASC");
$teams = $stmt->fetchAll(PDO::FETCH_COLUMN);

// Define event configurations per day
$event_configs = [
  'thursday' => [
    'events' => [
      'women' => ['id' => 7, 'name' => 'Event 9 Women 200 Medley Relay'],
      'men' => ['id' => 8, 'name' => 'Event 10 Men 200 Medley Relay'],
    ],
    'lines' => ['a' => 'A', 'b' => 'B', 'c' => 'C'],
  ],
  'friday' => [
    'events' => [
      'women' => ['id' => 15, 'name' => 'Event 19 Women 200 Freestyle Relay'],
      'men' => ['id' => 16, 'name' => 'Event 20 Men 200 Freestyle Relay'],
    ],
    'lines' => ['a' => 'A', 'b' => 'B', 'c' => 'C'],
  ],
  'saturday' => [
    'events' => [
      'mixed' => ['id' => 23, 'name' => 'Event 29 200 Mixed Medley Relay'],
    ],
    'lines' => ['a' => 'A', 'b' => 'B', 'c' => 'C', 'd' => 'D', 'e' => 'E', 'f' => 'F'],
  ],
  'sunday' => [
    'events' => [
      'mixed' => ['id' => 32, 'name' => 'Event 38 200 Mixed Freestyle Relay'],
    ],
    'lines' => ['a' => 'A', 'b' => 'B', 'c' => 'C', 'd' => 'D', 'e' => 'E', 'f' => 'F'],
  ],
];

// Edit mode variables
$edit_token = $_GET['edit'] ?? '';
$is_edit_mode = false;
$first_name = $last_name = $email = $team = '';
$day = strtolower($_GET['day'] ?? '');

// Initialize empty structure for new forms
$entries_index = [];

// Fetch submission if edit mode
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

    // Rebuild index from DB for pre-filling
    $entries_index = [];
    foreach ($event_configs[$day]['events'] as $gender_key => $event) {
      $entries_index[$gender_key] = [];
      foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
        $entries_index[$gender_key][$line_key] = [];
      }
    }

    foreach ($entries as $row) {
      foreach ($event_configs[$day]['events'] as $gender_key => $event) {
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
          break;
        }
      }
    }
  } else {
    echo "<h2>Sorry – this edit link is no longer valid.</h2>";
    exit;
  }
} else {
  if (!isset($event_configs[$day])) {
    die("Invalid or missing day parameter.");
  }
  foreach ($event_configs[$day]['events'] as $gender_key => $event) {
    $entries_index[$gender_key] = [];
    foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
      $entries_index[$gender_key][$line_key] = [];
    }
  }
}

$config = $event_configs[$day];

// Process form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

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

  if ($is_edit_mode && $existing_token === $edit_token && isset($submission)) {
    $submission_id = $submission['id'];

    $stmt = $pdo->prepare("
            UPDATE relay_submissions 
            SET first_name = ?, last_name = ?, email = ?, team = ?, submitted_at = NOW()
            WHERE id = ? AND edit_token = ?
        ");
    $stmt->execute([$first_name, $last_name, $email, $team, $submission_id, $edit_token]);

    $stmt = $pdo->prepare("DELETE FROM relay_entries WHERE submission_id = ?");
    $stmt->execute([$submission_id]);
  } else {
    $edit_token = bin2hex(random_bytes(32));

    $stmt = $pdo->prepare("
            INSERT INTO relay_submissions 
            (first_name, last_name, email, team, day, edit_token, submitted_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
    $stmt->execute([$first_name, $last_name, $email, $team, $day, $edit_token]);
    $submission_id = $pdo->lastInsertId();
  }

  // Helper functions
  function chk($name)
  {
    return isset($_POST[$name]) && $_POST[$name] === 'on' ? 'Yes' : 'No';
  }
  function swimmer($name)
  {
    return trim($_POST[$name] ?? '');
  }

  // Save relay entries to database
  foreach ($config['events'] as $gender_key => $event) {
    $event_id = $event['id'];
    $lines = $config['lines'];

    foreach ($lines as $line_key => $line_label) {
      $scratch = chk("{$gender_key}_{$line_key}_scratch");
      $prelim  = chk("{$gender_key}_{$line_key}_prelim");
      $s1 = swimmer("{$gender_key}_{$line_key}_1");
      $s2 = swimmer("{$gender_key}_{$line_key}_2");
      $s3 = swimmer("{$gender_key}_{$line_key}_3");
      $s4 = swimmer("{$gender_key}_{$line_key}_4");

      $stmt = $pdo->prepare("
                INSERT INTO relay_entries 
                (submission_id, event_id, line, scratch, swim_prelim, swimmer1, swimmer2, swimmer3, swimmer4)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
      $stmt->execute([
        $submission_id,
        $event_id,
        $line_label,
        ($scratch === 'Yes' ? 1 : 0),
        ($prelim === 'Yes' ? 1 : 0),
        $s1,
        $s2,
        $s3,
        $s4
      ]);
    }
  }

  // Rebuild relay_data from POST for email and Google Sheets
  $relay_data = [];
  foreach ($config['events'] as $gender_key => $event) {
    $event_name = $event['name'];
    $lines = $config['lines'];
    $relay_data[$event_name] = [];

    foreach ($lines as $line_key => $line_label) {
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

  // Edit URL
  $edit_url = EDIT_URL . $edit_token;
  // Build detailed email body
  $day_cap = ucfirst($day);
  // Fixed UTC-7 timezone (no DST, always 7 hours behind UTC)
  $timezone = new DateTimeZone('-07:00');  // or 'UTC-7' works too MST
  // Get current time in UTC-7
  $submittedTime = new DateTime('now', $timezone);
  // Format for display
  $formattedSubmitted = $submittedTime->format('Y-m-d H:i:s').' (UTC-7)';

  $email_body = "
    <html>
    <head><title>Your $day_cap Relay Entry Confirmation</title></head>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <h2>Thank you for your $day_cap Relay entry" . ($is_edit_mode ? " (updated)" : "") . ", {$full_name}!</h2>
    <p><strong>Team:</strong> {$team}<br>
    <strong>Email:</strong> {$email}<br>
    <strong>Submitted:</strong> {$formattedSubmitted}</p>

    <h3>Your Relay Entries</h3>
    ";

  if (empty($relay_data)) {
    $email_body .= "<p><em>No relay entries were submitted.</em></p>";
  } else {
    foreach ($relay_data as $event => $lines) {
      $email_body .= "<h4>{$event}</h4>
            <table border='1' cellpadding='8' cellspacing='0' style='border-collapse: collapse; width: 100%; margin-bottom: 30px;'>
                <tr style='background-color: #f0f0f0;'>
                    <th>Relay</th><th>Scratch</th><th>Swim Prelim</th>
                    <th>Swimmer 1</th><th>Swimmer 2</th><th>Swimmer 3</th><th>Swimmer 4</th>
                </tr>";

      foreach ($lines as $line => $data) {
        $email_body .= "<tr>
                    <td style='text-align: center; font-weight: bold;'>{$line}</td>
                    <td style='text-align: center;'>{$data['Scratch']}</td>
                    <td style='text-align: center;'>{$data['Swim Prelim']}</td>
                    <td>{$data['Swimmer 1']}</td>
                    <td>{$data['Swimmer 2']}</td>
                    <td>{$data['Swimmer 3']}</td>
                    <td>{$data['Swimmer 4']}</td>
                </tr>";
      }
      $email_body .= "</table>";
    }
  }

  $email_body .= "
    <p>If you need to make changes, use this personal edit link:</p>
    <p style='font-size: 18px;'><strong><a href='{$edit_url}'>Click here to edit your relay entry</a></strong></p>
    <p><em>Save this email — this is the only time you'll receive this link.</em></p>

    <p>Thank you for relay entries</p>
    </body>
    </html>
    ";

  // ==================== GOOGLE SHEETS EXPORT ====================
  try {
    $client = new Client();
    $client->setApplicationName('Relay Entries');
    $client->setScopes([Sheets::SPREADSHEETS]);
    $client->setAuthConfig(GOOGLE_SHEETS_CREDENTIALS_PATH);

    $service = new Sheets($client);

    $rowsToAppend = [];
    $submitted_at = date('Y-m-d H:i:s');
    $submitter_name = $first_name . ' ' . $last_name;

    foreach ($relay_data as $event_name => $lines) {
      foreach ($lines as $relay_line => $data) {
        $row = [
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
        $rowsToAppend[] = $row;
      }
    }

    if (!empty($rowsToAppend)) {
      $body = new ValueRange([
        'values' => $rowsToAppend
      ]);

      $params = [
        'valueInputOption' => 'RAW'
      ];

      // Modern correct call – works perfectly with v2.18.0
      $service->spreadsheets_values->append(
        GOOGLE_SHEETS_SPREADSHEET_ID,
        GOOGLE_SHEETS_RANGE,
        $body,
        $params
      );
    }
  } catch (Exception $e) {
    error_log('Google Sheets append failed: ' . $e->getMessage());
    echo "<p><strong>Warning:</strong> Data saved, but export to Google Sheets failed. Admin notified.</p>";
  }
  // ============================================================


  // Send confirmation email
  $mail = new PHPMailer(true);

  try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    $mail->setFrom(SMTP_USER, 'WZ SC ' . ucfirst($day) . ' Relays - ' . htmlspecialchars($team));
    $mail->addAddress($email, $full_name);
    $mail->addBCC('acescsiar+relays@gmail.com');

    $mail->isHTML(true);
    $mail->Subject = ucfirst($day) . ' Relay Entry Confirmation & Edit Link - ' . $team;
    $mail->Body    = $email_body;

    $mail->send();

    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>Thank You!</h1>
    <p>Your relay entry has been submitted successfully.</p>
    <p>A confirmation email with your edit link has been sent.</p>
</body>
</html>';
    exit();
  } catch (Exception $e) {
    echo "<h2>Entry submitted, but email failed.</h2>";
    echo "<p>Error: {$mail->ErrorInfo}</p>";
    echo "<p>You can still <a href='{$edit_url}'>edit your entry here</a>.</p>";
    echo "<p><a href='https://sites.google.com/view/western-zone-sc/home?authuser=0'>Return home</a></p>";
  }
}

// ==================== DISPLAY FORM ====================
// (The rest of your HTML form remains exactly as before)
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

  <?php if ($is_edit_mode): ?>
    <p><strong>You are editing your previous submission.</strong></p>
  <?php endif; ?>

  <form action="" method="POST">
    <?php if ($is_edit_mode): ?>
      <input type="hidden" name="edit_token" value="<?= $edit_token ?>">
    <?php endif; ?>
    <input type="hidden" name="day" value="<?= $day ?>">

    <label for="first_name" class="required">Name</label>
    <input type="text" name="first_name" value="<?= $first_name ?>" placeholder="First Name" required>
    <input type="text" name="last_name" value="<?= $last_name ?>" placeholder="Last Name" required>

    <label for="email" class="required">Email</label>
    <input type="email" name="email" id="email" value="<?= $email ?>" placeholder="example@example.com" required>
    <p class="help-text">
      <strong>Important:</strong> A personal edit link will be sent to this email address after submission.
      This is the <em>only</em> way to make changes later — please use an email you can access!
    </p>

    <label for="team" class="required">Team</label>
    <select name="team" required>
      <option value="">Please Select Your Team</option>
      <?php foreach ($teams as $team_name): ?>
        <option value="<?= htmlspecialchars($team_name) ?>" <?= $team === $team_name ? 'selected' : '' ?>>
          <?= htmlspecialchars($team_name) ?>
        </option>
      <?php endforeach; ?>
    </select>
    <script>
      new TomSelect('select[name="team"]', {
        maxOptions: null,
        searchField: ['text']
      });
    </script>

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

    <?php foreach ($config['events'] as $gender_key => $event): ?>
      <h2 class="event-title"><?= $event['name'] ?></h2>
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
          <?php foreach ($config['lines'] as $key => $label): ?>
            <tr>
              <td data-label="Relay"><strong><?= $label ?></strong></td>
              <td data-label="Scratch">
                <input type="checkbox" name="<?= $gender_key ?>_<?= $key ?>_scratch" <?= checked($gender_key, $key, 'scratch', $entries_index) ?>>
              </td>
              <td data-label="Swim Prelim">
                <?php
                $force_prelim = in_array($day, ['thursday', 'friday']) && ($label === 'C') ||
                  in_array($day, ['saturday', 'sunday']) && in_array($label, ['E', 'F']);

                $is_checked = $force_prelim || (!empty($entries_index[$gender_key][$key]['prelim']));
                $disabled = $force_prelim ? 'disabled' : '';
                ?>
                <input type="checkbox" name="<?= $gender_key ?>_<?= $key ?>_prelim" <?= $is_checked ? 'checked' : '' ?> <?= $disabled ?>>
                <?php if ($force_prelim): ?>
                  <input type="hidden" name="<?= $gender_key ?>_<?= $key ?>_prelim" value="on">
                  <br><small style="color: #555; font-style: italic;">(Required)</small>
                <?php endif; ?>
              </td>
              <td data-label="Swimmer 1"><input type="text" name="<?= $gender_key ?>_<?= $key ?>_1" value="<?= val($gender_key, $key, 's1', $entries_index) ?>"></td>
              <td data-label="Swimmer 2"><input type="text" name="<?= $gender_key ?>_<?= $key ?>_2" value="<?= val($gender_key, $key, 's2', $entries_index) ?>"></td>
              <td data-label="Swimmer 3"><input type="text" name="<?= $gender_key ?>_<?= $key ?>_3" value="<?= val($gender_key, $key, 's3', $entries_index) ?>"></td>
              <td data-label="Swimmer 4"><input type="text" name="<?= $gender_key ?>_<?= $key ?>_4" value="<?= val($gender_key, $key, 's4', $entries_index) ?>"></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    <?php endforeach; ?>

    <div class="submit-btn">
      <input type="submit" value="<?= $is_edit_mode ? 'Update Entry' : 'Submit Entry' ?>">
    </div>
  </form>
</body>

</html>