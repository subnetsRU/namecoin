/*
    ns4chain core functions :: https://github.com/subnetsRU/namecoin

    (c) 2017 SUBNETS.RU for bitname.ru project (Moscow, Russia)
    Authors: Nikolaev Dmitry <virus@subnets.ru>, Panfilov Alexey <lehis@subnets.ru>
*/

var is_null = function ( value ){
    if ( value === undefined ){
	return 1;
    }else if ( value === null ){
	return 1;
    }else if ( value == 0 ){
	return 1;
    }else if ( value == '' ){
	return 1;
    }
 return 0;
}

var unixtime = function(){
    return parseInt(new Date().getTime()/1000);
}

var ndate = function(){
    var u = new Date();
    return sprintf("%s.%s.%s %s:%s:%s",(u.getDate() < 10 ? '0' : '') + u.getDate(),(u.getMonth() < 9 ? '0' : '') + (u.getMonth() + 1),u.getFullYear(),(u.getHours() < 10 ? '0' : '') + u.getHours(),(u.getMinutes() < 10 ? '0' : '') + u.getMinutes(),(u.getSeconds() < 10 ? '0' : '') + u.getSeconds());
}

var myConsole = function( obj ){
	var time = ndate();
	var options = {
	    level: 'none',
	    text: '',
	    obj: '',
	}

	if( !is_null( obj ) && typeof obj == 'object' ){
	    if( !is_null( obj.level ) ){
		options.level = obj.level;
	    }
	    if( !is_null( obj.text ) ){
		options.text = obj.text;
	    }
	    if( !is_null( obj.obj ) ){
		options.obj = obj.obj;
	    }
	}
	if( options.level == 'error' ){
	    console.error( '['+time+'] [ERROR]: ' + options.text, options.obj );
	}else if( options.level == 'warn' ){
	    if ( config.DEBUG == 2 || config.DEBUG == 3 ){
		console.warn('['+time+'] [WARN]: '+ options.text, options.obj );
	    }
	}else if( options.level == 'info' ){
	    if ( config.DEBUG == 2 || config.DEBUG == 3 ){
		console.info('['+time+'] [INFO]: ' + options.text, options.obj );
	    }
	}else if( options.level == 'debug' ){
	    if ( config.DEBUG == 2 || config.DEBUG == 3 ){
		console.info('['+time+'] [DEBUG]: ' + options.text, options.obj );
	    }
	}else{
	    console.log( '['+time+'] ' + options.text, options.obj );
	}
	if (config.DEBUG == 1 || config.DEBUG == 3){
	    sys.logg(options.text);
	    sys.logg(options.obj);
	}
}

var logg = function ( data ){
    var u = new Date();
    var logName = sprintf("%s-%s-%s.server.log",u.getFullYear(),(u.getMonth() < 9 ? '0' : '') + (u.getMonth() + 1),(u.getDate() < 10 ? '0' : '') + u.getDate());
    var path = __dirname + '/' + config.logDir + '/' + logName;

    if ( data !== undefined && data !='' ){
	var text ='[' + sys.ndate() + '] ';
	text +=  util.inspect(data, { showHidden: true, depth: 2, colors: false });
	var buffer = new Buffer(text+'\n');
	fs.open(path, 'a+', function(err, fd) {
	    if (err) {
		//throw 'error opening file: ' + err;
		sys.console({level: 'error', text: 'Can`t open file ' + path + ' for writing'});
	    }
	    fs.write(fd, buffer, 0, buffer.length, null, function(err) {
		//if (err) throw 'error writing file: ' + err;
		if (err){
		    sys.console({level: 'error', text: 'Can`t open write to file ' + path});
		}
		fs.close(fd, function() { })
	    });
	});
    }
}

var cloneObj = function( obj ) {
    var ret = {}; 
    for ( var k in obj ){
	ret[k] = obj[k];
    }
 return ret; 
}
function IsJsonString(str) {
    try {
	JSON.parse(str);
    } catch (e) {
	return false;
    }
 return true;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*
    https://habrahabr.ru/post/217901/
    module.exports.<FUNCTION NAME AFTER EXPORT> = <FUNCTION NAME HERE>;
*/

module.exports.is_null = is_null;
module.exports.console = myConsole;
module.exports.cloneObj = cloneObj;
module.exports.unixtime = unixtime;
module.exports.ndate = ndate;
module.exports.logg = logg;
module.exports.IsJsonString = IsJsonString;
