module.exports = ( setConfig, getConfig, lint, setI18N, getI18N ) => {
	self.onmessage = async ( { data: [ command, code ] } ) => {
		switch ( command ) {
			case 'setConfig':
				setConfig( code );
				break;
			case 'getConfig':
				postMessage( [ command, getConfig() ] );
				break;
			case 'setI18N':
				setI18N( code );
				break;
			case 'getI18N':
				postMessage( [ command, getI18N() ] );
				break;
			case 'lint':
				postMessage( [ command, await lint( code ), code ] );
		}
	};
};
