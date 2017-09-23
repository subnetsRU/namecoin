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
		    sys.console({level: 'info', text: sprintf('Form recursive reply for [%s]\nreply: %j%s%s%s',res.domain,res.ns4chain,(!sys.is_null(res.response.authority) ? sprintf('\nauthority: %j',res.response.authority) : ''),(!sys.is_null(res.response.additional) ? sprintf('\nadditional: %j',res.response.additional) : ''),(!sys.is_null(res.response.edns_options) ? sprintf('\nedns_options: %j',res.response.edns_options) : ''))});
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
	    obj.response.header.aa = 1;		//authoritative answer for chain
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
			if (!sys.is_null(res.ns4chain) && typeof res.ns4chain == 'object'){
			    for (var index in res.ns4chain){
				var tmp = res.ns4chain[index];
				if (!sys.is_null(tmp.type)){
				    res.response.answer.push(
					dnsSource[dnsSource.consts.QTYPE_TO_NAME[tmp.type]](tmp)
				    );
				}
			    }
			    if ((/^CNAME$/.test(res.type))){
				ns4chain.addAuthority({res: res, name: res.name + '.' +res.zone, data: config.dnsName, address: dns.address().address});
			    }
			}

			if (sys.is_null(res.error)){
				if (sys.is_null(res.ns4chain) || typeof res.ns4chain !== 'object' || res.response.answer.length == 0){
				    if ((/^(A|AAAA)$/.test(res.type))){
					res.error = 'domain "'+res.domain+'" has no IP';
					res.errorCode = 'NOTFOUND';
				    }else{
					if ((/^SOA$/.test(res.type))){ 
					    if (sys.is_null(res.response.authority)){
						res.error = 'No authority data for the reply...';
					    }
					}else if ((/^CNAME$/.test(res.type))){ 
					    ns4chain.addSOA({res: res, name: res.domain});
					}else{
					    res.error = 'No data for the reply...';
					}
				    }
				}
			}
			sys.console({level: 'info', text: sprintf('Form reply for [%s]\nreply: %j%s%s%s',res.domain,res.ns4chain,(!sys.is_null(res.response.authority) ? sprintf('\nauthority: %j',res.response.authority) : ''),(!sys.is_null(res.response.additional) ? sprintf('\nadditional: %j',res.response.additional) : ''),(!sys.is_null(res.response.edns_options) ? sprintf('\nedns_options: %j',res.response.edns_options) : ''))});

			if (!sys.is_null(res.error)){
				sys.console({level: 'error', text: res.error });
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
    if (!sys.is_null(chainData.value) && sys.IsJsonString(chainData.value) === true){
	chainData.value = JSON.parse(chainData.value);
	var fqdn = res.name+'.'+res.zone;
	var tmpData = sys.cloneObj(chainData.value);
	var subDomain = null;
	delete tmpData.map;
	zoneData[fqdn] = tmpData;
//TODO: service records
	for (var index in chainData.value.map){
	    if (!(/^_/).test(index)){
		subDomain = index + (!sys.is_null(index) ? '.' : '') + fqdn;
		if (sys.is_null(zoneData[subDomain])){
		    zoneData[subDomain]={};
		}
		if (!sys.is_null(zoneData[subDomain])){
		    if (typeof chainData.value.map[index] == 'object'){
			for (var k in chainData.value.map[index]){
			    if (sys.is_null(k)){
				if (sys.is_null(zoneData[subDomain].ip)){
				    zoneData[subDomain].ip=chainData.value.map[index][k];
				}
			    }else{
				zoneData[subDomain][k]=chainData.value.map[index][k];
			    }
			}
		    }else if (sys.is_null(index) && typeof chainData.value.map[index] == 'string'){
			/*
			    "map": {                    // This is equivalent to "ip": "192.0.2.2"
				"ip": "192.0.2.2"         // Takes precedence
				"": {
    				    "ip": "192.0.2.1"       // Ignored
				}
			    }
			*/
			if (sys.is_null(zoneData[subDomain].ip)){
			    zoneData[subDomain].ip = chainData.value.map[index];
			}
		    }
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
    var stopLooking = 0;

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

    sys.console({level: 'debug', text: sprintf('#iter%d: Doing resolv %s [%s] in %s',obj.loop,host,obj.res.type,domain)});
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

    if (!sys.is_null(zoneData[host]) && sys.is_null(zoneData[host].ns)){
	if (/^(MX|SRV)$/.test(obj.res.type) && sys.is_null(obj.res.error)){
	    /*
		Service records: _service._proto.name TTL class SRV priority weight port target
		ex.: [["smtp","tcp",10,0,25,"mx"]]
		    [0] - service
		    [1] - proto
		    [2] - priority
		    [3] - weight
		    [4] - port number
		    [5] - name
	    */
	    if(!sys.is_null(zoneData[host].service)){
		if (typeof zoneData[host].service != 'object'){
		    obj.res.errorCode = 'NOTFOUND';
		    obj.res.error='Request for SERVICE record but chain service data invalid';
		}
		if (sys.is_null(obj.res.error)){
		    var reDomain = new RegExp('.*\.' + domain + '$');
		    zoneData[host].service.forEach(function (array) {
			if (typeof array == 'object' && array.length == 6){
			    if (obj.res.type == 'MX' && array[0] == 'smtp'){
				var exchange = array[5];
				if (!(/\.$/).test(exchange)){
				    if (!exchange.match(reDomain)){
					exchange = array[5] + '.' + domain;
				    }
				}
				obj.res.ns4chain.push({
				    name: host,
				    type: 15,
				    class: obj.res.class,
				    priority: (!sys.is_null(array[2]) ? array[2] : 10),
				    exchange: exchange,
				    ttl: config.ttl,
				});
				stopLooking = 1;
			    }
			}else{
			    sys.console({level: 'debug', text: 'ns4chain.resolv: malformed service value, must have 6 items', obj: array});
			}
		    });

		    if (!sys.is_null(stopLooking)){
			//add authoritative answer info
			ns4chain.addAuthority({res: obj.res, name: host, data: config.dnsName, address: dns.address().address});
		    }else{
			obj.res.errorCode = 'NOTFOUND';
			obj.res.error=sprintf('ns4chain.resolv: No SERVICE record for [%s]',obj.res.type);
		    }
		}
	    }else{
		obj.res.errorCode = 'NOTFOUND';
		obj.res.error=sprintf('ns4chain.resolv: SERVICE record for [%s] not found',host);
	    }
	}
    }

    if (/^SOA$/.test(obj.res.type)){
	ns4chain.addSOA({res: obj.res, name: domain});
	stopLooking = 1;
    }

    if (sys.is_null(obj.res.error) && sys.is_null(stopLooking)){
	if (obj.loop == 1 && (/^(TXT|ANY)$/.test(obj.res.type))){
	    var txtData = [
		'txid: ' + (!sys.is_null(obj.res.chainData.txid) ? obj.res.chainData.txid : 'unknown'),
		'address: ' + (!sys.is_null(obj.res.chainData.address) ? obj.res.chainData.address : 'unknown'),
		'expires: ' + (!sys.is_null(obj.res.chainData.expires_in) ? obj.res.chainData.expires_in : 'unknown'),
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
		obj.res.response.header.aa = 0;		//Non-authoritative answer
//TODO: NS IPv6 support
		if (typeof zoneData[host].ns == 'string' && !sys.is_null(zoneData[host].ns)){
		    zoneData[host].ns = [ zoneData[host].ns ] ;
		}

		sys.console({level: 'debug', text: sprintf('Found NS servers [%s] for %s',zoneData[host].ns.join(', '),host)});
		var nsTMP=[];
		var nn = zoneData[host].ns.length-1;

		for (var i=nn; nn >=0; nn--){
		    if (sys.is_null(zoneData[host].ns[nn])){
			obj.res.error=sprintf('NS is [%s], skip',zoneData[host].ns[nn]);
		    }else if (zoneData[host].ns[nn] == dns.address().address){
			obj.res.error=sprintf('NS [%s] is point to myself',zoneData[host].ns[nn]);
		    }else if (zoneData[host].ns[nn] == '127.0.0.1' || zoneData[host].ns[nn] == 'localhost'){
			obj.res.error=sprintf('NS [%s] is point to localhost',zoneData[host].ns[nn]);
		    }else{
			nsTMP.push( zoneData[host].ns[nn] );
		    }
		}
		
		if (sys.is_null(obj.res.error)){
		    ns4chain.zoneNS({res: obj.res, host: host, nsServers: nsTMP, callback: obj.callback});
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
	    }else{
		if (!sys.is_null(zoneData[host][''])){
		    ns4chain.multiIP({
			name: host,
			type: 1,
			class: obj.res.class,
			data: zoneData[host]['']
		    }).forEach(function (a) {
			obj.res.ns4chain.push( a );
		    });
		    stopLooking = 1;
		}
	    }

	    if ((/^A$/.test(obj.res.type)) && !sys.is_null(zoneData[host].ip)){
		ns4chain.multiIP({
			name: host,
			type: 1,
			class: obj.res.class,
			data: zoneData[host].ip
		}).forEach(function (a) {
		    if (obj.res.type == 'MX'){
			obj.res.response.additional.push( a );
		    }else{
			obj.res.ns4chain.push( a );
		    }
		});
		stopLooking = 1;
	    }
	    if ((/^AAAA$/.test(obj.res.type)) && !sys.is_null(zoneData[host].ip6)){
		ns4chain.multiIP({
		    name: host,
		    type: 28,
		    class: 6,
		    data: zoneData[host].ip6
		}).forEach(function (a) {
		    obj.res.ns4chain.push( a );
		});
		stopLooking = 1;
	    }

	    //Looking up alias if no IPs was found
	    if (sys.is_null(stopLooking)){
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
			if (!/^CNAME$/.test(obj.res.type)){
			    noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: prevLevel.join('.'), fqdn: domain, callback: obj.callback, noCallback: true } );
			}
		    }else if ((/\.$/).test(alias)){
			//FQDN alias
			var re = new RegExp(obj.res.name + '\.' + obj.res.zone + '\.$');
			if (!(re.test(alias))){
			    sys.console({level: 'debug', text: 'Found FQDN alias to domain '+alias});
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: obj.res.class,
				data: alias,
				ttl: config.ttl,
			    });

			    if (!(/\.bit/.test(alias))){
				if (!/^CNAME$/.test(obj.res.type)){
				    ns4chain.oldResolver( {res: obj.res, name: alias, callback: obj.callback} );
				    noCallback = true;
				}
			    }else{
				//IF alias is another .bit domain
				ns4chain.addAuthority({res: obj.res, name: domain, data: config.dnsName, address: dns.address().address});
				noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: alias.replace(/\.$/,''), fqdn: domain, callback: obj.callback, noCallback: true } );
			    }
			}else{
			    sys.console({level: 'debug', text: 'Found FQDN alias '+alias+' point to this domain'});
			    obj.res.ns4chain.push({
				name: host,
				type: 5,
				class: obj.res.class,
				data: alias.replace(/\.$/,''),
				ttl: config.ttl,
			    });
			    if (!/^CNAME$/.test(obj.res.type)){
				noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: alias.replace(/\.$/,''), fqdn: domain, callback: obj.callback, noCallback: true } );
			    }
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
			    if (!/^CNAME$/.test(obj.res.type)){
				noCallback = ns4chain.resolv( { loop: obj.loop, res: obj.res, domain: alias+'.'+domain, fqdn: domain, callback: obj.callback, noCallback: true } );
			    }
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
	sys.console({level: 'debug', text: sprintf('Resolv result'), obj: (!sys.is_null(obj.res.ns4chain) ? obj.res.ns4chain : {}) });
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
		timeout: 1000,
	    };
	}
    }

    if (sys.is_null(config.oldDNS.port)){
	config.oldDNS.port = 53;
    }
    if (sys.is_null(config.oldDNS.timeout)){
	config.oldDNS.timeout = 1000;
    }
    
    var dnsHost = sys.is_null( obj.server ) ? config.oldDNS.host : obj.server;
    var dnsPort = sys.is_null( obj.server ) ? config.oldDNS.port : 53;

    sys.console({level: 'debug', text: sprintf('oldDNS: request NS %s:%s for %s [%s]',dnsHost,dnsPort,obj.name,obj.res.type)});
    obj.res.nsServer = dnsHost;
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
    if (sys.is_null(obj.data)){
	obj.data = [];
    }

    if (typeof obj.data === 'string'){
	obj.data = [obj.data];
    }else{
	if (!sys.is_null(obj.data.ip)){
	    obj.data = obj.data.ip;
	}
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

ns4chain.zoneNS = function( obj ){
    var error = null;
    if (obj.nsServers == undefined || typeof obj.nsServers != 'object' ){
	error='ns4chain.zoneNS: NS list is not set or not array';
	sys.console({level: 'error',text: error,obj: obj});
    }

    if (sys.is_null(error)){
	var nsServer = null;
	if (obj.nsServers.length > 0){
	    nsServer = obj.nsServers[obj.nsServers.length-1];
	    sys.console({level: 'debug', text: sprintf('#%d: Trying request NS server %s',obj.nsServers.length,nsServer,obj.host)});
	    --obj.nsServers.length;
	    obj.res.nsServers = obj.nsServers;
	    obj.res.host = obj.host;
	    obj.res.callback = obj.callback;
	    //Insert NS info to DNS reply
	    obj.res.ns4chain.push({
		name: obj.host,
		type: 2,
		class: obj.res.class,
		data: nsServer,
		ttl: config.ttl,
	    });
	    if (!(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(nsServer)){
obj.host = 'ya.ru';
		ns4chain.zoneNSResolv({
		    res: obj.res, 
		    host: obj.host, 
		    nsServer: nsServer, 
		    callback: function( res ){
			if (sys.is_null(res.error)){
			    ns4chain.oldResolver( {
				res: obj.res,
				name: obj.host,
				server: obj.res.nsServer,
				callback: function ( res ){
				if (sys.is_null(res.error)){
				    if (!sys.is_null(res.callback) && typeof res.callback === 'function'){
					obj.callback( res );
				    }else{
					    sys.console({level: 'error', text: 'ns4chain.zoneNS: callback is not set or not a function', obj: obj});
					}
				    }else{
					sys.console({level: 'error', text: sprintf('ns4chain.zoneNS: NS request failed: %s',res.error)});
					if (res.nsServers.length > 0){
					    delete( res.error );
					}
					--obj.res.ns4chain.length;		//Delete NS info from DNS reply if NS failed
					ns4chain.zoneNS({res: res, host: res.host, nsServers: res.nsServers, callback: res.callback});
				    }
				}
			    } );
			}else{
			    sys.console({level: 'error', text: sprintf('ns4chain.zoneNS: NS resolv request failed: %s',res.error)});
			    if (res.nsServers.length > 0){
				delete( res.error );
			    }
			    --obj.res.ns4chain.length;		//Delete NS info from DNS reply if NS failed
			    ns4chain.zoneNS({res: res, host: res.host, nsServers: res.nsServers, callback: res.callback});
			}
		    }
		});
	    }else{
		ns4chain.oldResolver( {
		    res: obj.res,
		    name: obj.host,
		    server: nsServer,
		    callback: function ( res ){
			if (sys.is_null(res.error)){
			    if (!sys.is_null(res.callback) && typeof res.callback === 'function'){
				obj.callback( res );
			    }else{
				sys.console({level: 'error', text: 'ns4chain.zoneNS: callback is not set or not a function', obj: obj});
			    }
			}else{
			    sys.console({level: 'error', text: sprintf('ns4chain.zoneNS: NS request failed: %s',res.error)});
			    if (res.nsServers.length > 0){
				delete( res.error );
			    }
			    --obj.res.ns4chain.length;		//Delete NS info from DNS reply if NS failed
			    ns4chain.zoneNS({res: res, host: res.host, nsServers: res.nsServers, callback: res.callback});
			}
		    }
		} );
	    }
	}else{
	    sys.console({level: 'debug', text: 'ns4chain.zoneNS: No NS servers left, return'});
	    if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
		obj.callback( obj.res );
	    }else{
		sys.console({level: 'error', text: 'ns4chain.zoneNS: callback is not set or not a function', obj: obj});
	    }
	}
    }else{
	if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
	    obj.res.error=error;
	    obj.callback( obj.res );
	}else{
	    sys.console({level: 'error', text: 'ns4chain.zoneNS: callback is not set or not a function', obj: obj});
	}
    }
}

ns4chain.zoneNSResolv = function( obj ){
    var error = null;
    if (sys.is_null(obj.nsServer)){
	error='ns4chain.zoneNSResolv: NS server is not set or null';
	sys.console({level: 'error',text: error,obj: obj});
    }

    if (sys.is_null(error)){
	sys.console({level: 'debug', text: sprintf('Trying to resolv NS name %s',obj.nsServer)});
	try {
	    request = dnsSource.lookup(obj.nsServer, function (err, nsIP, result) {
		var error = null;
		obj.res.nsServer = nsIP;
		sys.console({level: 'debug', text: sprintf('NS name %s resolved to %s',obj.nsServer,obj.res.nsServer)});
		if (!sys.is_null(err)){
		    error=sprintf('Resolv error on NS name %s: %j',obj.nsServer,err);
		}else{
		    if (sys.is_null(nsIP)){
			error=sprintf('Cant resolv NS name %s to IP',obj.nsServer);
		    }else{ 
			if (!(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/).test(nsIP)){
			    error=sprintf('NS name %s resolved to [%s]',obj.nsServer,nsIP);
			}else{
			     if (!sys.is_null(nsIP)){
			        if (nsIP == '127.0.0.1'){
				    error=sprintf('NS name %s is point to localhost [%s]',obj.nsServer,nsIP);
				}else if (nsIP == dns.address().address){
				    error=sprintf('NS name %s is point to myself [%s]',obj.nsServer,nsIP);
				}
			    }
			}
		    }
		}
		if (!sys.is_null(error)){
		    obj.res.error = error;
		}else{
		    //add info about from where authoritative answer can be received from
		    ns4chain.addAuthority({res: obj.res, name: obj.res.domain, data: obj.nsServer, address: obj.res.nsServer});
		}
		if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
		    obj.callback( obj.res );
		}else{
		    sys.console({level: 'error', text: 'ns4chain.zoneNSResolv: callback is not set or not a function', obj: obj});
		}
	    });
	}
	catch(e){
	    sys.console({level: 'error', text: 'ns4chain.zoneNSResolv: failed', obj: e});
	}
    }else{
	if (!sys.is_null(obj.callback) && typeof obj.callback === 'function'){
	    obj.res.error=error;
	    obj.callback( obj.res );
	}else{
	    sys.console({level: 'error', text: 'ns4chain.zoneNSResolv: callback is not set or not a function', obj: obj});
	}
    }
}

ns4chain.addAuthority = function( obj ){
	obj.res.response.authority.push({
	    name: obj.name,
	    type: 2,
	    class: obj.res.class,
	    data: obj.data,
	    ttl: config.ttl,
	});
	obj.res.response.additional.push({
	    name: obj.data,
	    type: 1,
	    class: obj.res.class,
	    address: obj.address,
	    ttl: config.ttl,
	});
}

ns4chain.addSOA = function( obj ){
	    obj.res.response.authority.push({
		name: obj.name,
		type: 6,
		class: obj.res.class,
		primary: config.dnsName,
		admin: '',
		serial: sys.unixtime(),
		refresh: 600,
		retry: 600,
		expiration: 7200,
		minimum: 600,
		ttl: config.ttl,
	    });
}

module.exports = ns4chain;