#!/usr/bin/env node
/*
    RPC client for ns4chain :: https://github.com/subnetsRU/namecoin

    (c) 2017-2018 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

var jsonRPC = require('json-rpc2');
var RPCconf = config.rpc;
var rpcClient = jsonRPC.Client.$create(RPCconf.port, RPCconf.host, RPCconf.user, RPCconf.pass);

rpc = {};

rpc.lookup = function ( obj ){
    var res = obj;
    res.error = null;
    sys.console({ level: 'debug', text: 'rpc.lookup start', obj: obj });
    if( typeof( obj.callback ) !== 'function'){
	res.error = 'rpc.lookup: Callback function not set';
	obj.callback = function(){ sys.console({level: 'error', text: res.error}); };
	obj.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
	obj.response.send();
    }

    if (sys.is_null(obj.name)){
	res.error = 'rpc.lookup: domain name is not set';
	res.errorCode = 'FORMERR';	//see node_modules/native-dns-packet/consts.js NAME_TO_RCODE
    }

    if (sys.is_null(res.error)){
	    rpcClient.call('name_show', ['d/'+obj.name], function(err, chainData) {
		sys.console({level: 'debug', text: obj.domain + ': rpc.lookup->rpcClient.call', obj: chainData});
		if (sys.is_null(err)){
		    res.chainData = chainData;
		}else{
		    //Error: "500"{"result":null,"error":{"code":-4,"message":"failed to read from name DB"},"id":1}
		    res.error = 'rpc.lookup: ' + err;
		    var regexp = /^Error:\s"(\d+)"(.*)/gi;
		    match = regexp.exec(err);
		    if (!sys.is_null(match[2])){
			try {
			    var e = JSON.parse(match[2]);
			    res.error = 'rpc.lookup: code '+e.error.code+': '+e.error.message;
			    if (e.error.code == '-4'){
				res.errorCode = 'NOTFOUND';
			    }
			}
			catch( e ){
			    sys.console({level: 'error', text: res.error});
			}
		    }
		}
		obj.callback(res);
	    });
    }else{
	obj.callback(res);
    }
}

/*
client.call('getinfo', [], function(err, result) {
    console.log('Got error:',err);
    console.log('Result',result);
});
*/

module.exports = rpc;