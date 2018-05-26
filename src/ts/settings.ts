interface Settings {
	rootFamilyId: string;
	dataPath: string;
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

export default require('./settings.json') as Settings;
