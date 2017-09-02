#!/usr/local/bin/php
<?php
/*
    Whois service for .bit domains (https://forum.namecoin.org/viewtopic.php?f=11&t=2654)

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Panfilov Alexey <lehis@subnets.ru>, Nikolaev Dmitry <virus@subnets.ru> 
*/

ini_set('display_errors', 'off');
error_reporting( 0 );
$start = microtime( true );
$version = '0.0.2';
define( 'CURL_USER', 'rpc_username' );
define( 'CURL_PASS', 'rpc_password' );
define( 'CURL_IP', 'localhost' );
define( 'CURL_PORT', '8336' );
print "\n% This is the Namecoin blockchain query service version $version\n\n";

$stdin = fopen('php://stdin', 'r');
while (!feof($stdin)) {
    $temp = fgets($stdin);
    $temp = str_replace("\n","",$temp);
    $tmp = trim($temp);
    break;
}

if( isset( $tmp ) ){
    $domain = strtolower( $tmp );
    if( count( explode( ".",$domain ) ) > 1 ){
	$tmp = explode( ".",$domain );
	$domain = $tmp[count( $tmp ) - 2];
    }
    if( preg_match( '/^[a-z]([a-z0-9-]{0,62}[a-z0-9])?$/', $domain ) ){
	print "% Information related to $domain.bit\n\n";
	$cmd = sprintf( "/usr/local/bin/curl -s --user %s:%s --data-binary '{\"jsonrpc\":\"1.0\",\"id\":\"%s\",\"method\":\"name_show\",\"params\":[\"d/%s\"]}' -H 'content-type: text/plain;' http://%s:%d", CURL_USER, CURL_PASS, microtime(true),escapeshellcmd( $domain ), CURL_IP, CURL_PORT );
	$out = array( );
	@exec( $cmd, $out, $res );
	if( !$res ){
	    if( count( $out ) == 1 ){
		if( ( $data = @json_decode( $out[0], true ) ) !== null ){
		    if( isset( $data['result'] ) ){
			$info=$data['result'];
			print_info( sprintf( "%s.bit", $domain ), 'domain' );
			if( isset( $info['name'] ) ){
			    print_info( $info['name'], 'name' );
			}
			if( isset( $info['expired'] ) ){
			    print_info( ( $info['expired'] === true ? "exprired" : "registered" ), 'status' );
			}
			if( isset( $info['expires_in'] ) ){
			    print_info( sprintf( "%s blocks",$info['expires_in'] ), 'expires in' );
			}
			if( isset( $info['value'] ) ){
			    $value = @json_decode(trim(preg_replace("/:\"\[/",":[",preg_replace("/\"\]\"/","\"]",$info['value']))),true,512);
			    //print json_last_error().json_last_error_msg()."<=JSERR\n";
			    if ($value && is_array($value)){
				if (isset($value['email'])){
				    print_info( $value['email'], 'email' );
				}
				if (isset($value['info'])){
				    print_info( $value['info'], 'info' );
				}
				if (isset($value['loc'])){
				    print_info( $value['loc'], 'geo loc' );
				}
				if (isset($value['tor'])){
				    print_info( $value['tor'], 'tor' );
				}
				if (isset($value['ns'])){
				    print_info( $value['ns'], 'nameserver' );
				}
			    }else{
				print_info( $info['value'], 'info' );
			    }
			}
			if( isset( $info['address'] ) ){
			    print_info( $info['address'], 'address' );
			}
			if( isset( $info['height'] ) ){
			    print_info( $info['height'], 'height' );
			}
			if( isset( $info['txid'] ) ){
			    print_info( $info['txid'], 'txid' );
			    $cmd = sprintf( "/usr/local/bin/curl -s --user %s:%s --data-binary '{\"jsonrpc\":\"1.0\",\"id\":\"%s\",\"method\":\"getrawtransaction\", \"params\": [\"%s\", true] }' -H 'content-type: text/plain;' http://%s:%d", CURL_USER, CURL_PASS, microtime(true),escapeshellcmd( $info['txid'] ), CURL_IP, CURL_PORT );
			    $out = array( );
			    @exec( $cmd, $out, $res );
			    if( !$res ){
				if( count( $out ) == 1 ){
				    if( ( $tmp = @json_decode( $out[0], true ) ) !== null ){
					if( isset( $tmp['result'] ) && isset( $tmp['result']['time'] ) ){
					    print "\n";
					    print_info( gmdate("Y-m-d\TH:i:s\Z", $tmp['result']['time'] ), "last update on" );
					}
				    }
				}
			    }
			}
			//var_dump( $data['result'] );
		    }elseif( isset( $data['error'] ) && isset( $data['error']['message'] ) ){
			print preg_replace( '/d\//', '', $data['error']['message'] ) . "\n";
		    }
		}
	    }
	}
    }else{
	printf( "%% wrong format of domain name: %s\n", $domain );
    }
}
printf( "\n%% This query was served in %.3f sec\n\n", microtime( true ) - $start );

function print_info( $value, $sub='' ){
    if( ( $text =  @json_decode( $value, true, 512 ) ) === null ){
	$text = $value;
    }
    if( is_array( $text ) ){
	foreach( $text as $k => $val ){
	    if( preg_match( '/^\d+$/', $k ) ){
		print_info( $val, sprintf( "%s", $sub ) );
	    }else{
		print_info( $val, sprintf( "%s", $k ) );
	    }
	}
    }else{
	printf( "% -18s", sprintf( "%s:", $sub ) );
	printf( "%s\n", $value );
    }
}
?>