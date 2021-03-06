/*
 * 
 */

/**
 * Creates a new, empty "traditional view" controller.
 * @constructor
 * @class
 * This class manages the two-pane message view. The top pane contains a list
 * view of the messages in the conversation, and the bottom pane contains the current
 * message.
 *
 * @author Parag Shah
 * 
 * @param {ZmComposite}	container	the containing shell
 * @param {ZmMailApp}	mailApp			the containing app
 * 
 * @extends		ZmDoublePaneController
 * 
 * @private
 */
ZmTradController = function(container, mailApp) {
	ZmDoublePaneController.call(this, container, mailApp);
	this._msgControllerMode = ZmId.VIEW_TRAD;
};

ZmTradController.prototype = new ZmDoublePaneController;
ZmTradController.prototype.constructor = ZmTradController;

ZmMailListController.GROUP_BY_ITEM[ZmId.VIEW_TRAD]		= ZmItem.MSG;
ZmMailListController.GROUP_BY_SETTING[ZmId.VIEW_TRAD]	= ZmSetting.GROUP_BY_MESSAGE;

// view menu
ZmMailListController.GROUP_BY_ICON[ZmId.VIEW_TRAD]		= "MessageView";
ZmMailListController.GROUP_BY_MSG_KEY[ZmId.VIEW_TRAD]	= "byMessage";
ZmMailListController.GROUP_BY_SHORTCUT[ZmId.VIEW_TRAD]	= ZmKeyMap.VIEW_BY_MSG;
ZmMailListController.GROUP_BY_VIEWS.push(ZmId.VIEW_TRAD);

// Public methods

ZmTradController.prototype.toString = 
function() {
	return "ZmTradController";
};

ZmTradController.prototype.show =
function(search) {
	this._list = search.getResults(ZmItem.MSG);

	// call base class
	ZmDoublePaneController.prototype.show.call(this, search, this._list);
	appCtxt.set(ZmSetting.GROUP_MAIL_BY, ZmSetting.GROUP_BY_MESSAGE);
	this._resetNavToolBarButtons(ZmId.VIEW_TRAD);
};

// Private methods

ZmTradController.prototype._createDoublePaneView = 
function() {
	return (new ZmTradView({parent:this._container, posStyle:Dwt.ABSOLUTE_STYLE,
							controller:this, dropTgt:this._dropTgt}));
};

ZmTradController.prototype._getViewType =
function() {
	return ZmId.VIEW_TRAD;
};

ZmTradController.prototype._paginate = 
function(view, bPageForward, convIdx, limit) {
	view = view ? view : this._currentView;
	return ZmDoublePaneController.prototype._paginate.call(this, view, bPageForward, convIdx, limit);
};

ZmTradController.prototype._resetNavToolBarButtons = 
function(view) {

	ZmDoublePaneController.prototype._resetNavToolBarButtons.call(this, view);
	if (!this._navToolBar[view]) { return; }

	this._navToolBar[view].setToolTip(ZmOperation.PAGE_BACK, ZmMsg.previousPage);
	this._navToolBar[view].setToolTip(ZmOperation.PAGE_FORWARD, ZmMsg.nextPage);
};

ZmTradController.prototype._getMoreSearchParams = 
function(params) {
	// OPTIMIZATION: find out if we need to pre-fetch the first hit message
	params.fetch = this.isReadingPaneOn();
	params.markRead = true;
};

ZmTradController.prototype._listSelectionListener =
function(ev) {
	var item = ev.item;
	if (!item) { return; }
	var handled = ZmDoublePaneController.prototype._listSelectionListener.apply(this, arguments);
	if (!handled && ev.detail == DwtListView.ITEM_DBL_CLICKED) {
		var respCallback = new AjxCallback(this, this._handleResponseListSelectionListener, item);
		var ctlr = AjxDispatcher.run("GetMsgController", item.nId);
		ctlr.show(item, this._msgControllerMode, respCallback, true);
	}
};

// Callbacks

ZmTradController.prototype._handleResponsePaginate = 
function(view, saveSelection, loadIndex, offset, result, ignoreResetSelection) {
	// bug fix #5134 - overload to ignore resetting the selection since it is handled by setView
	ZmMailListController.prototype._handleResponsePaginate.call(this, view, saveSelection, loadIndex, offset, result, true);
};
