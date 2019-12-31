interface Settings {
	rootFamilyId: string;
	dataPath: string;
	layout: {
		ringSpacing: number;
		width: number;
		textSize: number;
	}
}

export default require('./settings.json') as Settings;
