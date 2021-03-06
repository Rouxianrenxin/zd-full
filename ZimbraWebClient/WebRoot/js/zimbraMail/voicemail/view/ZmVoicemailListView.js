/*
 * 
 */

ZmVoicemailListView = function(parent, controller, dropTgt) {
	var headerList = this._getHeaderList(parent);
	ZmVoiceListView.call(this, {parent:parent, className:"DwtListView ZmVoicemailListView",
								posStyle:Dwt.ABSOLUTE_STYLE, view:ZmId.VIEW_VOICEMAIL,
								type:ZmItem.VOICEMAIL, controller:controller,
								headerList:headerList, dropTgt:dropTgt});

	this._playing = null;	// The voicemail currently loaded in the player.
	this._players = {}; 	// Map of voicemail.id to sound player
	this._soundChangeListeners = [];
	this._reconnect = null; // Structure to help reconnect a voicemail to the currently
							// playing sound when resorting or redraing the list.
}
ZmVoicemailListView.prototype = new ZmVoiceListView;
ZmVoicemailListView.prototype.constructor = ZmVoicemailListView;

ZmVoicemailListView.prototype.toString =
function() {
	return "ZmVoicemailListView";
};

ZmVoicemailListView.FROM_WIDTH		= ZmMsg.COLUMN_WIDTH_FROM_CALL;
ZmVoicemailListView.PLAYING_WIDTH	= null; // Auto
ZmVoicemailListView.PRIORITY_WIDTH	= ZmListView.COL_WIDTH_ICON;
ZmVoicemailListView.DATE_WIDTH		= ZmMsg.COLUMN_WIDTH_DATE_CALL;

ZmVoicemailListView.F_PRIORITY		= "py";

ZmVoicemailListView.prototype.setPlaying =
function(voicemail) {
	var player = this._players[voicemail.id];
	if (player) {
		player.play();
	}
};	

ZmVoicemailListView.prototype.getPlaying =
function() {
	return this._playing;
};

ZmVoicemailListView.prototype.addSoundChangeListener =
function(listener) {
	this._soundChangeListeners.push(listener);
};

ZmVoicemailListView.prototype.markUIAsRead =
function(items, on) {
	var className = on ? "" : "Unread";
	for (var i = 0; i < items.length; i++) {
		var item = items[i];
		var row = this._getElement(item, ZmItem.F_ITEM_ROW);
		if (row) {
			row.className = className;
		}
	}
};

ZmVoicemailListView.prototype.stopPlaying =
function(compact) {
	if (this._playing) {
		var player = this._players[this._playing.id];
		if (compact) {
			player.setCompact(true);
		}
		player.stop();
	}
};

ZmVoicemailListView.prototype._getHeaderList =
function(parent) {

	var headerList = [];

	if (appCtxt.get(ZmSetting.SHOW_SELECTION_CHECKBOX)) {
		headerList.push(new DwtListHeaderItem({field:ZmItem.F_SELECTION, icon:"CheckboxUnchecked", width:ZmListView.COL_WIDTH_ICON, name:ZmMsg.selection}));
	}
	headerList.push(new DwtListHeaderItem({field:ZmVoicemailListView.F_PRIORITY, icon:"TaskHigh", width:ZmVoicemailListView.PRIORITY_WIDTH}));
	headerList.push(new DwtListHeaderItem({field:ZmVoiceListView.F_CALLER, text:ZmMsg.from, width:ZmVoicemailListView.FROM_WIDTH, resizeable:true}));
	headerList.push(new DwtListHeaderItem({field:ZmVoiceListView.F_DURATION, text:ZmMsg.message, width:ZmVoicemailListView.PLAYING_WIDTH, sortable:ZmVoiceListView.F_DURATION, resizeable:true}));
	headerList.push(new DwtListHeaderItem({field:ZmVoiceListView.F_DATE, text:ZmMsg.received, width:ZmVoicemailListView.DATE_WIDTH, sortable:ZmVoiceListView.F_DATE, resizeable:true}));

	return headerList;
};

ZmVoicemailListView.prototype._getCellId =
function(item, field) {
	if (field == ZmVoiceListView.F_DURATION) {
		return this._getFieldId(item, field);
	} else {
		return ZmVoiceListView.prototype._getCellId.apply(this, arguments);
	}
};

ZmVoicemailListView.prototype._getCellContents =
function(htmlArr, idx, voicemail, field, colIdx, params) {
	if (field == ZmVoicemailListView.F_PRIORITY) {
		htmlArr[idx++] = this._getPriorityHtml(voicemail);
	} else if (field == ZmVoiceListView.F_DURATION) {
		// No-op. This is handled in _addRow()
	} else {
		idx = ZmVoiceListView.prototype._getCellContents.apply(this, arguments);
	}
	return idx;
};

ZmVoicemailListView.prototype.removeItem =
function(item, skipNotify) {
	ZmVoiceListView.prototype.removeItem.call(this, item, skipNotify);
	var player = this._players[item.id];
	if (player) {
		player.dispose();
	}
	if (this._playing == item) {
		this._playing = null;
	}
	delete this._players[item.id];
};

ZmVoicemailListView.prototype.set =
function(list, sortField) {
	ZmVoiceListView.prototype.set.call(this, list, sortField);

	// If we were unable to reconnect the player, dispose it.
	if (this._reconnect) {
		this._reconnect.player.dispose();
		this._reconnect = null;
	}
};

ZmVoicemailListView.prototype.removeAll =
function(skipNotify) {
	this._clearPlayers();
	ZmVoiceListView.prototype.removeAll.call(this, skipNotify);
};

ZmVoicemailListView.prototype._getNoResultsMessage =
function() {
	return this._folder && !this._folder.phone.hasVoiceMail ? ZmMsg.noVoiceMail : AjxMsg.noResults;
};

ZmVoicemailListView.prototype._resetList =
function() {
	this._clearPlayers();
	ZmVoiceListView.prototype._resetList.call(this);
};

ZmVoicemailListView.prototype._clearPlayers =
function() {
	if (this._playing && !DwtSoundPlugin.isScriptingBroken()) { // Can't reuse the quicktime noscript player.
		// Save data to be able to reconnect to the player.
		this._reconnect = {
			id: this._playing.id,
			player: this._players[this._playing.id]
		};
		
		// Hide the player
		var hidden;
		if (!this._hiddenDivId) {
			hidden = document.createElement("div");
			this._hiddenDivId = Dwt.getNextId();
			hidden.id = this._hiddenDivId;
			Dwt.setZIndex(hidden, Dwt.Z_HIDDEN);
			this.shell.getHtmlElement().appendChild(hidden);
		} else {
			hidden = document.getElementById(this._hiddenDivId);
		}
		this._reconnect.player.reparentHtmlElement(hidden);
		
		// Remove this offscreen player from our player list.
		delete this._players[this._playing.id];
		this._playing = null;
	}
	for (var i in this._players) {
		this._players[i].dispose();
	}
	this._players = {};
};

ZmVoicemailListView.prototype._renderList =
function(list, noResultsOk, doAdd) {
	ZmVoiceListView.prototype._renderList.apply(this, arguments);

	if (list && !doAdd) {
		for (var i = 0, count = list.size(); i < count; i++) {
			var voicemail = list.get(i);
			var row = this._getElFromItem(voicemail);
			this._addPlayerToRow(row, voicemail);
		}
	}
};

ZmVoicemailListView.prototype._addRow =
function(row, index) {
	ZmVoiceListView.prototype._addRow.call(this, row, index);
	var voicemail = this.getItemFromElement(row);
	this._addPlayerToRow(row, voicemail);
};

ZmVoicemailListView.prototype._addPlayerToRow =
function(row, voicemail) {
	var list = this.getList();
	if (!list || !list.size()) {
		return;
	}
	if (this._getCallType() != ZmVoiceFolder.VOICEMAIL) {
		return;
	}
	
	var cell = this._getElement(voicemail, ZmVoiceListView.F_DURATION);
	
	var player;
	if (this._reconnect && (this._reconnect.id == voicemail.id)) {
		player = this._reconnect.player;
		this._reconnect = null;
		this._playing = voicemail;
	} else {
		player = new ZmSoundPlayer(this, voicemail);
		if (!this._compactListenerObj) {
			this._compactListenerObj = new AjxListener(this, this._compactListener);
		}
		player.addCompactListener(this._compactListenerObj);
		for (var i = 0, count = this._soundChangeListeners.length; i < count; i++) {
			player.addChangeListener(this._soundChangeListeners[i]);
		}
		if (player.isPluginMissing()) {
			if (!this._helpListenerObj) {
				this._helpListenerObj = new AjxListener(this, this._helpListener);
			}
			player.addHelpListener(this._helpListenerObj);
		}
	}
	player.reparentHtmlElement(cell);
	this._players[voicemail.id] = player;
};

ZmVoicemailListView.prototype._helpListener =
function(ev) {
	var dialog = appCtxt.getMsgDialog();
	var message = AjxEnv.isIE ? ZmMsg.missingPluginHelpIE : ZmMsg.missingPluginHelp;
	dialog.setMessage(message, DwtMessageDialog.CRITICAL_STYLE);
	dialog.popup();
};

ZmVoicemailListView.prototype._compactListener =
function(ev) {
	if (!ev.isCompact) {
		this.stopPlaying(true);
		this._playing = ev.dwtObj.voicemail;
	} else if (this._playing && (ev.dwtObj == this._players[this._playing.id])){
		this._playing = null;
	}
};

ZmVoicemailListView.prototype._getPriorityHtml =
function(voicemail) {
	return voicemail.isHighPriority ? "<div class='ImgTaskHigh'></div>" : "";
};

ZmVoicemailListView.prototype._getHeaderToolTip =
function(prefix) {
	switch (prefix) {
		case ZmVoicemailListView.F_PRIORITY: 	return ZmMsg.priority; break;
		case ZmVoiceListView.F_CALLER:			return ZmMsg.from; break;
		case ZmVoiceListView.F_DURATION:		return ZmMsg.sortByDuration; break;
		case ZmVoiceListView.F_DATE:			return ZmMsg.sortByReceived; break;
	}
	return null;
};

ZmVoicemailListView.prototype._getItemTooltip =
function(voicemail) {
	var data = { 
		caller: this._getCallerHtml(voicemail), 
		duration: AjxDateUtil.computeDuration(voicemail.duration),
		date: AjxDateUtil.computeDateTimeString(voicemail.date)
	};
	return (AjxTemplate.expand("voicemail.Voicemail#VoicemailTooltip", data));
};
