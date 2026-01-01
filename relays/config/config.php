<?php

/**
 * File: config.php
 * Description: Centralized configuration settings for Centennial District Advancement
 * Author: Richard Hall
 * License: Proprietary Software, Copyright 2024 Richard Hall
 */

defined('IN_APP') or define('IN_APP', true);
// Base path, only set once
defined('BASE_PATH') or define('BASE_PATH', dirname(__DIR__));

define('GITHUB_TOKEN', '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'); // Replace with your new token
// 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

// Environment configuration  // development
define('ENV', 'development'); // Set to 'production' on live server
// Enable error reporting in development only

if (defined('ENV') && ENV === 'development') {
    ini_set('display_errors', 1);
    ini_set('log_errors', 1);
    ini_set('error_log', BASE_PATH . '/logs');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', 'https://forms.deckmaster.us/logs/error.log');
}


// Dynamically set SITE_URL based on environment
$is_localhost = isset($_SERVER['SERVER_NAME']) && in_array($_SERVER['SERVER_NAME'], ['localhost', '127.0.0.1']);
$protocol = 'https'; // Simplified since it's always HTTPS in the original code
$host = $is_localhost ? ($_SERVER['SERVER_NAME'] ?? 'localhost') : 'centennialdistrict.co';
$port = ($is_localhost && isset($_SERVER['SERVER_PORT']) && !in_array($_SERVER['SERVER_PORT'], ['80', '443'])) ? ':' . $_SERVER['SERVER_PORT'] : '';
define('SITE_URL', $protocol . '://' . $host . $port);


// Contact email
define('CONTACT_EMAIL', 'webmaster@deckmaster.us');

// SMTP settings
define('SMTP_HOST', 'smtp.ipage.com');
define('SMTP_USER', 'webmaster@deckmaster.us');
define('SMTP_PASS', 'Bp-_E2VZKF'); 
define('SMTP_PORT', '587');

if ($is_localhost) {
    define('DB_HOST', 'localhost');
    define('DB_USER', 'root');
    define('DB_PASS', '');
    define('DB_NAME', 'relays');

    define('EDIT_URL', "https://localhost/Forms/submit_relay.php?edit=");
} else {
    define('DB_HOST', 'rhall29047217205.ipagemysql.com');
    define('DB_USER', 'relay_users');
    define('DB_PASS', 'm-ZvV7f_zJ');
    define('DB_NAME', 'relays');

     define('EDIT_URL', "https://forms.deckmaster.us/submit_relay.php?edit=");
}



// Template loader function
if (!function_exists('load_template')) {
    function load_template($file, $vars = [])
    {
        $path = BASE_PATH . $file;
        if (file_exists($path)) {
            extract($vars); // Extract variables into the current scope
            require_once $path;
        } else {
            error_log("Template $file is missing.");
            if (defined('ENV') && ENV === 'development') {
                echo 'Template ' . $path . ' is missing.</br>';
                die('Template $file is missing.');
            } else {
                die('An error occurred. Please try again later.');
            }
        }
    }
}// Class loader function
if (!function_exists('load_class')) {
    function load_class($file)
    {
        $path = $file;
        if (file_exists($path)) {
            require_once $path;
        } else {
            error_log("Class $file is missing.");
            if (defined('ENV') && ENV === 'development') {
                echo 'Template ' . $path . ' is missing.</br>';
                die('Class $file is missing.');
            } else
                die('An error occurred. Please try again later.');
        }
    }
}
