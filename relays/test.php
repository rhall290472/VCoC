<?php
// submit_relay.php - Expanded multi-day version
// Handles: Display form, new submissions, editing existing entries, detailed confirmation email for multiple days

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';
require 'config/config.php';  // Contains DB and SMTP constants

// Database connection
try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  die("Database connection failed: " . $e->getMessage());
}

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
$day = strtolower($_GET['day'] ?? '');  // Default empty for new; will validate later

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
    $day        = strtolower($submission['day']);  // Fetch day from DB
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
      // Map event_id back to gender_key (assuming unique IDs per day)
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
  // For new submissions, require day parameter
  if (!isset($event_configs[$day])) {
    die("Invalid or missing day parameter.");
  }
  // Initialize entries_index for new form
  foreach ($event_configs[$day]['events'] as $gender_key => $event) {
    $entries_index[$gender_key] = [];
    foreach ($event_configs[$day]['lines'] as $line_key => $line_label) {
      $entries_index[$gender_key][$line_key] = [];
    }
  }
}

// Get config for the current day
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

  // Use posted day for new, or DB day for edit
  $day = $is_edit_mode ? $day : $post_day;
  $config = $event_configs[$day];

  $existing_token = $_POST['edit_token'] ?? '';
  $submission_id = null;
  $edit_token = $existing_token;

  if ($is_edit_mode && $existing_token === $edit_token && isset($submission)) {
    // UPDATE existing submission
    $submission_id = $submission['id'];

    $stmt = $pdo->prepare("
            UPDATE relay_submissions 
            SET first_name = ?, last_name = ?, email = ?, team = ?, submitted_at = NOW()
            WHERE id = ? AND edit_token = ?
        ");
    $stmt->execute([$first_name, $last_name, $email, $team, $submission_id, $edit_token]);

    // Delete old entries
    $stmt = $pdo->prepare("DELETE FROM relay_entries WHERE submission_id = ?");
    $stmt->execute([$submission_id]);
  } else {
    // INSERT new submission
    $edit_token = bin2hex(random_bytes(32));

    $stmt = $pdo->prepare("
            INSERT INTO relay_submissions 
            (first_name, last_name, email, team, day, edit_token, submitted_at) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
    $stmt->execute([$first_name, $last_name, $email, $team, $day, $edit_token]);
    $submission_id = $pdo->lastInsertId();
  }

  // Helper functions (must be defined inside POST for scope)
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

  // Rebuild relay_data from POST for email tables
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
  $edit_url = EDIT_URL . $edit_token;  // e.g., 'submit_relay.php?edit='

  // Build detailed email body
  $day_cap = ucfirst($day);
  $email_body = "
    <html>
    <head><title>Your $day_cap Relay Entry Confirmation</title></head>
    <body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <h2>Thank you for your $day_cap Relay entry" . ($is_edit_mode ? " (updated)" : "") . ", {$full_name}!</h2>
    <p><strong>Team:</strong> {$team}<br>
    <strong>Email:</strong> {$email}<br>
    <strong>Submitted:</strong> " . date('Y-m-d H:i:s') . "</p>

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

    <p>Thank you for participating!</p>
    </body>
    </html>
    ";

  // Send email
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
    $mail->addBCC('acescsiar@gmail.com');

    $mail->isHTML(true);
    $mail->Subject = ucfirst($day) . ' Relay Entry Confirmation & Edit Link';
    $mail->Body    = $email_body;

    $mail->send();

    header("Location: thankyou.php");  // or full URL: https://yourdomain.com/thankyou.php
    exit();
  } catch (Exception $e) {
    echo "<h2>Entry submitted, but email failed.</h2>";
    echo "<p>Error: {$mail->ErrorInfo}</p>";
    echo "<p>You can still <a href='{$edit_url}'>edit your entry here</a>.</p>";
    echo "<p><a href='https://sites.google.com/view/western-zone-sc/home?authuser=0'>Return home</a></p>";
  }
}

// Display the form (for new or edit)
?>
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= ucfirst($day) ?> Relay <?= $is_edit_mode ? ' - Edit Entry' : '' ?></title>
  <link rel="stylesheet" href="css/relay-form.css">
</head>

<body>

  <h1><?= ucfirst($day) ?> Relay <?= $is_edit_mode ? ' - Edit Your Entry' : '' ?></h1>

  <?php if ($is_edit_mode): ?>
    <p><strong>You are editing your previous submission.</strong></p>
  <?php endif; ?>

  <form action="https://forms.deckmaster.us/submit_relay.php" method="POST">
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
      <option value="">Please Select</option>
      <option value="Team A" <?= $team === 'Team A' ? 'selected' : '' ?>>Team A</option>
      <option value="Team B" <?= $team === 'Team B' ? 'selected' : '' ?>>Team B</option>
      <!-- Add your real teams here -->
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

    <?php foreach ($config['events'] as $gender_key => $event): ?>
      <h2 class="event-title"><?= $event['name'] ?></label>
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
                  <input type="checkbox" name="<?= $gender_key ?>_<?= $key ?>_prelim" <?= checked($gender_key, $key, 'prelim', $entries_index) ?>>
                </td>
                <td data-label="Swimmer 1">
                  <input type="text" name="<?= $gender_key ?>_<?= $key ?>_1" value="<?= val($gender_key, $key, 's1', $entries_index) ?>">
                </td>
                <td data-label="Swimmer 2">
                  <input type="text" name="<?= $gender_key ?>_<?= $key ?>_2" value="<?= val($gender_key, $key, 's2', $entries_index) ?>">
                </td>
                <td data-label="Swimmer 3">
                  <input type="text" name="<?= $gender_key ?>_<?= $key ?>_3" value="<?= val($gender_key, $key, 's3', $entries_index) ?>">
                </td>
                <td data-label="Swimmer 4">
                  <input type="text" name="<?= $gender_key ?>_<?= $key ?>_4" value="<?= val($gender_key, $key, 's4', $entries_index) ?>">
                </td>
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