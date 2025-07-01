<?php
// Enable CORS to allow frontend requests
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Database configuration
$host = '127.0.0.1';
$dbname = 'email_generator';
$user = 'root'; // Replace with your MySQL username
$pass = ''; // Replace with your MySQL password

try {
    // Connect to the database using PDO
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Query the teams table
    $stmt = $pdo->query('SELECT team_name, emails FROM teams');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group emails by team_name
    $teamDatabase = [];
    foreach ($rows as $row) {
        $team_name = $row['team_name'];
        if (!isset($teamDatabase[$team_name])) {
            $teamDatabase[$team_name] = [];
        }
        $teamDatabase[$team_name][] = $row['emails'];
    }

    // Return JSON response
    echo json_encode($teamDatabase);

} catch (PDOException $e) {
    // Return error response
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' + $e->getMessage()]);
}
?>