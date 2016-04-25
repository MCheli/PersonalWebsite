<?php
 
$message = $_POST['message'];
$from = $_POST['email'];
$fullname = $_POST['fullname'];
$mailto = 'mpcheli7@gmail.com';
$subject = "Message From [$fullname]";
 
$headers = //"From: ".$from. " \r\n" .
"Reply-To: $from \r\n";


$ress = array('error' => NULL, 'msg' => NULL);
if (mail($mailto,$subject,$message,$headers)) {
  $ress['msg'] = "Thanks, I will get back to you ASAP";
} else {
  $ress['error'] = "error : email not sent";
} 

//respond to json
echo json_encode($ress);
