
import buff = require('buffer');

interface Serializable {
	write(buffer: buff.Buffer);
	read(buffer: buff.Buffer);
}

interface Action extends Serializable {
	time: number;
	apply(state): void;
	read(buffer: buff.Buffer): void;
	write(buffer: buff.Buffer): void;
}

class ActionClass {
	time: number;
}

class AddPlayer extends ActionClass {
	id: number;

	apply(state: any) {

	}

	read(buffer: buff.Buffer): void {
		this.id = buffer.getU8();
	}

	write(buffer: buff.Buffer): void {
		buffer.putU8(MessageType.AddPlayer);
		buffer.putU8(this.id);
	}
}


var actionConstructors = [
	null,
	AddPlayer,

];

function readAction(buffer: buff.Buffer) {
	var t = buffer.getU8();

	var ctor = actionConstructors[t];
	if (!ctor) return null;

	var action: Action = new ctor();
	action.read(buffer);
	return action;
}