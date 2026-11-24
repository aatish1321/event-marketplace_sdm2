<?php

// 1. Change the case of a string.
$string = 'hello world';
echo '1a. ' . strtoupper($string) . "<br>";
echo '1b. ' . strtolower($string) . "<br>";
echo '1c. ' . ucfirst($string) . "<br>";
echo '1d. ' . ucwords($string) . "<br><br>";

// 2. Split the string into a time.
$time = '082307';
echo '2. ' . implode(':', str_split($time, 2)) . "<br><br>";

// 3. Check whether the string contains the search text.
$sentence = 'The quick brown fox jumps over the lazy dog.';
$search = 'jumps';
echo '3. ' . (strpos($sentence, $search) !== false ? 'Yes' : 'No') . "<br><br>";

// 4. Extract the file name.
$url = 'www.example.com/public_html/index.php';
echo '4. ' . basename($url) . "<br><br>";

// 5. Extract the user name from the email address.
$email = 'rayy@example.com';
echo '5. ' . explode('@', $email)[0];
