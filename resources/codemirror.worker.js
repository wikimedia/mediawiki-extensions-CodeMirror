const { EditorView, Text } = require( 'ext.CodeMirror.v6.lib' );

const workers = new Map();

/** Web worker for CodeMirror */
class CodeMirrorWorker {
	/**
	 * @constructor
	 * @param {string} lang
	 */
	constructor( lang ) {
		/**
		 * The language for which the worker is created.
		 *
		 * @type {string}
		 */
		this.lang = lang;
		/**
		 * The web worker for the language.
		 *
		 * @type {Worker}
		 */
		this.worker = workers.get( lang );
		if ( !this.worker ) {
			this.worker = new Worker( `${
				mw.config.get( 'wgExtensionAssetsPath' )
			}/CodeMirror/resources/workers/${ lang }/worker.min.js` );
			workers.set( lang, this.worker );
		}
	}

	/**
	 * Get the response from the worker for a given command.
	 *
	 * @param {string} command
	 * @param {Text|undefined} doc
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
