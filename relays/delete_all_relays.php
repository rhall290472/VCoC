<?php
require 'config/config.php';
header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['relay_view_authenticated'])) {
  echo json_encode(['success' => false, 'error' => 'Unauthorized']);
  exit;
}

$meet_slug = $_POST['meet'] ?? '';

if (!$meet_slug) {
  echo json_encode(['success' => false, 'error' => 'No meet specified']);
  exit;
}

try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // Delete all relay_entries for this meet
  $stmt = $pdo->prepare("
    DELETE re FROM relay_entries re
    INNER JOIN relay_submissions rs ON re.submission_id = rs.id
    WHERE rs.meet_slug = ?
  ");
  $stmt->execute([$meet_slug]);

  // Optionally also delete submissions if you want everything gone
  $stmt2 = $pdo->prepare("DELETE FROM relay_submissions WHERE meet_slug = ?");
  $stmt2->execute([$meet_slug]);

  echo json_encode(['success' => true, 'deleted' => $stmt->rowCount()]);
} catch (Exception $e) {
  echo json_encode(['success' => false, 'error' => 'Database error']);
}
?>