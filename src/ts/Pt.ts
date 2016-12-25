export default class Pt {
	////
	//Pt
	// A small class to hold two dimensional point arrays

	0: number;
	1: number;

	constructor(x: number, y: number) {
		this[0] = x;
		this[1] = y;
	};

	rel(origin: Pt) {
		//return point relative to origin

		return new Pt(this[0] - origin[0], this[1] - origin[1]);
	};

	toPolar() {
		return new Pt(Math.sqrt(this[0] * this[0] + this[1] * this[1]), Math.atan2(this[1], this[0]));
	};

	fromPolar() {
		return new Pt(Math.cos(this[1]) * this[0], Math.sin(this[1]) * this[0]);
	};

	radialAlign() {
		//rotate object to center, keeping it upright

		var polarPt = this.toPolar(),
			a = polarPt[1] * 360 / 2 / Math.PI;

		if (a > 0) {
			return a - 90;
		} else {
			return a - 270;
		}
	};

	fromLocal(elem: SVGLocatable, doc: HTMLElement) {
		//convert local point coordinate to global

		var offset = doc.getBoundingClientRect(),
			matrix = elem.getScreenCTM();

		return new Pt((this[0] / matrix.a) + (this[1] / matrix.c) - matrix.e + offset.left,
			(this[0] / matrix.b) + (this[1] / matrix.d) - matrix.f + offset.top);
	};

	toLocal(elem: SVGLocatable, doc: HTMLElement) {
		//convert global point coordinate to local

		var offset = doc.getBoundingClientRect(),
			matrix = elem.getScreenCTM();

		return new Pt((matrix.a * this[0]) + (matrix.c * this[1]) + matrix.e - offset.left,
			(matrix.b * this[0]) + (matrix.d * this[1]) + matrix.f - offset.top);
	};

	toString() {
		return this[0] + ',' + this[1];
	};
}
