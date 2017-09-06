/*
    ns4chain configuration file :: https://github.com/subnetsRU/namecoin

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

module.exports = {
    DEBUG: 2,                   //0: off; 1: only to logfile; 2: only to console; 3: to logfile and console
    listen: '127.0.0.1',	//default: listen on IP
    port: '5353',		//default: listen on port
    ttl: 60,			//reply with TTL
    logDir: 'logs',
    rpc: {
	host: 'localhost',
	port: 8336,
	user: 'username',
	pass: 'password'
    }
};