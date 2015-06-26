declare var process: any;
declare function require(name);

var amd = require('./amd.js');
amd.require.config({
	paths: {}
});

amd.require(['server'], function (server) {
	server.run();
});