<?php

/**
 * view_entries.php - Enhanced admin view with filters
 */

require 'config/config.php';

try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
  die("Database connection failed: " . $e->getMessage());
}

// Simple password protection - CHANGE THIS!
$view_password = 'VCoC'; // ← Change to a strong password!

session_start();
if (!isset($_SESSION['relay_view_authenticated'])) {
  if (isset($_POST['password']) && $_POST['password'] === $view_password) {
    $_SESSION['relay_view_authenticated'] = true;
  } else {
?>
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relay Entries - Login</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          margin-top: 100px;
          background: #f4f4f4;
        }

        form {
          display: inline-block;
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }

        input[type="password"] {
          padding: 10px;
          font-size: 16px;
          width: 200px;
        }

        input[type="submit"] {
          padding: 10px 20px;
          font-size: 16px;
          background: #007cba;
          color: white;
          border: none;
          cursor: pointer;
        }
      </style>
    </head>

    <body>
      <h1>Relay Entries Viewer</h1>
      <form method="post">
        <p>Enter password to view entries:</p>
        <input type="password" name="password" required autofocus>
        <br><br>
        <input type="submit" value="Login">
      </form>
    </body>

    </html>
<?php
    exit;
  }
}

// Load meet config for event names and days
$meet_slug = $_GET['meet'] ?? '2026-wz-sc';
$meet_file = __DIR__ . '/config/meets/' . basename($meet_slug) . '.json';


$stmt = $pdo->prepare("
    SELECT 
        rs.id AS submission_id,
        rs.first_name,
        rs.last_name,
        rs.email,
        rs.team,
        rs.day,
        rs.submitted_at,
        re.id AS entry_id,           -- MUST HAVE THIS
        re.event_id,
        re.line,
        re.scratch,
        re.swim_prelim,
        re.mm,
        re.swimmer1,
        re.swimmer2,
        re.swimmer3,
        re.swimmer4
    FROM relay_submissions rs
    LEFT JOIN relay_entries re ON rs.id = re.submission_id
    WHERE rs.meet_slug = ?
    ORDER BY rs.submitted_at DESC, rs.team, rs.day, re.event_id, re.line
");


$stmt->execute([$meet_slug]);

$entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Load meet config for event names and days
$meet_slug = $_GET['meet'] ?? '2026-wz-sc';
$meet_file = __DIR__ . '/config/meets/' . basename($meet_slug) . '.json';

$event_names = [];
$available_days = [];
$available_teams = [];

if (file_exists($meet_file)) {
  $meet_config = json_decode(file_get_contents($meet_file), true);
  if ($meet_config && isset($meet_config['days'])) {
    $available_days = array_keys($meet_config['days']);
    foreach ($meet_config['days'] as $day_data) {
      if (isset($day_data['events'])) {
        foreach ($day_data['events'] as $gender_events) {
          foreach ((array)$gender_events as $event) {
            if (isset($event['id'], $event['name'])) {
              $event_names[$event['id']] = $event['name'];
            }
          }
        }
      }
    }
  }
}

// Extract unique teams from actual data
$teams_from_data = array_unique(array_filter(array_column($entries, 'team')));
sort($teams_from_data);
$available_teams = $teams_from_data;

?>


<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relay Entries - Full View with Column Toggle</title>
  <link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css">
  <link rel="stylesheet" href="https://cdn.datatables.net/buttons/2.4.2/css/buttons.dataTables.min.css">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f9f9f9;
    }

    h1 {
      text-align: center;
    }

    .filters {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      align-items: end;
    }

    .filter-group {
      min-width: 200px;
    }

    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }

    select,
    button {
      padding: 10px;
      font-size: 16px;
      border-radius: 4px;
      border: 1px solid #ccc;
      width: 100%;
    }

    button {
      background: #007cba;
      color: white;
      cursor: pointer;
    }

    .dataTables_wrapper .dt-buttons {
      float: left;
      margin-right: 20px;
      margin-bottom: 10px;
    }

    .scratch-yes {
      background: #ffcccc !important;
    }

    .prelim-yes {
      background: #fff3cd !important;
    }

    .logout {
      text-align: center;
      margin: 20px 0;
    }

    .mm-yes {
      background: #d0f0d0 !important;
      /* light green, or choose your color */
    }
  </style>
</head>

<body>
  <h1>All Relay Entries</h1>
  <p style="text-align:center;">
    Meet: <?= htmlspecialchars(basename($meet_slug)) ?>
    | Total lines entered: <?= count($entries) ?>
  </p>

  <div class="logout">
    <a href="?logout=1&meet=<?= urlencode($meet_slug) ?>">Logout</a>
  </div>

  <div class="filters">
    <div class="filter-group">
      <label for="dayFilter">Day</label>
      <select id="dayFilter">
        <option value="">All Days</option>
        <?php foreach ($available_days as $day): ?>
          <option value="<?= ucfirst($day) ?>"><?= ucfirst($day) ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="filter-group">
      <label for="teamFilter">Team</label>
      <select id="teamFilter">
        <option value="">All Teams</option>
        <?php foreach ($available_teams as $team): ?>
          <option value="<?= htmlspecialchars($team) ?>"><?= htmlspecialchars($team) ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <div class="filter-group">
      <label for="eventFilter">Event</label>
      <select id="eventFilter">
        <option value="">All Events</option>
        <?php foreach ($event_names as $id => $name): ?>
          <option value="<?= htmlspecialchars($name) ?>"><?= htmlspecialchars($name) ?></option>
        <?php endforeach; ?>
      </select>
    </div>

    <!-- NEW: MM Visibility Toggle – placed as the 4th filter group -->
    <div class="filter-group" style="display:flex; align-items:center; gap:8px;">
      <input type="checkbox" id="showHiddenMM">
      <label for="showHiddenMM" style="margin:0; font-weight:normal;">Show hidden MM rows</label>
    </div>


    <div class="filter-group">
      <label>&nbsp;</label> <!-- Spacer for alignment -->
      <button id="resetFilters">Reset Filters</button>
    </div>
  </div>

  <table id="entriesTable" class="display" style="width:100%">
    <thead>
      <tr>
        <th>Submitted</th>
        <th>Day</th>
        <th>Team</th>
        <th>Name</th>
        <th>Email</th>
        <th>Event</th>
        <th>Relay</th>
        <th>Scratch</th>
        <th>Swim Prelim</th>
        <th>MM <br><small>(hide when checked)</small></th> <!-- NEW COLUMN -->
        <th>Swimmer 1</th>
        <th>Swimmer 2</th>
        <th>Swimmer 3</th>
        <th>Swimmer 4</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($entries as $row): ?>
        <tr>
          <td><?= htmlspecialchars($row['submitted_at']) ?></td>
          <td><?= htmlspecialchars(ucfirst($row['day'] ?? '')) ?></td>
          <td><?= htmlspecialchars($row['team'] ?? '') ?></td>
          <td><?= htmlspecialchars(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?></td>
          <td><?= htmlspecialchars($row['email'] ?? '') ?></td>
          <td><?= htmlspecialchars($event_names[$row['event_id']] ?? 'Event ' . $row['event_id']) ?></td>
          <td><?= htmlspecialchars($row['line'] ?? '') ?></td>
          <td class="<?= $row['scratch'] ? 'scratch-yes' : '' ?>"><?= $row['scratch'] ? 'Yes' : 'No' ?></td>
          <td class="<?= $row['swim_prelim'] ? 'prelim-yes' : '' ?>"><?= $row['swim_prelim'] ? 'Yes' : 'No' ?></td>
          <td style="text-align:center; vertical-align:middle;">
            <?php if ($row['entry_id']): ?>
              <input type="checkbox"
                class="mm-checkbox"
                data-entry-id="<?= (int)$row['entry_id'] ?>"
                <?= $row['mm'] ? 'checked' : '' ?>>
            <?php else: ?>
              —
            <?php endif; ?>
          </td>
          <td><?= htmlspecialchars($row['swimmer1'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer2'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer3'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer4'] ?? '') ?></td>
        </tr> <?php endforeach; ?>
    </tbody>
  </table>

  <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
  <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
  <script src="https://cdn.datatables.net/buttons/2.4.2/js/dataTables.buttons.min.js"></script>
  <script src="https://cdn.datatables.net/buttons/2.4.2/js/buttons.colVis.min.js"></script>
  <script src="js/admin-view.js"></script>

  <script>
    const table = $('#entriesTable').DataTable({
      dom: 'Bfrtip', // Keep buttons (column visibility) and filters
      buttons: [{
        extend: 'colvis',
        text: 'Show/Hide Columns'
      }],
      order: [
        [1, 'desc']
      ], // Newest first (Submitted column)
      paging: false, // ← THIS REMOVES PAGINATION ENTIRELY
      info: false, // Optional: removes "Showing 1 to X of Y entries"
      pageLength: -1, // Still good to have
      lengthMenu: [
        [-1],
        ["All"]
      ], // Keeps the "All" option if you ever re-enable paging
      responsive: true,
      columnDefs: [{
        targets: [8, 9], // Scratch & Prelim columns (adjust if needed)
        className: 'dt-center'
      }]
    });

    // Filters
    function applyFilters() {
      table.column(1).search($('#dayFilter').val(), false, false); // Day → now column 1
      table.column(2).search($('#teamFilter').val(), true, false); // Team → column 2
      table.column(5).search($('#eventFilter').val(), false, false); // Event → column 5
      table.draw();
    }
    $('#dayFilter, #teamFilter, #eventFilter').on('change', applyFilters);

    $('#resetFilters').on('click', function() {
      $('#dayFilter, #teamFilter, #eventFilter').val('');
      table.search('').columns().search('').draw();
    });

    <?php if (isset($_GET['logout'])): ?>
      <?php session_destroy(); ?>
      window.location.href = window.location.pathname + '?meet=<?= urlencode($meet_slug) ?>';
    <?php endif; ?>
  </script>
</body>

</html>