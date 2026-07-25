/*!
 * VisualEditor UserInterface CodeMirrorPreferencesPage class.
 */

/**
 * Page of VisualEditor's options dialog for CodeMirror's preferences.
 *
 * The fields come from the active controller's `supportedPreferences`, and changes are applied
 * through its `applyPreference()`, since what is honoured differs by controller. Preferences locked
 * with {@link CodeMirrorPreferences#lockPreference} are omitted rather than shown disabled,
 * since they are locked precisely because they can have no effect here.
 *
 * The other pages in that dialog edit the document, so the dialog's staging applies or discards
 * them. These are user preferences, saved through the API, so nothing stages them: changes are
 * buffered here and only written when the dialog is torn down with the 'done' action.
 *
 * @class
 * @extends OO.ui.PageLayout
 * @constructor
 * @param {string} name Unique symbolic name of page
 * @param {Object} [config] Configuration options
 */
ve.ui.CodeMirrorPreferencesPage = function VeUiCodeMirrorPreferencesPage() {
	// Parent constructor
	ve.ui.CodeMirrorPreferencesPage.super.apply( this, arguments );

	/**
	 * Preference values changed since the dialog opened, written on 'done'.
	 *
	 * @type {Object<string, boolean|string>}
	 */
	this.changes = {};
	/** @type {CodeMirrorPreferences|null} */
	this.preferences = null;

	this.fieldset = new OO.ui.FieldsetLayout( {
		label: ve.msg( 'codemirror-toggle-label' ),
		icon: 'highlight'
	} );
	this.$element
		.addClass( 've-ui-codeMirrorPreferencesPage' )
		.append( this.fieldset.$element );
};

/* Inheritance */

OO.inheritClass( ve.ui.CodeMirrorPreferencesPage, OO.ui.PageLayout );

/* Static properties */

ve.ui.CodeMirrorPreferencesPage.static.name = 'codeMirrorPreferences';

ve.ui.CodeMirrorPreferencesPage.static.modes = [ 'source' ];

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.CodeMirrorPreferencesPage.prototype.setupOutlineItem = function () {
	this.outlineItem
		.setIcon( 'highlight' )
		.setLabel( ve.msg( 'codemirror-toggle-label' ) );
};

/**
 * Fieldsets, for the dialog's change tracking.
 *
 * @return {OO.ui.FieldsetLayout[]}
 */
ve.ui.CodeMirrorPreferencesPage.prototype.getFieldsets = function () {
	return [ this.fieldset ];
};

/**
 * The surface being edited, if any.
 *
 * @return {ve.ui.Surface|null}
 * @private
 */
ve.ui.CodeMirrorPreferencesPage.prototype.getEditorSurface = function () {
	return ( ve.init.target && ve.init.target.getSurface() ) || null;
};

/**
 * The running CodeMirror instance, if any.
 *
 * @return {CodeMirror|null}
 * @private
 */
ve.ui.CodeMirrorPreferencesPage.prototype.getMirror = function () {
	const surface = this.getEditorSurface();
	return ( surface && surface.mirror ) || null;
};

/**
 * @param {ve.dm.SurfaceFragment} fragment
 * @param {Object} config
 */
ve.ui.CodeMirrorPreferencesPage.prototype.setup = function () {
	const surface = this.getEditorSurface(),
		mirror = ( surface && surface.mirror ) || null;
	this.changes = {};
	this.preferences = mirror ? mirror.preferences : null;
	this.fieldset.clearItems();

	// The dialog has already enabled or disabled the page for the current mode, so only ever
	// tighten that: the preferences object exists once CodeMirror has been initialized, and
	// turning highlighting on is what makes the page usable.
	if ( !this.preferences ) {
		this.outlineItem.setDisabled( true );
		return;
	}
	const fields = this.orderPreferences( mirror.supportedPreferences ).map(
		( name ) => this.getField( name )
	).filter( Boolean );
	if ( !fields.length ) {
		this.outlineItem.setDisabled( true );
	}
	this.fieldset.addItems( fields );
};

/**
 * Sort preferences into the order CodeMirror's own dialog shows them, so the two integrations
 * agree. Anything the dialog does not place in a section goes last, as it does there.
 *
 * @param {string[]} names
 * @return {string[]}
 * @private
 */
ve.ui.CodeMirrorPreferencesPage.prototype.orderPreferences = function ( names ) {
	const sectioned = [].concat( ...Object.values( this.preferences.dialogConfig ) );
	return [
		...sectioned.filter( ( name ) => names.includes( name ) ),
		...names.filter( ( name ) => !sectioned.includes( name ) )
	];
};

/**
 * Build the field for one preference, from its form specification if it has one.
 *
 * @param {string} name
 * @return {OO.ui.FieldLayout|null} Null if the preference has no field here
 * @private
 */
ve.ui.CodeMirrorPreferencesPage.prototype.getField = function ( name ) {
	if ( this.preferences.disabledPreferences.has( name ) ) {
		return null;
	}
	const value = this.preferences.getPreference( name ),
		spec = this.preferences.formSpecification.get( name ),
		type = ( spec && spec.type ) || 'checkbox';
	let widget;

	switch ( type ) {
		case 'checkbox':
			widget = new OO.ui.CheckboxInputWidget( { selected: !!value } );
			break;
		case 'select':
			widget = new OO.ui.DropdownInputWidget( {
				options: Array.from( spec.options ).map(
					( [ message, data ] ) => ( { data, label: ve.msg( message ) } )
				),
				value
			} );
			break;
		case 'text':
			widget = new OO.ui.TextInputWidget( {
				value: typeof value === 'string' ? value : '',
				placeholder: spec.placeholder ? ve.msg( spec.placeholder ) : ''
			} );
			break;
		default:
			// Complain rather than silently dropping the preference from the page.
			mw.log.warn( `[CodeMirror] No field for preference form type "${ type }": ${ name }` );
			return null;
	}

	widget.connect( this, { change: [ 'onFieldChange', name, widget ] } );
	return new OO.ui.FieldLayout( widget, {
		// 'text' fields carry a placeholder rather than a label, so they fall back to the
		// message convention that plain checkboxes use.
		// Messages that may be used here include:
		// * codemirror-prefs-bracketmatching
		// * codemirror-prefs-highlightrefs
		// * codemirror-prefs-linenumbering
		// * codemirror-prefs-linewrapping
		// * codemirror-prefs-theme
		label: ve.msg( spec && spec.label ? spec.label : `codemirror-prefs-${ name.toLowerCase() }` ),
		align: type === 'checkbox' ? 'inline' : 'top'
	} );
};

/**
 * Buffer a change until the dialog is closed.
 *
 * @param {string} name
 * @param {OO.ui.Widget} widget
 * @private
 */
ve.ui.CodeMirrorPreferencesPage.prototype.onFieldChange = function ( name, widget ) {
	this.changes[ name ] = widget instanceof OO.ui.CheckboxInputWidget ?
		widget.isSelected() :
		widget.getValue();
};

/**
 * @param {Object} [data]
 * @param {string} [data.action] Dialog action the user closed with
 */
ve.ui.CodeMirrorPreferencesPage.prototype.teardown = function ( data = {} ) {
	const mirror = this.getMirror();
	if ( data.action === 'done' && mirror && this.preferences ) {
		for ( const name in this.changes ) {
			// setPreference only persists, so the controller applies it to the live editor.
			mirror.applyPreference( name, this.changes[ name ] );
			this.preferences.setPreference( name, this.changes[ name ] );
		}
	}
	this.changes = {};
};

/* Registration */

ve.ui.mwMetaDialogPageFactory.register( ve.ui.CodeMirrorPreferencesPage );
