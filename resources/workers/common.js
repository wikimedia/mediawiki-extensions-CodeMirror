module.exports = ( setConfig, getConfig, lint ) => {
	self.onmessage = async ( { data: [ command, code ] } ) => {
		switch ( command ) {
			case 'setConfig':
				setConfig( code );
				break;
			case 'getConfig':
				postMessage( [ command, getConfig() ] );
				break;
			case 'lint':
				postMessage( [ command, await lint( code ), code ] );
		}
	};
};
