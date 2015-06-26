/// <reference path="server.d.ts"/>

declare var process: any;
declare function require(name);
declare function Buffer(x): void;

import _ = require('transducers');
import game = require('game');
import buff = require('buffer');
//var Buffer = Buffer;

var http = require('http'),
	wsLib = require('ws'),
	WebSocket = wsLib.WebSocket,
	WebSocketServer = wsLib.Server,
	finalHandler = require('finalhandler'),
	serveStatic = require('serve-static');
	
var wss = new WebSocketServer({ port: 8081 });

var serve = serveStatic('build');

var server = http.createServer(function (req, res) {
	var done = finalHandler(req, res);
	serve(req, res, done);
});

var connections = [];

function getConnection(id, ws) {
	var conn;
	for (var i = 0; i < connections.length; ++i) {
		var c = connections[i];
		if (c.id === id) {
			conn = c;
			break;
		}
	}

	if (!conn) {
		conn = { id: id };
		connections.push(conn);
	}

	conn.ws = ws;
	return conn;
}

function otherConnections(currentConn: any): any {
	return connections.filter(c => 
		c !== currentConn && c.ws.readyState === WebSocket.OPEN);
}

function send(ws: any, buff: buff.Buffer) {
	var b = new Buffer(new Uint8Array(buff.copyArrayBuffer()));
	ws.send(b, { binary: true });
}

var currentId = 0;

export function run() {
	wss.on('connection', function (ws) {
		process.stdout.write('connection spawned\n');

		var id, conn;

		ws.on('message', function (msgBuf) {
			var msg = new buff.Buffer(new Uint8Array(msgBuf).buffer);
			var msgType = msg.getU8();

			switch (msgType) {
				case MessageType.Hello: {
					console.log('got hello');
					id = currentId++; // TODO: Get ID from caller
					conn = getConnection(id, ws);

					send(ws, buff.beginMessage(MessageType.Hello));
					break;
				}

				default:
					otherConnections(conn).forEach(c => {
						c.ws.send(msgBuf, { binary: true});
					});
					break;
			}

			//process.stdout.write(JSON.stringify(msg) + '\n');
		});

		ws.on('close', function () {
			process.stdout.write('connection closed\n');
		});
	});

	var port = 8080;
	process.stdout.write('listening to port ' + port + '\n');
	server.listen(port);
}

