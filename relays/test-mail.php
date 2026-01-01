<?php
use PHPMailer\PHPMailer\PHPMailer;
require 'vendor/autoload.php';

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = 'smtp.ipage.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'webmaster@deckmaster.us';
    $mail->Password = 'Bp-_E2VZKF';
    $mail->SMTPSecure = 'tls';
    $mail->Port = 587;

    $mail->setFrom('webmaster@deckmaster.us', 'Test');
    $mail->addAddress('rhall290472@gmail.com');
    $mail->Subject = 'iPage SMTP Test';
    $mail->Body = 'If you see this, iPage SMTP works!';

    $mail->send();
    echo "Email sent successfully!";
} catch (Exception $e) {
    echo "Failed: " . $mail->ErrorInfo;
}
?>