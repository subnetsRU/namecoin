/*
    ns4chain configuration file :: https://github.com/subnetsRU/namecoin

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

module.exports = {
    DEBUG: 0,                   	//0: off; 1: only to logfile; 2: only to console; 3: to logfile and console
    listen: '127.0.0.1',		//default: listen on IP (can be changed with startup options)
    port: '5353',			//default: listen on port (can be changed with startup options)
    ttl: 60,				//default: set this TTL in DNS reply (can be changed with startup options)
    dnsName: 'ThisDnsFQDNname',		//FQDN name for this DNS server
    logDir: 'logs',
    rpc: {
	host: 'localhost',
	port: 8336,
	user: 'username',
	pass: 'password'
    },
    oldDNS: {
	host: '8.8.8.8',
	port: 53,
	timeout: 1000,
    }
    recursion: {
	enabled: false,
	allow: ['10.0.0.0/8','192.168.0.0/16','172.16.0.0/12'],
    },
    maxalias: 16,		//max aliases to follow
};