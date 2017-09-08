#!/usr/bin/env node
/*
    RPC client for ns4chain :: https://github.com/subnetsRU/namecoin
    
    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

ns4chain = {};

ns4chain.dns_serv_help = function(){
    var helpText = '\n';
    helpText += 'Usage: node '+process.mainModule.filename+' [options]\n';
    helpText += 'Options:\n';
    helpText +='\t-h, --help                   This help;\n';
    helpText +='\t-l, --listen <IP>            IP to listen on;\n';
    helpText += '\t-p, --port <PORT>            Port to listen to;\n'
    sys.console({level: 'info', text: helpText});
    process.exit();
}

ns4chain.onExit = function() {
    sys.console({level: 'info', text: 'Stoping DNS server'});
    dns.close();
    process.exit(0);
}

ns4chain.rpcData = function( obj ){
    var res = obj.res;
    var chainData = res.chainData;
		    res.data = chainData;
		    if (!sys.is_null(chainData.value) && sys.IsJsonString(chainData.value) === true){
			chainData.value = JSON.parse(chainData.value);
			var fqdn = res.name+'.'+res.zone;
			var tmpData = sys.cloneObj(chainData.value);
			delete tmpData.map;
			zoneData[fqdn] = tmpData;
//TODO: service records
			for (var index in chainData.value.map){
			    if (!(/^_/).test(index)){
				var subDomain = index + (!sys.is_null(index) ? '.' : '') + fqdn;
				zoneData[subDomain]=chainData.value.map[index];
			    }
			}
			for (var index in zoneData){
			    ns4chain.findMap(index,zoneData,0);
			}
			sys.console({level: 'debug', text: 'zoneData', obj: zoneData});
			ns4chain.resolv( { res: res, domain: obj.res.domain, fqdn: fqdn, callback: obj.callback } );
		    }else{
			sys.console({level: 'debug', text: 'chainData.value is not defined or not JSON string'});
			res.errorCode = 'NOTFOUND';	//see node_modules/native-dns-packet/consts.js NAME_TO_RCODE
			obj.callback( res );
		    }
}

ns4chain.findMap = function( key, obj, nn ){
    if (!sys.is_null(obj[key]) && !sys.is_null(obj[key].map)){
	for (var index in obj[key].map){
	    zoneData[index +'.'+key]=obj[key].map[index];
	    if (!sys.is_null(obj[key].map[index].map)){
		if (nn < 16){	//Protect endless loop and stack overflow
		    ns4chain.findMap(index +'.'+key,zoneData,++nn);
		}
	    }
	}
    }
}

ns4chain.resolv = function( obj ){
    //
    // DOCS:
    //	* https://wiki.namecoin.org/index.php?title=Domain_Name_Specification
    //	* https://github.com/namecoin/proposals/blob/master/ifa-0001.md
    //
    var host = obj.domain; 
    var domain = obj.fqdn;
    var callback = obj.callback;
    var noCallback = null;
    var tmp = null;
    var hostFound = 0;

    if (sys.is_null(obj.res.ns4chain)){
	obj.res.ns4chain = [];
    }
    
    sys.console({level: 'debug', text: 'Doing resolv '+host+' in '+domain});
    if (sys.is_null(zoneData[host]) && host != '*.'+domain){
	sys.console({level: 'debug', text: 'Host '+host+' not found, trying *.'+domain});
	host = '*.'+domain;
	if (!sys.is_null(zoneData['*.'+domain])){
	    sys.console({level: 'debug', text: 'Doing resolv '+host+' in '+domain});
	}
    }

    if (!sys.is_null(zoneData[host])){
//TODO: NS servers is set
	if (typeof zoneData[host] === 'string'){
	    if ((/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(zoneData[host])){
		zoneData[host] = { ip: zoneData[host] };
	    }
	    if ((/^[0-9a-fA-F:]+(\/\d{1,3}){0,1}$/).test(zoneData[host])){
		zoneData[host] = { ip6: zoneData[host] };
	    }
	}

	if (!sys.is_null(zoneData[host].ip)){
	    ns4chain.multiIP({
		name: host,
		type: 1,
		class: 1,
		data: zoneData[host].ip
	    }).forEach(function (a) {
		obj.res.ns4chain.push( a );
	    });
	    hostFound = 1;
	}
	if (!sys.is_null(zoneData[host].ip6)){
	    ns4chain.multiIP({
		name: host,
		type: 28,
		class: 6,
		data: zoneData[host].ip6
	    }).forEach(function (a) {
		obj.res.ns4chain.push( a );
	    });
	    hostFound = 1;
	}

	//Looking up alias if no IPs was found
	if (sys.is_null(hostFound)){
	    if (zoneData[host].alias !== undefined){
		var alias = zoneData[host].alias;
		if (alias == ''){
		    var prevLevel = host.split('.');
		    prevLevel.shift();
		    sys.console({level: 'debug', text: 'Found alias type#1 to '+prevLevel.join('.')});
		    obj.res.ns4chain.push({
			name: host,
			type: 5,
			class: 1,
			data: prevLevel.join('.'),
			ttl: config.ttl,
		    });
		    noCallback = ns4chain.resolv( { res: obj.res, domain: prevLevel.join('.'), fqdn: domain, callback: obj.callback, noCallback: true } );
		}else if ((/\.$/).test(alias)){
//TODO: FQDN alias
		}else{
		    var matches = alias.match(/^(.*)\.\@$/);
		    if (!sys.is_null(matches)){
			sys.console({level: 'debug', text: 'Found alias type#2 to '+alias});
			obj.res.ns4chain.push({
			    name: host,
			    type: 5,
			    class: 1,
			    data: matches[1]+'.'+domain,
			    ttl: config.ttl,
			});
			noCallback = ns4chain.resolv( { res: obj.res, domain: matches[1]+'.'+domain, fqdn: domain, callback: obj.callback, noCallback: true } );
		    }else{
			if (!sys.is_null(zoneData[alias+'.'+domain])){
			    sys.console({level: 'debug', text: 'Found alias type#3 to '+alias+'.'+domain});
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: 1,
				data: alias+'.'+domain,
				ttl: config.ttl,
			    });
			    noCallback = ns4chain.resolv( { res: obj.res, domain: alias+'.'+domain, fqdn: domain, callback: obj.callback, noCallback: true } );
			}
		    }
		}
	    }
	}
    }else{
	sys.console({level: 'debug', text: 'Host '+host+' not found'});
    }

    if (sys.is_null(obj.noCallback) && sys.is_null(noCallback) ){
	sys.console({level: 'debug', text: 'Resolv result', obj: obj.res.ns4chain });
	callback( obj.res );
    }
    return noCallback;
}

ns4chain.multiIP = function( obj ){
    var ret = [];
    
    if (typeof obj.data === 'string'){
	obj.data = [obj.data];
    }
    
    obj.data.forEach(function (a) {
	var tmp = {
	    name: obj.name,
	    type: obj.type,
	    class: obj.class,
	    ttl: config.ttl,
	    address: a
	};
	ret.push( tmp );
    });
 return ret;
}

module.exports = ns4chain;