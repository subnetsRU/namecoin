DNS server on NodeJS for .bit domains
=================

Install instruction
--------------------

```sh
# mkdir /home/dot-bit
# cd /home/dot-bit
# git clone https://github.com/subnetsRU/namecoin.git
# cd /home/dot-bit/namecoin/ns4chain
# npm install native-dns
# npm install json-rpc2
# npm install fs
# npm install util
# npm install sprintf-js
# npm install insubnet
```
Than edit configuration file dns_serv_options.js and set RPC info and other options.

Usage: node dns_serv.js [options]

Options:
* -h, --help
* -d, --debug <none|log|cli|full>
* -l, --listen <IP>
* -p, --port <PORT>
* -t, --ttl <NUMBER>
* -r, --recursion

Note: Startup options override configuration options.

Examples:
```sh
# node /home/dot-bit/namecoin/ns4chain/dns_serv.js -l 127.0.0.1 -p 53 -d cli -t 300
OR
# node /home/dot-bit/namecoin/ns4chain/dns_serv.js --listen 127.0.0.1 --port 53 --debug cli --ttl 300
```

Update instruction
--------------------
* replace all files exept dns_serv_options.js
* compare differences in your dns_serv_options.js
