<?php
header('Content-Type: application/json');

// Database configuration
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

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    echo json_encode(['success' => false, 'error' => 'Connection failed: ' . $conn->connect_error]);
    exit();
}

$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');

if ($action === 'get_teams') {
    // Fetch teams for dropdown
    $teams = [];
    $sql = "SELECT Idx, fullname FROM teams WHERE TeamType = 'Year Round' ORDER BY fullname";
    $result = $conn->query($sql);
    if ($result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            $teams[] = $row;
        }
        echo json_encode(['success' => true, 'teams' => $teams]);
    } else {
        echo json_encode(['success' => false, 'error' => 'No teams found']);
    }
} elseif ($action === 'send_email') {
    // Handle email sending
    $team_ids = isset($_POST['teams']) ? array_map('intval', (array)$_POST['teams']) : [];
    $reply_to = isset($_POST['reply_to']) ? $_POST['reply_to'] : '';
    $subject = isset($_POST['subject']) ? $_POST['subject'] : '';
    $email_message = isset($_POST['message']) ? $_POST['message'] : '';

    // Validate input
    if (empty($team_ids)) {
        echo json_encode(['success' => false, 'error' => 'Please select at least one team.']);
        exit();
    }
    if (empty($reply_to) || !filter_var($reply_to, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'Please enter a valid reply-to email address.']);
        exit();
    }
    if (empty($subject)) {
        echo json_encode(['success' => false, 'error' => 'Please enter an email subject.']);
        exit();
    }
    if (empty($email_message)) {
        echo json_encode(['success' => false, 'error' => 'Please enter an email message.']);
        exit();
    }

    // Fetch email addresses for selected teams
    $emails = [];
    $placeholders = implode(',', array_fill(0, count($team_ids), '?'));
    $sql = "SELECT email FROM officals WHERE Team IN ($placeholders) AND (IsDeleted IS NULL OR IsDeleted = 0)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param(str_repeat('i', count($team_ids)), ...$team_ids);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $emails[] = $row['email'];
    }
    $stmt->close();

    if (empty($emails)) {
        echo json_encode(['success' => false, 'error' => 'No officials found for the selected teams.']);
        exit();
    }

    // Handle file attachments
    $attachments = [];
    if (!empty($_FILES['attachments']['name'][0])) {
        foreach ($_FILES['attachments']['tmp_name'] as $index => $tmp_name) {
            if ($_FILES['attachments']['error'][$index] === UPLOAD_ERR_OK) {
                $file_name = $_FILES['attachments']['name'][$index];
                $file_tmp = $_FILES['attachments']['tmp_name'][$index];
                $allowed_types = ['application/pdf', 'application/msword', 'text/plain', 'image/jpeg', 'image/png'];
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mime = finfo_file($finfo, $file_tmp);
                finfo_close($finfo);

                if (in_array($mime, $allowed_types)) {
                    $attachments[] = [
                        'name' => $file_name,
                        'tmp_name' => $file_tmp
                    ];
                }
            }
        }
    }

    // Send emails
    $boundary = md5(time());
    $headers = "From: no-reply@centennialdistrict.co\r\n";
    $headers .= "Reply-To: $reply_to\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

    $body = "--$boundary\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $email_message . "\r\n";

    foreach ($attachments as $attachment) {
        $file_content = file_get_contents($attachment['tmp_name']);
        $file_content = chunk_split(base64_encode($file_content));
        $body .= "--$boundary\r\n";
        $body .= "Content-Type: application/octet-stream; name=\"{$attachment['name']}\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= "Content-Disposition: attachment; filename=\"{$attachment['name']}\"\r\n\r\n";
        $body .= "$file_content\r\n";
    }
    $body .= "--$boundary--";

    $success_count = 0;
    foreach ($emails as $email) {
        if (mail($email, $subject, $body, $headers)) {
            $success_count++;
        }
    }

    echo json_encode(['success' => true, 'success_count' => $success_count]);
}

$conn->close();
?>