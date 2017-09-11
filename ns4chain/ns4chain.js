#!/usr/bin/env node
/*
    ns4chain functions :: https://github.com/subnetsRU/namecoin
    
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
    helpText +='\t-h, --help                              This help;\n';
    helpText +='\t-d, --debug <none|log|cli|full>         Enable/disable debug and logging;\n';
    helpText +='\t-l, --listen <IP>                       IP to listen on;\n';
    helpText += '\t-p, --port <PORT>                       Port to listen to;\n'
    helpText += '\t-t, --ttl <NUMBER>                      Set this TTL in reply;\n'
    helpText += '\t-r, --recursion                         Enable recursive queries;\n'
    sys.console({level: 'info', text: helpText});
    process.exit(0);
}

ns4chain.onExit = function() {
    sys.console({level: 'info', text: sprintf('Stop DNS server %j',dns.address())});
    dns.close();
    process.exit(0);
}

ns4chain.recursive = function( obj ){
    try{
	sys.console({level: 'debug', text: 'Perform recursive request'});
	ns4chain.oldResolver({
	    name: obj.domain,
	    res: {
		response: obj.response,
		domain: obj.domain,
		type: obj.type,
		class: obj.class,
		ns4chain: [],
	    },
	    callback: function( res ){
		if (sys.is_null(res.error)){
		    sys.console({level: 'info', text: sprintf('Form reply for [%s] %j',res.domain,res.ns4chain)});
		    if (!sys.is_null(res.ns4chain) && typeof res.ns4chain == 'object'){
			for (var index in res.ns4chain){
			    var tmp = res.ns4chain[index];
			    if (!sys.is_null(tmp.type)){
				res.response.answer.push(
				    dnsSource[dnsSource.consts.QTYPE_TO_NAME[tmp.type]](tmp)
				);
			    }
			}
		    }else{
			res.error = 'ns4chain.recursive: Unknown data for the reply';
		    }
		}

		if (!sys.is_null(res.error)){
		    sys.console({level: 'error', text: res.error });
		    res.response.answer = [];
		    if (sys.is_null(res.errorCode)){
			res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
		    }else{
			res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE[res.errorCode];
		    }
		}

		try {
		    res.response.send();
		}
		catch(e){
		    sys.console({level: 'error',text: 'ns4chain.recursive: Error on reply occurred => ', obj: e});
		}
	    }
	});
    }
    catch(e){
	sys.console({level: 'error', text: 'ns4chain request failed', obj: obj});
    }
}

ns4chain.request = function( obj ){
    try{
	    var request = {
		response: obj.response,
		domain: obj.domain,
		type: obj.type,
		name: obj.name,
		zone: obj.zone,
		subDomain: obj.subDomain,
		class: obj.class,
		callback: function( res ){
		    zoneData = {};
		    if (sys.is_null(res.error)){
			ns4chain.rpcData( { res: res, callback: this.ns4chainResponse } );
		    }else{
			sys.console({level: 'error', text: res.error });
			if (sys.is_null(res.errorCode)){
			    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
			}else{
			    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE[res.errorCode];
			}
			try {
			    res.response.send();
			}
			catch(e){
			    sys.console({level: 'error',text: 'ns4chain.request: Error on reply occurred => ', obj: e});
			}
		    }
		},
		ns4chainResponse: function( res ){
			sys.console({level: 'info', text: sprintf('Form reply for [%s] %j',res.domain,res.ns4chain)});
			if ((/^(A|AAAA|TXT|ANY)$/.test(res.type))){
			    if (!sys.is_null(res.ns4chain) && typeof res.ns4chain == 'object'){
				for (var index in res.ns4chain){
				    var tmp = res.ns4chain[index];
				    if (!sys.is_null(tmp.type)){
					res.response.answer.push(
					    dnsSource[dnsSource.consts.QTYPE_TO_NAME[tmp.type]](tmp)
					);
				    }
				}
			    }

			    if (sys.is_null(res.error)){
				if (sys.is_null(res.ns4chain) || typeof res.ns4chain !== 'object' || res.response.answer.length == 0){
				    if ((/^(A|AAAA)$/.test(res.type))){
					res.error = 'domain "'+res.domain+'" has no IP';
					res.errorCode = 'NOTFOUND';
				    }else{
					res.error = 'No data for the reply...';
				    }
				}
			    }

			    if (!sys.is_null(res.error)){
				sys.console({level: 'error', text: res.error });
				if (sys.is_null(res.errorCode)){
				    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
				}else{
				    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE[res.errorCode];
				}
			    }
			}

			try {
			    res.response.send();
			}
			catch(e){
			    sys.console({level: 'error',text: 'Error on reply occurred => ', obj: e});
			    res.response.answer = [];
			    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
			    try {
				res.response.send();
			    }
			    catch(e){
				sys.console({level: 'error',text: 'Send info about error failed => ', obj: e});
			    }
			}
		}
	    };
	    rpc.lookup( request );
    }
    catch(e){
	sys.console({level: 'error', text: 'ns4chain.request failed', obj: obj});
    }
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
	if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
	    obj.callback( res );
	}else{
	    sys.console({level: 'error', text: 'ns4chain.rpcData: callback is not set or not a function', obj: obj});
	}
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

    if (sys.is_null(config.maxalias)){
	config.maxalias = 16;
    }
    if (sys.is_null(obj.res.ns4chain)){
	obj.res.ns4chain = [];
    }
    if (sys.is_null(obj.loop)){
	obj.loop = 0;
    }
    obj.loop++;

    sys.console({level: 'debug', text: sprintf('[#%d] Doing resolv %s in %s',obj.loop,host,domain)});
    if (obj.loop >= config.maxalias){
	obj.res.errorCode = 'NOTFOUND';
	obj.res.error='Max alias reached. Stop searching, '+host+' not found';
    }

    if (sys.is_null(obj.res.error)){
	if (sys.is_null(zoneData[host]) && host != '*.'+domain){
	    sys.console({level: 'debug', text: 'Host '+host+' not found, trying *.'+domain});
	    host = '*.'+domain;
	    if (!sys.is_null(zoneData['*.'+domain])){
		sys.console({level: 'debug', text: 'Doing resolv '+host+' in '+domain});
	    }
	}

	if (sys.is_null(zoneData[host])){
	    obj.res.error='Host '+host+' not found';
	    obj.res.errorCode = 'NOTFOUND';
	}
    }

    if (sys.is_null(obj.res.error)){
	if (obj.loop == 1 && (/^(TXT|ANY)$/.test(obj.res.type))){
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
			sys.console({level: 'debug', text: 'Found empty alias to '+prevLevel.join('.')});
			obj.res.ns4chain.push({
			    name: host,
			    type: 5,
			    class: obj.res.class,
			    data: prevLevel.join('.'),
			    ttl: config.ttl,
			});
			noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: prevLevel.join('.'), fqdn: domain, callback: obj.callback, noCallback: true } );
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
			    noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: alias.replace(/\.$/,''), fqdn: domain, callback: obj.callback, noCallback: true } );
			}
		    }else{
			var matches = alias.match(/^(.*)\.\@$/);
			if (!sys.is_null(matches) && !sys.is_null(matches[1])){
			    alias = matches[1];
			}

			sys.console({level: 'debug', text: 'Found alias to '+alias+'.'+domain});
			if (!sys.is_null(zoneData[alias+'.'+domain])){
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: obj.res.class,
				data: alias+'.'+domain,
				ttl: config.ttl,
			    });
			    noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: alias+'.'+domain, fqdn: domain, callback: obj.callback, noCallback: true } );
			}else{
			    sys.console({level: 'debug', text: 'Alias '+alias+'.'+domain+' not found'});
			    obj.res.error='Alias '+alias+'.'+domain+' not found';
			    obj.res.errorCode = 'NOTFOUND';
			}
		    }
		}
	    }
	}
    }

    if (sys.is_null(obj.noCallback) && sys.is_null(noCallback) ){
	sys.console({level: 'debug', text: 'Resolv result', obj: (!sys.is_null(obj.res.ns4chain) ? obj.res.ns4chain : {}) });
	if (!sys.is_null(callback) && typeof callback === 'function'){
	    callback( obj.res );
	}else{
	    sys.console({level: 'error', text: 'ns4chain.resolv: callback is not set or not a function', obj: obj});
	}
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
	    if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
		obj.callback( obj.res );
	    }else{
		sys.console({level: 'error', text: 'ns4chain.oldResolver: callback is not set or not a function', obj: obj});
	    }
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

	    if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
		obj.callback( obj.res );
	    }else{
		sys.console({level: 'error', text: 'ns4chain.oldResolver: callback is not set or not a function', obj: obj});
	    }
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