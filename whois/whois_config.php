<?php
/*
    Configuration file: whois service for .bit domains

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Panfilov Alexey <lehis@subnets.ru>, Nikolaev Dmitry <virus@subnets.ru> 
*/

define( 'DEBUG', 0 );			//0 - debug is off; 1 - debug is on
define( 'RPC_USER', 'username' );
define( 'RPC_PASS', 'password' );
define( 'RPC_HOST', '127.0.0.1' );
define( 'RPC_PORT', '8336' );
define( 'RPC_TIMEOUT', 10 );
//define( 'RPC_LOG', @fopen( realpath( dirname(__FILE__) )."/rpc.log", 'a+' ) );

?>