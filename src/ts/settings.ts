interface Settings {
	rootFamilyId: string;
	layout: {
		ringSpacing: number;
		width: number;
		textSize: number;
	},
	force: {
		constraintStrength: number;
		gravity: number;
		childLinkDistance: number;
		parentLinkDistance: number;
		charge: number;
		friction: number;
		alpha: number;
		xmlPath: string;
	}
}

var settings: Settings = require('./settings.json');

export default settings;
