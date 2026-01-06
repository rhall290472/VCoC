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

// Fetch all data
$stmt = $pdo->query("
    SELECT 
        rs.id AS submission_id,
        rs.first_name,
        rs.last_name,
        rs.email,
        rs.team,
        rs.day,
        rs.submitted_at,
        re.event_id,
        re.line,
        re.scratch,
        re.swim_prelim,
        re.swimmer1,
        re.swimmer2,
        re.swimmer3,
        re.swimmer4
    FROM relay_submissions rs
    LEFT JOIN relay_entries re ON rs.id = re.submission_id
    ORDER BY rs.submitted_at DESC, rs.team, rs.day, re.event_id, re.line
");

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

    td.details-control {
      cursor: pointer;
      text-align: center;
      font-weight: bold;
      color: #007cba;
    }

    td.details-control::before {
      content: '▶ ';
    }

    tr.shown td.details-control::before {
      content: '▼ ';
    }

    table.child-details {
      width: 100%;
      background: #f5f5f5;
      margin: 10px 0;
    }

    table.child-details td {
      padding: 8px;
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

  <!-- Filters -->
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
    <div class="filter-group">
      <button id="resetFilters">Reset Filters</button>
    </div>
  </div>

  <table id="entriesTable" class="display" style="width:100%">
    <thead>
      <tr>
        <th></th> <!-- Expand control -->
        <th>Submitted</th>
        <th>Day</th>
        <th>Team</th>
        <th>Name</th>
        <th>Email</th>
        <th>Event</th>
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
      <?php foreach ($entries as $row): ?>
        <tr>
          <td class="details-control"></td>
          <td><?= htmlspecialchars($row['submitted_at']) ?></td>
          <td><?= htmlspecialchars(ucfirst($row['day'] ?? '')) ?></td>
          <td><?= htmlspecialchars($row['team'] ?? '') ?></td>
          <td><?= htmlspecialchars(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?></td>
          <td><?= htmlspecialchars($row['email'] ?? '') ?></td>
          <td><?= htmlspecialchars($event_names[$row['event_id']] ?? 'Event ' . $row['event_id']) ?></td>
          <td><?= htmlspecialchars($row['line'] ?? '') ?></td>
          <td class="<?= $row['scratch'] ? 'scratch-yes' : '' ?>"><?= $row['scratch'] ? 'Yes' : 'No' ?></td>
          <td class="<?= $row['swim_prelim'] ? 'prelim-yes' : '' ?>"><?= $row['swim_prelim'] ? 'Yes' : 'No' ?></td>
          <td><?= htmlspecialchars($row['swimmer1'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer2'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer3'] ?? '') ?></td>
          <td><?= htmlspecialchars($row['swimmer4'] ?? '') ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>

  <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
  <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
  <script src="https://cdn.datatables.net/buttons/2.4.2/js/dataTables.buttons.min.js"></script>
  <script src="https://cdn.datatables.net/buttons/2.4.2/js/buttons.colVis.min.js"></script>

  <script>
    function formatSwimmers(d) {
      // d is the row data array
      return '<table class="child-details" cellpadding="5" cellspacing="0">' +
        '<tr><td><strong>Swimmer 1:</strong></td><td>' + (d[10] || '<em>—</em>') + '</td></tr>' +
        '<tr><td><strong>Swimmer 2:</strong></td><td>' + (d[11] || '<em>—</em>') + '</td></tr>' +
        '<tr><td><strong>Swimmer 3:</strong></td><td>' + (d[12] || '<em>—</em>') + '</td></tr>' +
        '<tr><td><strong>Swimmer 4:</strong></td><td>' + (d[13] || '<em>—</em>') + '</td></tr>' +
        '</table>';
    }

    $(document).ready(function() {
      const table = $('#entriesTable').DataTable({
        dom: 'Bfrtip',
        buttons: [{
          extend: 'colvis',
          text: 'Show/Hide Columns',
          columns: ':gt(0)' // All columns except the expand arrow
        }],
        order: [
          [1, 'desc']
        ], // newest first
        pageLength: -1,
        lengthMenu: [[-1], ["All"]],
        responsive: true,
        columnDefs: [{
            targets: 0,
            orderable: false
          }, // expand column
          {
            targets: [8, 9],
            className: 'dt-center'
          } // Scratch & Prelim
        ]
      });

      // Expand/collapse row details
      $('#entriesTable tbody').on('click', 'td.details-control', function() {
        const tr = $(this).closest('tr');
        const row = table.row(tr);

        if (row.child.isShown()) {
          row.child.hide();
          tr.removeClass('shown');
        } else {
          row.child(formatSwimmers(row.data())).show();
          tr.addClass('shown');
        }
      });

      // Optional: click anywhere on row to expand
      $('#entriesTable tbody').on('click', 'tr td:not(.details-control)', function() {
        $(this).parent().find('td.details-control').click();
      });

      // Filters
      function applyFilters() {
        table.column(2).search($('#dayFilter').val(), false, false); // Day
        table.column(3).search($('#teamFilter').val(), true, false); // Team
        table.column(6).search($('#eventFilter').val(), false, false); // Event
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
    });
  </script>
</body>

</html>