<?php
require 'config/config.php';
header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['relay_view_authenticated'])) {
  echo json_encode(['success' => false, 'error' => 'Unauthorized']);
  exit;
}

try {
  $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
  echo json_encode(['success' => false, 'error' => 'DB connect failed']);
  exit;
}

$entry_id = $_POST['entry_id'] ?? null;
$mm = isset($_POST['mm']) ? (int)$_POST['mm'] : null;

if (!$entry_id || !in_array($mm, [0,1])) {
  echo json_encode(['success' => false, 'error' => 'Invalid data']);
  exit;
}

$stmt = $pdo->prepare("UPDATE relay_entries SET mm = ? WHERE id = ?");
$success = $stmt->execute([$mm, $entry_id]);

echo json_encode(['success' => $success]);
?>