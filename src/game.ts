/// <reference path="game.d.ts"/>
/// <reference path="server.d.ts"/>

import _ = require("transducers");
import buff = require("buffer");
import actions = require("actions");

declare var Uint8ClampedArray;

class Tank {
	x: number;
	y: number;
	xvel: number;
	yvel: number;
	angle: number;

	clone(): Tank {
		var tank = new Tank(this.x, this.y);
		tank.xvel = this.xvel;
		tank.yvel = this.yvel;
		tank.angle = this.angle;
		return tank;
	}

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.xvel = 0;
		this.yvel = 0;
		this.angle = 0;
	}

	write(buffer: buff.Buffer) {
		buffer.putNumber(this.x);
		buffer.putNumber(this.y);
		buffer.putNumber(this.xvel);
		buffer.putNumber(this.yvel);
		buffer.putNumber(this.angle);
	}

	read(buffer: buff.Buffer) {
		this.x = buffer.getNumber();
		this.y = buffer.getNumber();
		this.xvel = buffer.getNumber();
		this.yvel = buffer.getNumber();
		this.angle = buffer.getNumber();
	}
}

class Particle {
	x: number;
	y: number;

	clone(): Particle {
		return new Particle(this.x, this.y);
	}

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
}

function getMaterial(x: number, y: number, map: Uint32Array, pitch: number): number {
	return (map[y * pitch + x] || 0) >> 24;
}

class Player {
	tankId: number;

	constructor() {

	}
}

function action(game: Game, name: string, ar: any, apply: (action: any, state: State) => void) {
	var id = game.currentActionId++;
	var proto = {
		apply: function (state) {
			apply(this, state);
		},
		write: function (buffer: buff.Buffer) {
			ar({
				u8: (name) => {
					buffer.putU8(this[name]);
				}
			});
		}
	};

	game[name] = function (params) {
		var ac = Object.create(proto);
		Object.keys(params).forEach(p => {
			ac[p] = params[p];
		});
		return ac;
	};
	
	game.actions[id] = function (buffer: buff.Buffer) {
		var ac = Object.create(proto);
		ar({
			u8: function (name) {
				ac[name] = buffer.getU8();
			}
		});
	};
}

interface IGame {
	foo?: () => void;
}

class Game implements IGame {
	state: State;
	players: Player[];
	actions: any[];
	currentActionId: number;

	constructor(width: number, height: number) {
		var game = this;
		this.state = new State(width, height);
		this.players = [];
		this.currentActionId = 0;

		action(this, 'addPlayer', ar => {
			ar.u8('id');
		}, (action, state) => {
			game.players[action.id] = new Player(); // TODO
		})
	}
}

export class State {
	map: Uint32Array;
	particles: Particle[];
	tanks: Tank[];
	width: number;
	height: number;

	constructor(width: number, height: number) {
		this.particles = [];
		this.tanks = [new Tank(20, 20)];
		this.width = width;
		this.height = height;
	}

	generateMap() {
		var width = this.width;
		var height = this.height;

		var map = new Uint32Array(width * height);

		var h = (Math.random() * height) | 0;
		var d = 0;
		var th = 5;
		var dth = 0;
		for (var x = 0; x < width; x = (x + 1) | 0) {

			var bias = -(h - height/2) * 0.5 / height;
	 		d += (Math.random() - 0.5 + bias) * 0.25;
		 	h += d;

		 	var biasth = 0;
		 	if (th > 10)
		 		dth -= 0.1;
	 		else if (th < 3)
	 			dth += 0.1;

		 	dth += (Math.random() - 0.5) * 0.1;
		 	//th += dth;

			for (var y = 0; y < h; ++y) {
				map[y * width + x] = (255 << 24);
			}

			for (; y < h + th; ++y) {
				map[y * width + x] = (Material.Blocking << 24) + 0x257025 + ((Math.random() * 20) | 0) * 0x020202;
			}

		 	for (; y < height; ++y) {
		 		map[y * width + x] = (Material.Blocking << 24) + 0x157090 + ((Math.random() * 20) | 0) * 0x020202;
		 	}
		}

		this.map = map;
	}

	step() {
		this.tanks.forEach(t => {
			if (!t) return;

		});
	}

	clone(): State {
		var newState = new State(this.width, this.height);

		newState.map = new Uint32Array(this.map);
		newState.particles = this.particles.map(p => p.clone());
		newState.tanks = this.tanks.map(t => t && t.clone());
		return newState;
	}

	render(dest: Uint32Array) {
		for (var i = 0; i < this.map.length; i = (i + 1) | 0) {
			dest[i] = this.map[i] | 0xff000000;
		}

		this.tanks.forEach(t => {
			if (!t) return;
			var x = t.x | 0;
			var y = t.y | 0;

			dest[y * this.width + x] = 0xffffffff;
		});
	}
}

class Client {
	socket: WebSocket;
	buffer: buff.Buffer;

	constructor() {
		var socket = new WebSocket("ws://localhost:8081");
		socket.binaryType = 'arraybuffer';
		this.socket = socket;

		this.socket.onopen = function () {
			var buf = buff.beginMessage(MessageType.Hello);
			socket.send(buf.copyArrayBuffer());
		}

		this.socket.onmessage = function (ev) {
			console.log(ev.data);
		}
	}
}

function keySignal(node, filter) {
	var s = _.sig();

	var state = [];

	function unreg() {
		node.removeEventListener("keydown", keydown);
		node.removeEventListener("keyup", keyup);
	}

	function keydown(ev: KeyboardEvent) {
		if (!filter[ev.keyCode]) {
			return;
		}

    	if (!state[ev.keyCode] && s.r({ k: ev.keyCode, s: true})) {
    		unreg();
    	}

    	state[ev.keyCode] = true;
    	ev.preventDefault();
	}

	function keyup(ev: KeyboardEvent) {
		if (!filter[ev.keyCode]) {
			return;
		}

    	if (state[ev.keyCode] && s.r({ k: ev.keyCode, s: false})) {
    		unreg();
    	}

    	state[ev.keyCode] = false;
    	ev.preventDefault();
	}

	node.addEventListener("keydown", keydown);
	node.addEventListener("keyup", keyup);

	return s;
}

export function run() {
	var canvas: any = document.getElementById("slate");
	var ctx = canvas.getContext("2d");

    var canvasWidth = 1024;
    var canvasHeight = 768;

    var imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

	var buf = new ArrayBuffer(imageData.data.length);
	var buf8 = new Uint8ClampedArray(buf);
	var data = new Uint32Array(buf);

    var start, prev;
    var s = 0;

    var game = new Game(canvasWidth, canvasHeight);
    game.state.generateMap();

	var keyS = keySignal(document, { 37: true, 38: true, 39: true, 40: true });

	keyS.to(ev => { console.log(ev) });

    var client = new Client();

    function step(timestamp) {
        //prev = prev || timestamp;
        //var progress = timestamp - prev;
        prev = timestamp;
        //ctx.fillStyle = "green";
        //var x = Math.floor(Math.random() * 1024);
        //var y = Math.floor(Math.random() * 768);
        //ctx.fillRect(x, y, 10, 10);
        //}

        ++s;

        game.state.render(data);

        /*
        for (var y = 0; y < canvasHeight; ++y) {
		    for (var x = 0; x < canvasWidth; ++x) {
		        //var value = ((x + s) ^ (y * s)) & 0xff;

		        var s = Math.floor(x * x + y * y);

		        var s2 = s * 17;
		        var s3 = Math.floor(s / 17);

		        var r = ((x + s) ^ (y * s)) & 0xff;
		        var g = ((y + s2) ^ (x * s2)) & 0xff;
		        var b = ((y ^ x) + s3) & 0xff;

		        data[y * canvasWidth + x] =
		            (255   << 24) |    // alpha
		            (b << 16) |    // blue
		            (g <<  8) |    // green
		             r;            // red
		    }
		}*/

        imageData.data.set(buf8);
        ctx.putImageData(imageData, 0, 0);

        //window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
}