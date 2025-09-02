const { EditorView, Text } = require( 'ext.CodeMirror.v6.lib' );

const workers = new Map();

/** Web worker for CodeMirror */
class CodeMirrorWorker {
	/**
	 * @constructor
	 * @param {string} mode
	 */
	constructor( mode ) {
		/**
		 * The mode for which the worker is created.
		 *
		 * @type {string}
		 */
		this.mode = mode;
		/**
		 * Queue of callbacks to be called when the worker is loaded.
		 *
		 * @internal
		 */
		this.queue = [];
	}

	/**
	 * The web worker for the mode.
	 *
	 * @type {Worker}
	 */
	get worker() {
		if ( !workers.has( this.mode ) ) {
			const worker = new Worker( `${
				mw.config.get( 'wgExtensionAssetsPath' )
			}/CodeMirror/resources/workers/${ this.mode }/worker.min.js` );
			workers.set( this.mode, worker );
			for ( const callback of this.queue ) {
				callback( this );
			}

			if ( mw.config.get( 'cmDebug' ) ) {
				window[ `${ this.mode }Worker` ] = worker;
			}
		}

		return workers.get( this.mode );
	}

	/**
	 * Get the response from the worker for a given command.
	 *
	 * @param {string} command
	 * @param {Text|undefined} [doc]
	 * @return {Promise}
	 * @private
	 */
	getFeedback( command, doc ) {
		return new Promise( ( resolve ) => {
			const raw = doc && doc.toString();
			const listener = ( { data: [ cmd, diagnostics, resRaw ] } ) => {
				if ( command === cmd && raw === resRaw ) {
					this.worker.removeEventListener( 'message', listener );
					resolve( diagnostics );
				}
			};
			this.worker.addEventListener( 'message', listener );
			this.worker.postMessage( [ command, raw ] );
		} );
	}

	/**
	 * Get lint diagnostics for the given document.
	 *
	 * @param {EditorView} view
	 * @return {Promise}
	 */
	lint( view ) {
		return this.getFeedback( 'lint', view.state.doc );
	}

	/**
	 * Set the configuration for the worker.
	 *
	 * @param {Object} config
	 */
	setConfig( config ) {
		this.worker.postMessage( [ 'setConfig', config ] );
	}

	/**
	 * Get the configuration for the worker.
	 *
	 * @return {Promise}
	 */
	getConfig() {
		return this.getFeedback( 'getConfig' );
	}

	/**
	 * Set the localized messages for the worker.
	 *
	 * @param {Object} i18n
	 */
	setI18N( i18n ) {
		this.worker.postMessage( [ 'setI18N', i18n ] );
	}

	/**
	 * Get the localized messages for the worker.
	 *
	 * @return {Promise}
	 */
	getI18N() {
		return this.getFeedback( 'getI18N' );
	}

	/**
	 * Set the linting configuration for the worker.
	 *
	 * @param {Object} config
	 */
	setLintConfig( config ) {
		this.worker.postMessage( [ 'setLintConfig', config ] );
	}

	/**
	 * Add a callback to be called when the worker is loaded.
	 *
	 * @param {Function} callback
	 */
	onload( callback ) {
		this.queue.push( callback );
	}

	/**
	 * Calculate the position in the document for a given line and column.
	 *
	 * @param {EditorView} view
	 * @param {number} line
	 * @param {number} column
	 * @return {number}
	 */
	static pos( view, line, column ) {
		const cmLine = view.state.doc.line( line );
		return Math.min( cmLine.from + column - 1, cmLine.to );
	}
}

module.exports = CodeMirrorWorker;
