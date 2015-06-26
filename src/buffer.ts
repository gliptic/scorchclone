export class Buffer {
	buf: DataView;
	pos: number;

	constructor(arrayBuffer: ArrayBuffer) {
		this.buf = new DataView(arrayBuffer);
		this.pos = 0;
	}

	enlarge() {
		var arr = new Uint8Array(this.buf.byteLength * 2);
		arr.set(<any>this.buf, 0);
		this.buf = new DataView(arr.buffer);
	}

	putNumber(n: number) {
		if (this.pos + 8 > this.buf.byteLength) this.enlarge();
		this.buf.setFloat64(this.pos, n, true);
		this.pos += 8;
	}

	putU8(n: number) {
		if (this.pos >= this.buf.byteLength) this.enlarge();
		this.buf.setUint8(this.pos, n);
		++this.pos;
	}

	getNumber(): number {
		var v = this.buf.getFloat64(this.pos, true);
		this.pos += 8;
		return v;
	}

	getU8(): number {
		var v = this.buf.getUint8(this.pos);
		++this.pos;
		return v;
	}

	copyArrayBuffer(): ArrayBuffer {
		return this.buf.buffer.slice(0, this.pos);
	}
}

var tempBuffer = new Buffer(new ArrayBuffer(16));
export function beginMessage(type: MessageType): Buffer {
	tempBuffer.pos = 0;
	tempBuffer.putU8(type);
	return tempBuffer;
}