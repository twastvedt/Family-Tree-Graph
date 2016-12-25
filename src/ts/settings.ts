interface Settings {
	rootFamilyId: string;
	ringSpacing: number;
	width: number;
	constraintStrength: number;
	gravity: number;
	childLinkDistance: number;
	parentLinkDistance: number;
	charge: number;
	friction: number;
	alpha: number;
	xmlPath: string;
}

var settings: Settings = require('./settings.json');

export default settings;
