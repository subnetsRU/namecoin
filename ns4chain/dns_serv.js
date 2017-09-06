#!/usr/bin/env node
/*
    ns4chain :: https://github.com/subnetsRU/namecoin

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

fs = require('fs');                             //https://nodejs.org/api/fs.html
util = require('util');                         //https://nodejs.org/api/util.html
sprintf = require("sprintf-js").sprintf;        //https://www.npmjs.com/package/sprintf-js
dnsSource = require('native-dns');		//https://github.com/tjfontaine/node-dns

config = require('./dns_serv_options');
config.version = '0.4.3';
sys = require('./dns_func');
rpc = require('./rpc_client');

var argv = process.argv.slice(2);
while (argv[0] && argv[0][0] == '-') {
    switch (argv[0]) {
	case '-p':
	case '--port':
	    config.port = argv[1];
	    argv = argv.slice(2);
	    break;
	case '-l':
	case '--listen':
	    config.listen = argv[1];
	    argv = argv.slice(2);
	    break;
	case '-h':
	case '--help':
	    argv = argv.shift();
	    dns_serv_help();
	    break;
	default:
	    sys.console({level: 'error', text: sprintf('unknown option [%s], for help run:\n\tnode %s -h',argv[0],process.mainModule.filename)});
	    process.exit(1);
    }
}

dns = dnsSource.createServer({ dgram_type: 'udp4' });

dns.on('listening', function(){
    sys.console({level: 'info', text: sprintf('Starting DNS server v%s on %j',config.version,dns.address())});
});

dns.on('request', function (request, response) {
    try {
	var error;
	var domain = request.question[0].name.toLowerCase();
	var type = dnsSource.consts.QTYPE_TO_NAME[request.question[0].type];
	sys.console({level: 'info', text: 'Got request from ['+request.address.address+':'+request.address.port+'] for ['+type+'] ['+domain+']'});
	//for rcode see node_modules/native-dns-packet/consts.js -> NAME_TO_RCODE
	if (!(/\.bit/.test(domain))){
	    error = 'REFUSED';
	}else if (!(/^(A|AAAA|TXT|ANY)$/.test(type))){
	    error = 'NOTIMP';
	}
	
//TODO: CHECK DOMAIN NAME WITH REGEXP
	//https://wiki.namecoin.info/index.php?title=Domain_Name_Specification#Regular_Expression
	//VALID_NMC_DOMAINS = /^[a-z]([a-z0-9-]{0,62}[a-z0-9])?$/

	if (!sys.is_null(error)){
	    sys.console({level: 'info', text: sprintf('domain [%s] code %s',domain,error)});
	    response.header.rcode = dnsSource.consts.NAME_TO_RCODE[error];
	    response.send();
	}else{
	    var tmpName = domain.split('.');
	    var name = tmpName[0];
	    var zone = tmpName[tmpName.length-1];
	    var subDomain = null;
	    if (tmpName.length > 2){
		name = tmpName[tmpName.length-2];
		re = new RegExp('(.*)\.' + name + '\.' + tmpName[tmpName.length-1] + '$');
		subMatch = domain.match(re);
		if (!sys.is_null(subMatch[1])){
		    subDomain = subMatch[1];
		}
	    }
	    sys.console({level: 'debug', text: sprintf("Domain [%s] subdomain [%s]",name,subDomain)});

//TODO: Handle error => ipaddr: the address has neither IPv6 nor IPv4 format
//when reply for request return not an IP-address

	    var request = {
		response: response,
		domain: domain,
		type: type,
		name: name,
		zone: zone,
		subDomain: subDomain,
		callback: function( res ){
		    if (sys.is_null(res.error)){
			sys.console({level: 'info', text: sprintf('form reply for [%s] [%s] [%s]',res.domain,res.type, (res.type == 'AAAA' ? res.ip6 : res.ip))});
			if ((/^(TXT|ANY)$/.test(res.type))){
			    res.response.answer.push(dnsSource.TXT({
				type: res.type,
				name: res.domain,
				data: 'txid: ' + res.data.txid,
				ttl: config.ttl,
			    }));
			    res.response.answer.push(dnsSource.TXT({
				type: res.type,
				name: res.domain,
				data: 'address: ' + res.data.address,
				ttl: config.ttl,
			    }));
			    res.response.answer.push(dnsSource.TXT({
				type: res.type,
				name: res.domain,
				data: 'expires: ' + res.data.expires_in,
				ttl: config.ttl,
			    }));
			}
			if ((/^(A|AAAA|ANY)$/.test(res.type))){
			    if (!sys.is_null(res.ip) || !sys.is_null(res.ip6)){
				if (!sys.is_null(res.ip) && (/^(A|ANY)$/.test(res.type))){
				    res.response.answer.push(dnsSource.A({
					type: res.type,
					name: res.domain,
					address: res.ip,
					ttl: config.ttl,
				    }));
				}
				if (!sys.is_null(res.ip6) && (/^(AAAA|ANY)$/.test(res.type))){
				    res.response.answer.push(dnsSource.AAAA({
					type: res.type,
					name: res.domain,
					address: res.ip6,
					ttl: config.ttl,
				    }));
				}
			    }else{
				sys.console({level: 'warn', text: 'domain "'+res.domain+'" has no IP' });
				res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.NOTFOUND;
			    }
			}
			res.response.send();
		    }else{
			sys.console({level: 'error', text: res.error });
			if (sys.is_null(res.errorCode)){
			    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE.SERVFAIL;
			}else{
			    res.response.header.rcode = dnsSource.consts.NAME_TO_RCODE[res.errorCode];
			}
			res.response.send();
		    }
		}
	    };
	    rpc.lookup( request );
	}
    }catch(e){
	sys.console({level: 'error', text: 'DNS request failed', obj: request});
	console.log(e);
    }
});

dns.on('close', function(){
    sys.console({level: 'info', text: sprintf('Stop DNS server on %j',dns.address())});
});

dns.on('error', function (err, buff, req, res) {
  console.log('[ERROR]:',err.stack);
});

dns.on('socketError', function (err) {
  console.log('[ERROR] on socket:',err.stack);
});
dns.serve(config.port,config.listen);

process.on('SIGINT', onExit);
process.on('SIGTERM', onExit);

function dns_serv_help(){
    var helpText = '\n';
    helpText += 'Usage: node '+process.mainModule.filename+' [options]\n';
    helpText += 'Options:\n';
    helpText +='\t-h, --help                   This help;\n';
    helpText +='\t-l, --listen <IP>            IP to listen on;\n';
    helpText += '\t-p, --port <PORT>            Port to listen to;\n'
    sys.console({level: 'info', text: helpText});
    process.exit();
}

function onExit() {
    sys.console({level: 'info', text: 'Stoping DNS server'});
    dns.close();
    process.exit(0);
}
