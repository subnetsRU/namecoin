#!/usr/bin/env node
/*
    RPC client for ns4chain :: https://github.com/subnetsRU/namecoin

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

var jsonRPC = require('json-rpc2');
var RPCconf = config.rpc;
var rpcClient = jsonRPC.Client.$create(RPCconf.port, RPCconf.host, RPCconf.user, RPCconf.pass);

rpc = {};
var zoneData = {};

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
	res.error = 'domain name is not set';
	res.errorCode = 'FORMERR';	//see node_modules/native-dns-packet/consts.js NAME_TO_RCODE
    }

    if (sys.is_null(res.error)){
	    rpcClient.call('name_show', ['d/'+obj.name], function(err, chainData) {
		sys.console({level: 'debug', text: 'rpc.lookup->rpcClient.call', obj: chainData});
		sys.console({level: 'debug', text: sprintf('rpc.lookup error: %s',err)});
		if (sys.is_null(err)){
		    res.ip = '';
		    res.ip6 = '';
		    if (!sys.is_null(chainData.value) && sys.IsJsonString(chainData.value) === true){
			chainData.value = JSON.parse(chainData.value);
			var fqdn = obj.name+'.'+obj.zone;
			var tmpData = sys.cloneObj(chainData.value);
			delete tmpData.map;
			zoneData[fqdn] = tmpData;
			for (var index in chainData.value.map){
			    if (!sys.is_null(index) && !(/^_/).test(index)){
				zoneData[index+'.'+fqdn]=chainData.value.map[index];
				if (sys.is_null(zoneData[index+'.'+fqdn].ip) && zoneData[index+'.'+fqdn].alias !== undefined){
				    zoneData[index+'.'+fqdn].ip = zoneData[fqdn].ip;
				}
			    }
			}
			for (var index in zoneData){
			    rpc.findMap(index,zoneData,0);
			}
			sys.console({level: 'debug', text: 'zoneData', obj: zoneData});
			resolv = rpc.resolv( obj.domain, fqdn );
			sys.console({level: 'debug', text: 'Resolv result', obj: resolv});
			res.ip = resolv.ip;
			res.ip6 = resolv.ip6;
		    }else{
			sys.console({level: 'debug', text: 'chainData.value is not defined or not JSON string'});
			res.errorCode = 'NOTFOUND';	//see node_modules/native-dns-packet/consts.js NAME_TO_RCODE
		    }
		    res.data = chainData;
		}else{
		    //Error: "500"{"result":null,"error":{"code":-4,"message":"failed to read from name DB"},"id":1}
		    res.error = 'rpc.lookup: ' + err;
		    var regexp = /^Error:\s"\d+"(.*)/gi;
		    match = regexp.exec(err);
		    if (!sys.is_null(match[1])){
			var e = JSON.parse(match[1]);
			res.error = 'rpc.lookup: code '+e.error.code+': '+e.error.message;
			if (e.error.code == '-4'){
			    res.errorCode = 'NOTFOUND';
			}
		    }
		}
		obj.callback(res);
	    });
    }else{
	obj.callback(res);
    }
}

rpc.findMap = function( key, obj, nn ){
    if (!sys.is_null(obj[key]) && !sys.is_null(obj[key].map)){
	for (var index in obj[key].map){
	    zoneData[index +'.'+key]=obj[key].map[index];
	    if (!sys.is_null(obj[key].map[index].map)){
		if (nn < 16){	//Protect endless loop and stack overflow
		    rpc.findMap(index +'.'+key,zoneData,++nn);
		}
	    }
	}
    }
}

rpc.resolv = function( host, domain ){
    sys.console({level: 'debug', text: 'Doing resolv '+host+' in '+domain});
    var ret = { ip: null, ip6: null };
    if (sys.is_null(zoneData[host])){
	sys.console({level: 'debug', text: 'Host '+host+' not found, trying *.'+domain});
	host = '*.'+domain;
	if (!sys.is_null(zoneData['*.'+domain])){
	    sys.console({level: 'debug', text: 'Doing resolv '+host+' in '+domain});
	}
    }

    if (!sys.is_null(zoneData[host])){
	if (!sys.is_null(zoneData[host].ip)){
	    ret.ip = zoneData[host].ip;
	}
	if (!sys.is_null(zoneData[host].ip6)){
	    ret.ip6 = zoneData[host].ip6;
	}

	if (sys.is_null(ret.ip)){
	    if (zoneData[host].alias !== undefined){
		if (zoneData[host].alias == ''){
		    var prevLevel = host.split('.');
		    prevLevel.shift();
		    sys.console({level: 'debug', text: 'Found alias to '+prevLevel.join('.')});
		    ret = rpc.resolv( prevLevel.join('.'), domain);
		}else{
		    var matches = zoneData[host].alias.match(/(.*)\.\@/);
		    if (!sys.is_null(matches)){
			sys.console({level: 'debug', text: 'Found alias '+zoneData[host].alias});
			ret = rpc.resolv( matches[1]+'.'+domain, domain);
		    }
		}
	    }
	}
    }else{
	sys.console({level: 'debug', text: 'Host '+host+' not found'});
    }
 return ret;
}

module.exports = rpc;