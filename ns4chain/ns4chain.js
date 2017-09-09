#!/usr/bin/env node
/*
    RPC client for ns4chain :: https://github.com/subnetsRU/namecoin
    
    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 3 of the License

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 SUCH DAMAGE.
*/

ns4chain = {};

ns4chain.dns_serv_help = function(){
    var helpText = '\n';
    helpText += 'Usage: node '+process.mainModule.filename+' [options]\n';
    helpText += 'Options:\n';
    helpText +='\t-h, --help                   This help;\n';
    helpText +='\t-l, --listen <IP>            IP to listen on;\n';
    helpText += '\t-p, --port <PORT>            Port to listen to;\n'
    helpText += '\t-t, --ttl <NUMBER>           Set this TTL in reply;\n'
    sys.console({level: 'info', text: helpText});
    process.exit(0);
}

ns4chain.onExit = function() {
    sys.console({level: 'info', text: sprintf('Stop DNS server %j',dns.address())});
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
		if (!sys.is_null(index)){
		    var subDomain = index + (!sys.is_null(index) ? '.' : '') + fqdn;
		    zoneData[subDomain]=chainData.value.map[index];
		}
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
//TODO: Protect endless loop on CNAMEs
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

    if ((/^(TXT|ANY)$/.test(obj.res.type))){
	var txtData = [
	    'txid: ' + (!sys.is_null(obj.res.data.txid) ? obj.res.data.txid : 'unknown'),
	    'address: ' + (!sys.is_null(obj.res.data.address) ? obj.res.data.address : 'unknown'),
	    'expires: ' + (!sys.is_null(obj.res.data.expires_in) ? obj.res.data.expires_in : 'unknown'),
	];
	obj.res.ns4chain.push({
	    name: host,
	    type: 16,
	    class: obj.res.class,
	    data: txtData,
	    ttl: config.ttl,
	});
    }

    if (!sys.is_null(zoneData[host])){
	//If NS servers is set ignore chain data
	if (!sys.is_null(zoneData[host].ns)){
//TODO: NS IPv6 support
//TODO: secondary NS support
//TODO: ANY|TXT and other types of requests rather then A to external NS
	    if (typeof zoneData[host].ns == 'object' && !sys.is_null(zoneData[host].ns[0])){
		zoneData[host].ns = zoneData[host].ns[0];
	    }
	    sys.console({level: 'debug', text: sprintf('Found NS server %s for %s',zoneData[host].ns,host)});
	    obj.res.ns4chain.push({
		name: host,
		type: 2,
		class: obj.res.class,
		data: zoneData[host].ns,
		ttl: config.ttl,
	    });

	    if (!(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(zoneData[host].ns)){
		sys.console({level: 'debug', text: sprintf('Trying to resolv NS name %s',zoneData[host].ns,host)});
		try {
		    request = dnsSource.lookup(zoneData[host].ns, function (err, nsIP, result) {
			var error = null;
			if (!sys.is_null(err)){
			    error=sprintf('Resolv error on NS name %s: %j',zoneData[host].ns,err);
			}else{
			    if (sys.is_null(nsIP)){
				error=sprintf('Cant resolv NS name %s to IP',zoneData[host].ns);
			    }else{ 
				if (!(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(nsIP)){
				    error=sprintf('NS name %s resolved to [%s]',zoneData[host].ns,nsIP);
				}else if (!sys.is_null(nsIP) && nsIP == '127.0.0.1'){
				    error=sprintf('NS name %s is point to myself [%s]',zoneData[host].ns,nsIP);
				}
			    }
			}

			if (!sys.is_null(error)){
			    obj.res.error = error;
			    callback( obj.res );
			}else{
			    ns4chain.oldResolver( {res: obj.res, name: host, server: nsIP, callback: obj.callback} );
			}
		    });
		    noCallback = true;
		}
		catch(e){
		    sys.console({level: 'error', text: sprintf('Cant resolve NS server %s',zoneData[host].ns)});
		}
	    }else{
		ns4chain.oldResolver( {res: obj.res, name: host, server: zoneData[host].ns, callback: obj.callback} );
		noCallback = true;
	    }
	}else{
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
		    class: obj.res.class,
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
			    class: obj.res.class,
			    data: prevLevel.join('.'),
			    ttl: config.ttl,
			});
			noCallback = ns4chain.resolv( { res: obj.res, domain: prevLevel.join('.'), fqdn: domain, callback: obj.callback, noCallback: true } );
		    }else if ((/\.$/).test(alias)){
			//FQDN alias
			var re = new RegExp(obj.res.name + '\.' + obj.res.zone + '\.$');
			if (!(re.test(alias))){
			    sys.console({level: 'debug', text: 'Found FQDN alias to external domain '+alias});
//TODO: IF alias is another .bit domain
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: 6,
				data: alias,
				ttl: config.ttl,
			    });
			    ns4chain.oldResolver( {res: obj.res, name: alias, callback: obj.callback} );
			    noCallback = true;
			}else{
			    sys.console({level: 'debug', text: 'Found FQDN alias '+alias+' point to this domain'});
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: obj.res.class,
				data: alias.replace(/\.$/,''),
				ttl: config.ttl,
			    });
			    noCallback = ns4chain.resolv( { res: obj.res, domain: alias.replace(/\.$/,''), fqdn: domain, callback: obj.callback, noCallback: true } );
			}
		    }else{
			var matches = alias.match(/^(.*)\.\@$/);
			if (!sys.is_null(matches)){
			    sys.console({level: 'debug', text: 'Found alias type#2 to '+alias});
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: obj.res.class,
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
				    class: obj.res.class,
				    data: alias+'.'+domain,
				    ttl: config.ttl,
				});
				noCallback = ns4chain.resolv( { res: obj.res, domain: alias+'.'+domain, fqdn: domain, callback: obj.callback, noCallback: true } );
			    }
			}
		    }
		}
	    }
	}
    }else{
	sys.console({level: 'debug', text: 'Host '+host+' not found'});
    }

    if (sys.is_null(obj.noCallback) && sys.is_null(noCallback) ){
	sys.console({level: 'debug', text: 'Resolv result', obj: (!sys.is_null(obj.res.ns4chain) ? obj.res.ns4chain : {}) });
	callback( obj.res );
    }
    return noCallback;
}

ns4chain.oldResolver = function( obj ){
    if (sys.is_null( obj.server )){
	if (sys.is_null(config.oldDNS) || typeof config.oldDNS != 'object' || sys.is_null(config.oldDNS.host) && typeof config.oldDNS.host != 'string'){
	    sys.console({level: 'warning', text: 'oldDNS not set or wrong, check config. Set to default.'});
	    config.oldDNS = { 
		host: '8.8.8.8',
		port: 53,
		timeout: 3000,
	    };
	}
    }

    if (sys.is_null(config.oldDNS.port)){
	config.oldDNS.port = 53;
    }
    if (sys.is_null(config.oldDNS.timeout)){
	config.oldDNS.timeout = 3000;
    }
    
    var dnsHost = sys.is_null( obj.server ) ? config.oldDNS.host : obj.server;
    var dnsPort = sys.is_null( obj.server ) ? config.oldDNS.port : 53;

    sys.console({level: 'debug', text: sprintf('oldDNS: request NS %s:%s for %s [%s]',dnsHost,dnsPort,obj.name,obj.res.type)});

    var question = dnsSource.Question({
	name: obj.name,
	type: obj.res.type,
    });

    try{
	var start = Date.now();
	var oldDNSreq = dnsSource.Request({
	    question: question,
	    server: { address: dnsHost, port: dnsPort, type: 'udp' },
	    timeout: config.oldDNS.timeout,
	});

	oldDNSreq.send();

	oldDNSreq.on('timeout', function () {
	    obj.res.error=sprintf('oldDNS: request to %s:%s for %s [%s] timeout',dnsHost,dnsPort,obj.name,obj.res.type);
	    obj.callback( obj.res );
	});

	oldDNSreq.on('message', function (err, answer) {
	    var replyData = 0;
	    answer.answer.forEach(function ( data ) {
		if (typeof data === 'object'){
		    obj.res.ns4chain.push( data );
		    replyData++;
		}else{
		    sys.console({level: 'warn', text: sprintf('oldDNS: unknown data received from %s:%s for %s [%s]',dnsHost,dnsPort,obj.name,obj.res.type), obj: data});
		}
	    });
	    if (replyData == 0){
		obj.res.error='oldDNS: no data was received';
		obj.res.errorCode = 'NOTFOUND';
	    }
	    obj.callback( obj.res );
	});

	oldDNSreq.on('end', function () {
	    var delta = (Date.now()) - start;
	    sys.console({ level: 'debug', text: sprintf('oldDNS: finished processing request to %s:%s for %s [%s] in %s ms',dnsHost,dnsPort,obj.name,obj.res.type,delta.toString())});
	});
    }
    catch(e){
	sys.console({level: 'error',text: sprintf('oldDNS: request to %s:%s for %s [%s] failed',dnsHost,dnsPort,obj.name,obj.res.type), obj: e});
    }
}

ns4chain.multiIP = function( obj ){
    var ret = [];
    
    if (typeof obj.data === 'string'){
	obj.data = [obj.data];
    }
    
    obj.data.forEach(function (address) {
	var tmp = {
	    name: obj.name,
	    type: obj.type,
	    class: obj.class,
	    ttl: config.ttl,
	    address: address
	};
	if ((/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(address) || (/^[0-9a-fA-F:]+(\/\d{1,3}){0,1}$/).test(address)){
	    ret.push( tmp );
	}
    });
 return ret;
}

module.exports = ns4chain;