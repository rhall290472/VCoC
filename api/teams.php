<?php
// Enable CORS to allow frontend requests
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Dynamically set SITE_URL based on environment
$is_localhost = isset($_SERVER['SERVER_NAME']) && in_array($_SERVER['SERVER_NAME'], ['localhost', '127.0.0.1']);
$protocol = 'https';
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

try {
    // Connect to the database using PDO
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Query the teams table to match the schema from teams.sql
    $stmt = $pdo->query('SELECT code, fullname, TeamType, Zone FROM teams');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Structure the response to group teams by code and include all fields
    $teamDatabase = [];
    foreach ($rows as $row) {
        $team_code = $row['code'];
        $teamDatabase[$team_code] = [
            'fullname' => $row['fullname'],
            'teamType' => $row['TeamType'],
            'zone' => $row['Zone']
        ];
    }

    // Return JSON response
    echo json_encode($teamDatabase);

} catch (PDOException $e) {
    // Return error response
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
?>