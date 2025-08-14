<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Officials</title>
    <style>
    body {
        font-family: Arial, sans-serif;
        margin: 20px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
    }

    th,
    td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
    }

    th {
        background-color: #f2f2f2;
    }

    select,
    input[type="text"],
    input[type="email"],
    input[type="number"] {
        width: 100%;
        padding: 5px;
    }

    button {
        padding: 5px 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        cursor: pointer;
    }

    button:hover {
        background-color: #45a049;
    }

    .error {
        color: red;
    }

    .form-container {
        margin-bottom: 20px;
        padding: 15px;
        border: 1px solid #ddd;
        background-color: #f9f9f9;
    }

    .form-container h3 {
        margin-top: 0;
    }

    .filter-container {
        margin-bottom: 20px;
    }
    </style>
</head>

<body>
    <h2>Edit Officials</h2>

    <?php
  // Dynamically set SITE_URL based on environment
  $is_localhost = isset($_SERVER['SERVER_NAME']) && in_array($_SERVER['SERVER_NAME'], ['localhost', '127.0.0.1']);
  $protocol = 'https'; // Simplified since it's always HTTPS in the original code
  $host = $is_localhost ? ($_SERVER['SERVER_NAME'] ?? 'localhost') : 'centennialdistrict.co';
  $port = ($is_localhost && isset($_SERVER['SERVER_PORT']) && !in_array($_SERVER['SERVER_PORT'], ['80', '443'])) ? ':' . $_SERVER['SERVER_PORT'] : '';
  define('SITE_URL', $protocol . '://' . $host . $port);

  if ($is_localhost) {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_NAME', 'usas');
  } else {
    define('DB_HOST', 'rhall29047217205.ipagemysql.com');
    define('DB_USER', 'rhall29047217205');
    define('DB_PASS', '80016$Hall$48367');
    define('DB_NAME', 'usas');
  }

  $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
  if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
  }

  // Handle add new official
  if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['add'])) {
    $firstName = $_POST['FirstName'];
    $lastName = $_POST['LastName'];
    $prefName = $_POST['PrefName'];
    $team = $_POST['Team'];
    $email = $_POST['email'];
    $st = $_POST['ST'];
    $cj = $_POST['CJ'];
    $sr = $_POST['SR'];
    $dr = $_POST['DR'];
    $ao = $_POST['AO'];
    $ar = $_POST['AR'];

    $sql = "INSERT INTO officals (FirstName, LastName, PrefName, Team, email, ST, CJ, SR, DR, AO, AR) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
      "sssisiiiiii",
      $firstName,
      $lastName,
      $prefName,
      $team,
      $email,
      $st,
      $cj,
      $sr,
      $dr,
      $ao,
      $ar
    );
    if ($stmt->execute()) {
      echo "<p style='color: green;'>New official added successfully!</p>";
    } else {
      echo "<p class='error'>Error adding official: " . $conn->error . "</p>";
    }
    $stmt->close();
  }

  // Handle update existing official
  if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['update'])) {
    $idx = $_POST['Idx'];
    $firstName = $_POST['FirstName'];
    $lastName = $_POST['LastName'];
    $prefName = $_POST['PrefName'];
    $team = $_POST['Team'];
    $email = $_POST['email'];
    $st = $_POST['ST'];
    $cj = $_POST['CJ'];
    $sr = $_POST['SR'];
    $dr = $_POST['DR'];
    $ao = $_POST['AO'];
    $ar = $_POST['AR'];

    $sql = "UPDATE officals SET 
                FirstName = ?, LastName = ?, PrefName = ?, Team = ?, email = ?, 
                ST = ?, CJ = ?, SR = ?, DR = ?, AO = ?, AR = ? 
                WHERE Idx = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(
      "sssisiiiiiii",
      $firstName,
      $lastName,
      $prefName,
      $team,
      $email,
      $st,
      $cj,
      $sr,
      $dr,
      $ao,
      $ar,
      $idx
    );
    if ($stmt->execute()) {
      echo "<p style='color: green;'>Record updated successfully!</p>";
    } else {
      echo "<p class='error'>Error updating record: " . $conn->error . "</p>";
    }
    $stmt->close();
  }

  // Fetch teams for dropdown
  $teams = [];
  $sql = "SELECT Idx, fullname FROM teams WHERE TeamType = 'Year Round' ORDER BY fullname";
  $result = $conn->query($sql);
  if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
      $teams[$row['Idx']] = $row['fullname'];
    }
  }

  // Handle team filter
  $selectedTeam = isset($_POST['filterTeam']) && $_POST['filterTeam'] !== '' ? (int)$_POST['filterTeam'] : null;
  $sql = "SELECT * FROM officals WHERE (IsDeleted IS NULL OR IsDeleted = 0)";
  if ($selectedTeam !== null) {
    $sql .= " AND Team = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $selectedTeam);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();
  } else {
    $result = $conn->query($sql);
  }
  ?>

    <!-- Team Filter Form -->
    <div class="filter-container">
        <h3>Filter Officials by Team</h3>
        <form method="POST" action="">
            <select name="filterTeam">
                <option value="" <?php echo $selectedTeam === null ? 'selected' : ''; ?>>All Teams</option>
                <?php foreach ($teams as $teamIdx => $teamName): ?>
                <option value="<?php echo $teamIdx; ?>" <?php echo $selectedTeam === $teamIdx ? 'selected' : ''; ?>>
                    <?php echo htmlspecialchars($teamName); ?>
                </option>
                <?php endforeach; ?>
            </select>
            <button type="submit" name="filter">Filter</button>
        </form>
    </div>

    <!-- Add New Official Form -->
    <div class="form-container">
        <h3>Add New Official</h3>
        <form method="POST" action="">
            <table>
                <tr>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Preferred Name</th>
                    <th>Team</th>
                    <th>Email</th>
                    <th>ST</th>
                    <th>CJ</th>
                    <th>SR</th>
                    <th>DR</th>
                    <th>AO</th>
                    <th>AR</th>
                    <th>Action</th>
                </tr>
                <tr>
                    <td><input type="text" name="FirstName" placeholder="First Name" required></td>
                    <td><input type="text" name="LastName" placeholder="Last Name" required></td>
                    <td><input type="text" name="PrefName" placeholder="Preferred Name"></td>
                    <td>
                        <select name="Team" required>
                            <option value="" disabled selected>Select Team</option>
                            <?php foreach ($teams as $teamIdx => $teamName): ?>
                            <option value="<?php echo $teamIdx; ?>">
                                <?php echo htmlspecialchars($teamName); ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                    <td><input type="email" name="email" placeholder="Email" required></td>
                    <td><input type="number" name="ST" placeholder="ST" min="-1" max="3" value="0"></td>
                    <td><input type="number" name="CJ" placeholder="CJ" min="0" max="3" value="0"></td>
                    <td><input type="number" name="SR" placeholder="SR" min="0" max="3" value="0"></td>
                    <td><input type="number" name="DR" placeholder="DR" min="0" max="3" value="0"></td>
                    <td><input type="number" name="AO" placeholder="AO" min="0" max="3" value="0"></td>
                    <td><input type="number" name="AR" placeholder="AR" min="0" max="3" value="0"></td>
                    <td><button type="submit" name="add">Add Official</button></td>
                </tr>
            </table>
        </form>
    </div>

    <!-- Existing Officials Table -->
    <table>
        <tr>
            <th>ID</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Preferred Name</th>
            <th>Team</th>
            <th>Email</th>
            <th>ST</th>
            <th>CJ</th>
            <th>SR</th>
            <th>DR</th>
            <th>AO</th>
            <th>AR</th>
            <th>Action</th>
        </tr>
        <?php if ($result->num_rows > 0): ?>
        <?php while ($row = $result->fetch_assoc()): ?>
        <tr>
            <form method="POST" action="">
                <td><?php echo htmlspecialchars($row['Idx']); ?><input type="hidden" name="Idx"
                        value="<?php echo htmlspecialchars($row['Idx']); ?>"></td>
                <td><input type="text" name="FirstName" value="<?php echo htmlspecialchars(trim($row['FirstName'])); ?>"
                        required></td>
                <td><input type="text" name="LastName" value="<?php echo htmlspecialchars(trim($row['LastName'])); ?>"
                        required></td>
                <td><input type="text" name="PrefName" value="<?php echo htmlspecialchars(trim($row['PrefName'])); ?>">
                </td>
                <td>
                    <select name="Team" required>
                        <?php foreach ($teams as $teamIdx => $teamName): ?>
                        <option value="<?php echo $teamIdx; ?>"
                            <?php echo $row['Team'] == $teamIdx ? 'selected' : ''; ?>>
                            <?php echo htmlspecialchars($teamName); ?>
                        </option>
                        <?php endforeach; ?>
                    </select>
                </td>
                <td><input type="email" name="email" value="<?php echo htmlspecialchars(trim($row['email'])); ?>"
                        required></td>
                <td><input type="number" name="ST" value="<?php echo htmlspecialchars($row['ST']); ?>" min="-1" max="3">
                </td>
                <td><input type="number" name="CJ" value="<?php echo htmlspecialchars($row['CJ']); ?>" min="0" max="3">
                </td>
                <td><input type="number" name="SR" value="<?php echo htmlspecialchars($row['SR']); ?>" min="0" max="3">
                </td>
                <td><input type="number" name="DR" value="<?php echo htmlspecialchars($row['DR']); ?>" min="0" max="3">
                </td>
                <td><input type="number" name="AO" value="<?php echo htmlspecialchars($row['AO']); ?>" min="0" max="3">
                </td>
                <td><input type="number" name="AR" value="<?php echo htmlspecialchars($row['AR']); ?>" min="0" max="3">
                </td>
                <td><button type="submit" name="update">Update</button></td>
            </form>
        </tr>
        <?php endwhile; ?>
        <?php else: ?>
        <tr>
            <td colspan="13">No officials found</td>
        </tr>
        <?php endif; ?>
    </table>

    <?php $conn->close(); ?>
</body>

</html>