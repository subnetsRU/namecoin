#!/usr/local/bin/php
<?php
/*
    Whois service for .bit domains (https://forum.namecoin.org/viewtopic.php?f=11&t=2654)

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Panfilov Alexey <lehis@subnets.ru>, Nikolaev Dmitry <virus@subnets.ru> 
*/

define( 'whoisVersion', '0.1.0' );

init();

if ( !defined( 'DEBUG' ) ){
    define( 'DEBUG', 0);
}

if ( DEBUG ){
    error_reporting(E_ALL);
}else{
    ini_set('display_errors', 'off');
    error_reporting( 0 );
}

$start = microtime( true );
print "\n% This is the Namecoin blockchain query service version ". whoisVersion ."\n\n";

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
	$data = rpc_request( array('method'=> "name_show", 'domain'=> $domain) );
	if( !isset($data['error']) ){
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
		    unset( $data );
		    $data = rpc_request( array('method'=> "getrawtransaction", 'txid'=> $info['txid']) );
		    if( !isset($data['error']) ){
			if( isset( $data['result'] ) && isset( $data['result']['time'] ) ){
			    print "\n";
			    print_info( gmdate("Y-m-d\TH:i:s\Z", $data['result']['time'] ), "last update on" );
			}
		    }else{
			if ( DEBUG ){
			    print "\n";
			    print_info( implode("; ",$data['error']), "last update on" );
			}
		    }
		}
	    }elseif( isset( $data['notfound'] ) ){
		print $data['notfound'] . "\n";
	    }
	}else{
	    print "ERRORS:\n\t- ".implode("\n\t- ",$data['error']);
	}
    }else{
	printf( "%% wrong format of domain name: %s\n", $domain );
    }
}
printf( "\n%% This query was served in %.3f sec\n\n", microtime( true ) - $start );

function init(){
    $errors = array();
    $path = realpath( dirname(__FILE__) );
    $path_config=$path."/whois_config.php";

    if (is_file($path_config)){
	if (!@include $path_config){
    	    $errors[]=sprintf("config file %s can not be included",$path_config);
	}
    }else{
	$errors[]=sprintf("config file %s not found",$path_config);
    }

    if ( !function_exists('curl_exec') ){
	$errors[]="CURL not found... Visit http://www.php.net/manual/ru/book.curl.php";
    }

    if (count($errors)>0){
	print "ERRORS:\n";
	printf("\t- %s\nexit...",implode("\n\t- ",$errors));
	exit;
    }
}

function rpc_request( $p = array() ){
    $ret=array();
    $err=array();
    if ( !defined( 'RPC_USER' ) || !RPC_USER ){
        $err[]="RPC user not set, check config";
    }
    if ( !defined( 'RPC_PASS' ) || !RPC_PASS ){
        $err[]="RPC password not set, check config";
    }
    if ( !defined( 'RPC_HOST' ) || !RPC_HOST ){
        $err[]="RPC host is not set, check config";
    }
    if ( !defined('RPC_PORT') || !preg_match('/^\d{1,5}$/',RPC_PORT) ){
        define( 'RPC_PORT', '8336' );
    }
    if ( !defined('RPC_TIMEOUT') || !preg_match('/^\d{1,5}$/',RPC_TIMEOUT) ){
        define( 'RPC_TIMEOUT', 15 );
    }
    
    if ( !isset($p['method']) || !$p['method']){
	$err[]="RPC method not set";
    }else{
	if ( $p['method'] == "name_show" ){
	    if ( !isset($p['domain']) || !$p['domain']){
		$err[]="Domain name not set";
	    }
	}elseif( $p['method'] == "getrawtransaction"){
	    if ( !isset($p['txid']) || !$p['txid']){
		$err[]="txid not set";
	    }
	}
    }

    if ( count($err) == 0 ){
	$request = array(
	    "jsonrpc" => "1.0",
	    "id" => microtime(true),
	    "method" => $p['method']
	);

	if ( $p['method'] == "name_show" ){
	    $request['params'] = array( sprintf("d/%s",trim($p['domain'])) );
	}elseif( $p['method'] == "getrawtransaction"){
	    $request['params'] = array( trim($p['txid']), true );
	}
	$data = @json_encode( $request );

	$curl = curl_init();
	curl_setopt( $curl, CURLOPT_URL, sprintf("http://%s:%d",RPC_HOST,RPC_PORT) );
	curl_setopt( $curl, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
	curl_setopt( $curl, CURLOPT_USERPWD, sprintf("%s:%s",RPC_USER,RPC_PASS));
	curl_setopt( $curl, CURLOPT_RETURNTRANSFER, true );
	curl_setopt( $curl, CURLOPT_TIMEOUT, RPC_TIMEOUT );
	curl_setopt( $curl, CURLOPT_HTTPHEADER, array("Content-length: ".strlen( $data ),'Content-Type: text/plain') );
	mb_internal_encoding( 'UTF-8' );
	curl_setopt( $curl, CURLOPT_POST, true );
	curl_setopt( $curl, CURLOPT_POSTFIELDS, $data );
	curl_setopt( $curl, CURLOPT_HEADER, false );
	curl_setopt( $curl, CURLOPT_USERAGENT, sprintf("WHOIS client v%s", whoisVersion) );

	if ( DEBUG && defined( 'RPC_LOG' ) ){
	    curl_setopt( $curl, CURLOPT_STDERR, RPC_LOG );
	    curl_setopt( $curl, CURLOPT_VERBOSE, true );
	}

	$curlAnswer = curl_exec( $curl );
	$httpCode = (int)curl_getinfo( $curl, CURLINFO_HTTP_CODE );
	$curlCode = curl_errno( $curl );

	if ( $curlCode ){
	    $err[]=sprintf("RPC connection error code %d %s",$curlCode,curl_error( $curl ));
	}else{
	    if ($httpCode == 401){
		$err[]=sprintf("RPC request return %d Unauthorized",$httpCode);
	    }
	    if ( count($err) == 0){
		if ( !$curlAnswer ){
		    $err[]="RPC reply was empty";
		}
	    }

	    if ( count($err) == 0){
		unset( $data );
		if( ( $data = @json_decode( $curlAnswer, true ) ) !== null ){
		    if( isset( $data['error'] ) ){
			if ( isset($data['error']['code']) && $data['error']['code'] == "-4"){
			    $ret['notfound'] = preg_replace( '/d\//', '', isset( $data['error']['message'] ) ? preg_replace( '/d\//', '', $data['error']['message'] ) : "" );
			}else{
			    if ( DEBUG ){
				$err[]=sprintf("RPC error code: %s Description: %s",isset($data['error']['code']) ? $data['error']['code'] : "unknown" , isset( $data['error']['message'] ) ? preg_replace( '/d\//', '', $data['error']['message'] ) : "none" );
			    }else{
				$err[]="RPC return error";
			    }
			}
		    }else{
			if( isset( $data['result'] ) ){
			    $ret['result'] = $data['result'];
			}else{
			    $err[]="No data received";
			}
		    }
		}else{
		    if ( DEBUG ){
			$err[]=sprintf("Data decode error code: %s Description: %s",json_last_error(),json_last_error_msg());
		    }else{
			$err[]="Received data unknown";
		    }
		}
	    }
	}
	curl_close( $curl );
    }

    if ( count($err) > 0 ){
	$ret['error']=$err;
    }
 return $ret;
}

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