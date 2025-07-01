<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php'; // Adjust path if PHPMailer is installed via Composer

// Enable CORS to allow frontend requests
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Handle POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Retrieve form data
$recipients = json_decode($_POST['recipients'] ?? '[]', true);
$replyTo = $_POST['replyTo'] ?? '';
$subject = $_POST['subject'] ?? '';
$message = $_POST['message'] ?? '';
$attachments = $_FILES['attachments'] ?? null;

// Validate inputs
if (empty($recipients) || empty($replyTo) || empty($subject) || empty($message)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields']);
    exit;
}

// Validate reply-to email
if (!filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid reply-to email']);
    exit;
}

// Initialize PHPMailer
$mail = new PHPMailer(true);

try {
    // SMTP settings (example for Gmail)
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'your_smtp_username@gmail.com'; // Replace with your SMTP username
    $mail->Password = 'your_smtp_password'; // Replace with your SMTP password or app-specific password
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;

    // Email settings
    $mail->setFrom('your_smtp_username@gmail.com', 'Team Email Generator');
    $mail->addReplyTo($replyTo);
    $mail->Subject = $subject;
    $mail->Body = $message;
    $mail->isHTML(false); // Set to true if you want HTML emails

    // Add recipients
    foreach ($recipients as $email) {
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $mail->addAddress($email);
        }
    }

    // Handle attachments
    if ($attachments && !empty($attachments['name'][0])) {
        for ($i = 0; $i < count($attachments['name']); $i++) {
            if ($attachments['error'][$i] === UPLOAD_ERR_OK) {
                $mail->addAttachment($attachments['tmp_name'][$i], $attachments['name'][$i]);
            }
        }
    }

    // Send email
    $mail->send();
    echo json_encode(['message' => 'Email sent successfully']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send email: ' . $mail->ErrorInfo]);
}
?>