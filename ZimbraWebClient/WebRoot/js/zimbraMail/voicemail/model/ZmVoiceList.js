/*
 * 
 */

/**
 * Creates an empty list of voicemails.
 * @constructor
 * @class
 * This class represents a list of voicemails.
 *
 * @author Dave Comfort
 * 
 * @param type		type of thing in the list
 * @param search	the search that generated this list
 */
ZmVoiceList = function(type, search) {
	ZmList.call(this, type, search);
	this.folder = null;
};

ZmVoiceList.prototype = new ZmList;
ZmVoiceList.prototype.constructor = ZmVoiceList;

ZmVoiceList.prototype.toString = 
function() {
	return "ZmVoiceList";
};

/**
 * @param params		[hash]			hash of params:
 *        items			[array]			a list of items to move
 *        folder		[ZmFolder]		destination folder
 *        attrs			[hash]			additional attrs for SOAP command
 */
ZmVoiceList.prototype.moveItems =
function(params) {

	params = Dwt.getParams(arguments, ["items", "folder", "attrs"]);

	var params1 = AjxUtil.hashCopy(params);
	params1.items = AjxUtil.toArray(params.items);
	params1.attrs = params.attrs || {};
	params1.attrs.phone = this.folder.phone.name;
	params1.attrs.l = params.folder.id;
	params1.action = "move";
    if (params1.folder.id == ZmFolder.ID_TRASH) {
		if (params1.items.length > 1) {
	        params1.actionText = ZmMsg.actionTrash;
		}
    } else {
        params1.actionText = ZmMsg.actionMove;
        params1.actionArg = params.folder.getName(false, false, true);
    }
	params1.callback = new AjxCallback(this, this._handleResponseMoveItems, params);

	this._itemAction(params1);
};

// The voice server isn't sending notifications. This callback updates
// folders and such after a move.
ZmVoiceList.prototype._handleResponseMoveItems =
function(params) {

	// Remove the items.
	for (var i = 0, count = params.items.length; i < count; i++) {
		this.remove(params.items[i]);
	}
	
	// Update the unread counts in the folders.
	var numUnheard = 0;
	for (var i = 0, count = params.items.length; i < count; i++) {
		if (params.items[i].isUnheard) {
			numUnheard++;
		}
	}
	var sourceFolder = params.items[0].getFolder();
	if (numUnheard) {
		sourceFolder.changeNumUnheardBy(-numUnheard);
		params.folder.changeNumUnheardBy(numUnheard);
	}
	
	// Replenish the list view.
	//
	// This is sort of a hack having the model call back to the controller, but without notifications
	// this seems like the best approach.
	var controller = AjxDispatcher.run("GetVoiceController");
	controller._handleResponseMoveItems(params);
};

ZmVoiceList.prototype._getActionNamespace =
function() {
	return "urn:zimbraVoice";
};

