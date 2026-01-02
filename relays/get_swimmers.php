<?php
require 'config/config.php';  // Reuse your DB config

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode(['error' => 'Database connection failed']));
}

$team = $_GET['team'] ?? '';
$gender = $_GET['gender'] ?? '';  // 'women', 'men', or 'mixed'

if (empty($team)) {
    die(json_encode(['error' => 'Team required']));
}

$swimmers = [];
$query = "SELECT name FROM swimmers WHERE team = :team";
$params = [':team' => $team];

if ($gender === 'women') {
    $query .= " AND gender = 'F'";
} elseif ($gender === 'men') {
    $query .= " AND gender = 'M'";
} // For 'mixed', no gender filter (fetches both)

$stmt = $pdo->prepare($query);
$stmt->execute($params);
$swimmers = $stmt->fetchAll(PDO::FETCH_COLUMN);

header('Content-Type: application/json');
echo json_encode($swimmers);
?>