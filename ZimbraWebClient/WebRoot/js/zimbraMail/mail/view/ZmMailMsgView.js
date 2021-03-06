/*
 * 
 */

ZmMailMsgView = function(params) {

	if (arguments.length == 0) { return; }

	params.className = params.className || "ZmMailMsgView";
	DwtComposite.call(this, params);

	this._mode = params.mode;
	this._controller = params.controller;
	this._viewId = (this._controller && this._controller.sessionId) ? ZmId.VIEW_MSG + this._controller.sessionId: ZmId.VIEW_MSG;

	this._displayImagesId	= ZmId.getViewId(this._viewId, ZmId.MV_DISPLAY_IMAGES, this._mode);
	this._msgTruncatedId	= ZmId.getViewId(this._viewId, ZmId.MV_MSG_TRUNC, this._mode);
	this._infoBarId			= ZmId.getViewId(this._viewId, ZmId.MV_INFO_BAR, this._mode);
	this._tagRowId			= ZmId.getViewId(this._viewId, ZmId.MV_TAG_ROW, this._mode);
	this._tagCellId			= ZmId.getViewId(this._viewId, ZmId.MV_TAG_CELL, this._mode);
	this._attLinksId		= ZmId.getViewId(this._viewId, ZmId.MV_ATT_LINKS, this._mode);

	// expand/collapse vars
	this._expandHeader = true;
	this._expandDivId = ZmId.getViewId(this._viewId, ZmId.MV_EXPAND_DIV, this._mode);

	this._scrollWithIframe = false;
	this._limitAttachments = this._scrollWithIframe ? 3 : 0; //making it local
	this._attcMaxSize = this._limitAttachments * 16 + 8;
	this.setScrollStyle(this._scrollWithIframe ? DwtControl.CLIP : DwtControl.SCROLL);

	if (!appCtxt.isChildWindow) {
		// Add change listener to taglist to track changes in tag color
		this._tagList = appCtxt.getTagTree();
		if (this._tagList) {
			this._tagList.addChangeListener(new AjxListener(this, this._tagChangeListener));
			this.addListener(ZmMailMsgView._TAG_CLICK, new AjxListener(this, this._msgTagClicked));
		}
	}

	this._setMouseEventHdlrs(); // needed by object manager
	this._objectManager = true;

	this._changeListener = new AjxListener(this, this._msgChangeListener);
	this.addListener(DwtEvent.ONSELECTSTART, new AjxListener(this, this._selectStartListener));
	this.addListener(DwtEvent.CONTROL, new AjxListener(this, this._controlEventListener));

	// bug fix #25724 - disable right click selection for offline
	if (!appCtxt.isOffline) {
		this._setAllowSelection();
	}

	this.noTab = true;
    this._attachmentLinkIdToFileNameMap = null;
};

ZmMailMsgView.prototype = new DwtComposite;
ZmMailMsgView.prototype.constructor = ZmMailMsgView;


// displays any additional headers in messageView
//pass ZmMailMsgView.displayAdditionalHdrsInMsgView[<actualHeaderName>] = <DisplayName>
//pass ZmMailMsgView.displayAdditionalHdrsInMsgView["X-Mailer"] = "Sent Using:"
ZmMailMsgView.displayAdditionalHdrsInMsgView = {};


// Consts

ZmMailMsgView.SCROLL_WITH_IFRAME	= true;
ZmMailMsgView.LIMIT_ATTACHMENTS 	= ZmMailMsgView.SCROLL_WITH_IFRAME ? 3 : 0;
ZmMailMsgView.ATTC_COLUMNS			= 2;
ZmMailMsgView.ATTC_MAX_SIZE			= ZmMailMsgView.LIMIT_ATTACHMENTS * 16 + 8;
ZmMailMsgView.QUOTE_DEPTH_MOD 		= 3;
ZmMailMsgView.MAX_SIG_LINES 		= 8;
ZmMailMsgView.SIG_LINE 				= /^(- ?-+)|(__+)\r?$/;
ZmMailMsgView._inited 				= false;
ZmMailMsgView._TAG_CLICK 			= "ZmMailMsgView._TAG_CLICK";
ZmMailMsgView._TAG_ANCHOR 			= "TA";
ZmMailMsgView._TAG_IMG 				= "TI";
ZmMailMsgView.SHARE_EVENT 			= "share";
ZmMailMsgView.IMG_FIX_RE			= new RegExp("(<img\\s+.*dfsrc\\s*=\\s*)[\"']http[^'\"]+part=([\\d\\.]+)[\"']([^>]*>)", "gi");
ZmMailMsgView.FILENAME_INV_CHARS_RE = /[\./?*:;{}'\\]/g; // Chars we do not allow in a filename
ZmMailMsgView.SETHEIGHT_MAX_TRIES	= 3;

ZmMailMsgView._URL_RE = /^((https?|ftps?):\x2f\x2f.+)$/;
ZmMailMsgView._MAILTO_RE = /^mailto:[\x27\x22]?([^@?&\x22\x27]+@[^@?&]+\.[^@?&\x22\x27]+)[\x27\x22]?/;

ZmMailMsgView.MAX_ADDRESSES_IN_FIELD = 10;

// Public methods

ZmMailMsgView.prototype.toString =
function() {
	return "ZmMailMsgView";
};

ZmMailMsgView.prototype.getController =
function() {
	return this._controller;
};

ZmMailMsgView.prototype.reset =
function() {
	// Bug 23692: cancel any pending actions
	if (this._resizeAction) {
		AjxTimedAction.cancelAction(this._resizeAction);
		this._resizeAction = null;
	}
	if (this._objectsAction) {
		AjxTimedAction.cancelAction(this._objectsAction);
		this._objectsAction = null;
	}
	this._msg = null;
	this._htmlBody = null;

	// TODO: reuse all thses controls that are being disposed here.....
	if (this._expandButton) {
		this._expandButton.setVisible(Dwt.DISPLAY_NONE);
		this._expandButton.reparentHtmlElement(this.getHtmlElement());
	}
	if (this._ifw) {
		this._ifw.dispose();
		this._ifw = null;
	}
	if (this._inviteMsgView) {
		this._inviteMsgView.reset();
	}

	this.getHtmlElement().innerHTML = "";
	if (this._objectManager && this._objectManager.reset) {
		this._objectManager.reset();
	}
	this.setScrollWithIframe(this._scrollWithIframe);
};

ZmMailMsgView.prototype.getInviteMsgView =
function() {
	return this._inviteMsgView;
};


ZmMailMsgView.prototype.preventSelection =
function() {
	return false;
};

ZmMailMsgView.prototype.set =
function(msg, force) {
	if (!force && this._msg && msg && (this._msg.id == msg.id)) { return; }

	var oldMsg = this._msg;
	this.reset();
	var contentDiv = this.getHtmlElement();
	this._msg = msg;

	if (!msg) {
		if (this._inviteMsgView) {
			this._inviteMsgView.resize(true); //make sure the msg preview pane takes the entire area, in case we were viewing an invite. (since then it was resized to allow for day view) - bug 53098
		}
		contentDiv.innerHTML = AjxTemplate.expand("mail.Message#viewMessage");
		this.noTab = true;
		return;
	}

	this._dateObjectHandlerDate = msg.sentDate
		? new Date(msg.sentDate)
		: new Date(msg.date);

	var invite = msg.invite;
	var ac = window.parentAppCtxt || window.appCtxt;

	if ((ac.get(ZmSetting.CALENDAR_ENABLED) || ac.multiAccounts) &&
		(invite && !invite.isEmpty() && invite.type != "task"))
	{
		if (!this._inviteMsgView) {
			this._inviteMsgView = new ZmInviteMsgView({parent:this, mode:this._mode});
		}
		this._inviteMsgView.set(msg);
	}
	else if (appCtxt.get(ZmSetting.SHARING_ENABLED) &&
			 msg.share && msg.folderId != ZmFolder.ID_TRASH &&
			 appCtxt.getActiveAccount().id != msg.share.grantor.id)
	{
		AjxDispatcher.require("Share");
		var action = msg.share.action;
		var isNew = action == ZmShare.NEW;
		var isEdit = action == ZmShare.EDIT;
		var isDataSource = (appCtxt.getById(msg.folderId).isDataSource(null, true) && (msg.folderId != ZmFolder.ID_INBOX));

		if (!isDataSource &&
			(isNew || (isEdit && !this.__hasMountpoint(msg.share))) &&
			msg.share.link.perm)
		{
			var topToolbar = this._getShareToolbar();
			topToolbar.reparentHtmlElement(contentDiv);
			topToolbar.setVisible(Dwt.DISPLAY_BLOCK);
			this._hasShareToolbar = true;
		}
	}
	var respCallback = new AjxCallback(this, this._handleResponseSet, [msg, oldMsg]);
	this._renderMessage(msg, contentDiv, respCallback);
	this.noTab = AjxEnv.isIE;
};

ZmMailMsgView.prototype.__hasMountpoint =
function(share) {
	var tree = appCtxt.getFolderTree();
	return tree
		? this.__hasMountpoint2(tree.root, share.grantor.id, share.link.id)
		: false;
};

ZmMailMsgView.prototype.__hasMountpoint2 =
function(organizer, zid, rid) {
	if (organizer.zid == zid && organizer.rid == rid)
		return true;

	if (organizer.children) {
		var children = organizer.children.getArray();
		for (var i = 0; i < children.length; i++) {
			var found = this.__hasMountpoint2(children[i], zid, rid);
			if (found) {
				return true;
			}
		}
	}
	return false;
};

ZmMailMsgView.prototype.highlightObjects =
function(origText) {
	var idoc = document.getElementById(this._iframeId).contentWindow.document;
	if (origText != null) {
		// we get here only for text messages; it's a lot
		// faster to call findObjects on the whole text rather
		// than parsing the DOM.
		DBG.timePt("START - highlight objects on-demand, text msg.");
		this._lazyCreateObjectManager();
		var html = this._objectManager.findObjects(origText, true, null, true);
		html = html.replace(/^ /mg, "&nbsp;")
			.replace(/\t/g, "<pre style='display:inline;'>\t</pre>")
			.replace(/\n/g, "<br>");
		idoc.body.innerHTML = html;
		DBG.timePt("END - highlight objects on-demand, text msg.");
	} else {
		this._processHtmlDoc(idoc);
	}
};

ZmMailMsgView.prototype.resetMsg =
function(newMsg) {
	// Remove listener for current msg if it exists
	if (this._msg != null)
		this._msg.removeChangeListener(this._changeListener);
};

ZmMailMsgView.prototype.getMsg =
function() {
	return this._msg;
};

// Following two overrides are a hack to allow this view to pretend it's a list view
ZmMailMsgView.prototype.getSelection =
function() {
	return this._msg;
};

ZmMailMsgView.prototype.getSelectionCount =
function() {
	return 1;
};

ZmMailMsgView.prototype.getMinWidth =
function() {
	return 20;
};

ZmMailMsgView.prototype.getMinHeight =
function() {
	if (!this._headerHeight) {
		var headerObj = document.getElementById(this._hdrTableId);
		this._headerHeight = headerObj ? Dwt.getSize(headerObj).y : 0;
	}
	return this._headerHeight;
};

ZmMailMsgView.prototype.getTitle =
function() {
	return [ZmMsg.zimbraTitle, this._msg.subject].join(": ");
};

// returns true if the current message was rendered in HTML
ZmMailMsgView.prototype.hasHtmlBody =
function() {
	return this._htmlBody != null;
};

// returns the html body element w/in the IFRAME's document for html messages
ZmMailMsgView.prototype.getHtmlBodyElement =
function() {
	var htmlBodyEl;

	if (this._htmlBody) {
		var iframe = document.getElementById(this._iframeId);
		var idoc = iframe ? Dwt.getIframeDoc(iframe) : null;
		htmlBodyEl = idoc ? idoc.body : null;
	}

	return htmlBodyEl;
};

ZmMailMsgView.prototype.addInviteReplyListener =
function(listener) {
	this.addListener(ZmInviteMsgView.REPLY_INVITE_EVENT, listener);
};

ZmMailMsgView.prototype.addShareListener =
function(listener) {
	this.addListener(ZmMailMsgView.SHARE_EVENT, listener);
};

ZmMailMsgView.prototype.setVisible =
function(visible) {
	DwtComposite.prototype.setVisible.apply(this, arguments);

	if (this._inviteMsgView) {
		if (visible && this._msg) {
			this._inviteMsgView.set(this._msg);
			this._inviteMsgView.showMoreInfo();
		} else {
			this._inviteMsgView.reset();
		}
	}
};


// Private / protected methods

ZmMailMsgView.prototype._getShareToolbar =
function() {
	if (this._shareToolbar) {
		if (AjxEnv.isIE) {
			//reparenting on IE does not work. So recreating in this case. (similar to bug 52412 for the invite toolbar)
			this._shareToolbar.dispose();
			this._shareToolbar = null;
		}
		else {
			return this._shareToolbar;
		}
	}

	var buttonIds = [ZmOperation.SHARE_ACCEPT, ZmOperation.SHARE_DECLINE];
	var params = {
		parent: this,
		buttons: buttonIds,
		posStyle: DwtControl.STATIC_STYLE,
		className: "ZmShareToolBar",
		buttonClassName: "DwtToolbarButton",
		context: this._mode,
		toolbarType: ZmId.TB_SHARE
	};
	this._shareToolbar = new ZmButtonToolBar(params);

	var listener = new AjxListener(this, this._shareToolBarListener);
	for (var i = 0; i < buttonIds.length; i++) {
		var id = buttonIds[i];

		// HACK: IE doesn't support multiple class names.
		var b = this._shareToolbar.getButton(id);
		b._hoverClassName = b._className + "-" + DwtCssStyle.HOVER;
		b._activeClassName = b._className + "-" + DwtCssStyle.ACTIVE;

		this._shareToolbar.addSelectionListener(id, listener);
	}

	return this._shareToolbar;
};

ZmMailMsgView.prototype._notifyZimletsNewMsg =
function(msg, oldMsg) {
	// notify zimlets that a new message has been opened
	appCtxt.notifyZimlets("onMsgView", [msg, oldMsg, this]);
};


ZmMailMsgView.prototype._handleResponseSet =
function(msg, oldMsg) {

	var notifyZimletsInShowMore = false;
	if (this._inviteMsgView) {
		// always show F/B view if in stand-alone message view otherwise, check
		// if reading pane is on
		if (this._inviteMsgView.isActive() &&
			(this._controller.isReadingPaneOn() || (this._controller instanceof ZmMsgController)))
		{
			notifyZimletsInShowMore = true;
			this._inviteMsgView.showMoreInfo(new AjxCallback(this, this._notifyZimletsNewMsg, [msg, oldMsg]));
		}
		else {
			// resize the message view without F/B view
			this._inviteMsgView.resize(true);
		}
	}

	if (!appCtxt.isChildWindow) {
		this._setTags(msg);
		// Remove listener for current msg if it exists
		if (oldMsg) {
			oldMsg.removeChangeListener(this._changeListener);
		}
		msg.addChangeListener(this._changeListener);
	}

	// reset scroll view to top most
	var htmlElement = this.getHtmlElement();
	htmlElement.scrollTop = 0;
	if (htmlElement.scrollTop != 0) {
		/* situation that happens only on Chrome, without repro steps - bug 55775/57090 */
		AjxDebug.println(AjxDebug.SCROLL, "scrollTop not set to 0. scrollTop=" + htmlElement.scrollTop + " offsetHeight=" + htmlElement.offsetHeight + " scrollHeight=" + htmlElement.scrollHeight + " browser=" + navigator.userAgent);
		AjxDebug.dumpObj(AjxDebug.SCROLL, htmlElement.outerHTML);
		/*
			trying this hack for solution -
			explanation: The scroll bar does not appear if the scrollHeight of the div is bigger than the total height of the iframe and header together (i.e. if htmlElement.scrollHeight >= htmlElement.offsetHeight)
			If the scrollbar does not appear it's set to, and stays 0 when the scrollbar reappears due to resizing the iframe in _resetIframeHeight (which is later, I think always on timer).
			So what I do here is set the height of the iframe to very small (since the default is 150px), so the scroll bar disappears.
			it will reappear when we reset the size in _resetIframeHeight. I hope this will solve the issue.
		*/
		var iframe = document.getElementById(this._iframeId);
		iframe.style.height = "1px";
		AjxDebug.println(AjxDebug.SCROLL, "scrollTop after reseting it with the hack =" + htmlElement.scrollTop);

	}

	if (!notifyZimletsInShowMore) {
		this._notifyZimletsNewMsg(msg, oldMsg);
	}

	if (!msg.isDraft && msg.readReceiptRequested) {
		this._controller.sendReadReceipt(msg);
	}
};

// Create the ObjectManager at the last minute just before we scan the message
ZmMailMsgView.prototype._lazyCreateObjectManager =
function() {
	// objectManager will be 'true' at create time, after that it will be the
	// real object. NOTE: Replaced if (this._objectManager === true) as "==="
	// does deep comparision of objects which might take a while.
	var createObjectMgr = (AjxUtil.isBoolean(this._objectManager) && this._objectManager);
	var firstCallAfterZimletLoading = (!this.zimletLoadFlag && appCtxt.getZimletMgr().isLoaded());
	
	if (createObjectMgr || firstCallAfterZimletLoading) {
		this.zimletLoadFlag = appCtxt.getZimletMgr().isLoaded();
		// this manages all the detected objects within the view
		this._objectManager = new ZmObjectManager(this);
	}
};

// This is needed for Gecko only: for some reason, clicking on a local link will
// open the full Zimbra chrome in the iframe :-( so we fake a scroll to the link
// target here. (bug 7927)
ZmMailMsgView.__localLinkClicked =
function(msgView, ev) {
	// note that this function is called in the context of the link
	var id = this.getAttribute("href");
	var el = null;
	var doc = this.ownerDocument;

	if (id.substr(0, 1) == "#") {
		id = id.substr(1);
		el = doc.getElementById(id);
		if (!el) {
			try {
				el = doc.getElementsByName(id)[0];
			} catch(ex) {}
		}
		if (!el) {
			id = decodeURIComponent(id);
			el = doc.getElementById(id);
			if (!el) {
				try {
					el = doc.getElementsByName(id)[0];
				} catch(ex) {}
			}
		}
	}

	// attempt #1: doesn't work at all -- we're not scrolling with the IFRAME :-(
	// 		if (el) {
	// 			var pos = Dwt.getLocation(el);
	// 			doc.contentWindow.scrollTo(pos.x, pos.y);
	// 		}

	// attempt #2: works pretty well, but the target node will showup at the bottom of the frame
	// 		var foo = doc.createElement("a");
	// 		foo.href = "#";
	// 		foo.innerHTML = "foo";
	// 		el.parentNode.insertBefore(foo, el);
	// 		foo.focus();

	// the final monstrosity: scroll the containing DIV
	// (that is the whole msgView).  Note we have to take
	// into account the headers, "display images", etc --
	// so we add iframe.offsetTop/Left.
	if (el) {
		var div = msgView.getHtmlElement();
		var iframe = document.getElementById(msgView._iframeId);
		var pos = Dwt.getLocation(el);
		div.scrollTop = pos.y + iframe.offsetTop - 20; // fuzz factor necessary for unknown reason :-(
		div.scrollLeft = pos.x + iframe.offsetLeft;
	}
	ev.stopPropagation();
	ev.preventDefault();
	return false;
};

ZmMailMsgView.prototype.hasValidHref =
function (node) {
	// Bug 22958: IE can throw when you try and get the href if it doesn't like
	// the value, so we wrap the test in a try/catch.
	// hrefs formatted like http://www.name@domain.com can cause this to happen.
	try {
		var href = node.href;
		return ZmMailMsgView._URL_RE.test(href) || ZmMailMsgView._MAILTO_RE.test(href);
	} catch (e) {
		return false;
	}
};

// Dives recursively into the given DOM node.  Creates ObjectHandlers in text
// nodes and cleans the mess in element nodes.  Discards by default "script",
// "link", "object", "style", "applet" and "iframe" (most of them shouldn't
// even be here since (1) they belong in the <head> and (2) are discarded on
// the server-side, but we check, just in case..).
ZmMailMsgView.prototype._processHtmlDoc =
function(doc) {
	if (!doc) { return; }

	DBG.timePt("Starting ZmMailMsgView.prototype._processHtmlDoc");
	// bug 8632
	var images = doc.getElementsByTagName("img");
	if (images.length > 0) {
		var length = images.length;
		for (var i = 0; i < images.length; i++) {
			this._checkImgInAttachments(images[i]);
		}
	}

	//Find Zimlet Objects lazly
	this.lazyFindMailMsgObjects(500, doc);

	DBG.timePt("-- END _processHtmlDoc");
};

ZmMailMsgView.prototype.lazyFindMailMsgObjects =
function(interval, doc ) {
	if (this._objectManager) {
		this._lazyCreateObjectManager();
		this._objectsAction = new AjxTimedAction(this, this._findMailMsgObjects, [doc]);
		AjxTimedAction.scheduleAction(this._objectsAction, ( interval || 500 ));
	}
};

ZmMailMsgView.prototype._findMailMsgObjects =
function(doc) {
	this._objectManager.processObjectsInNode(doc, doc.body);
};

ZmMailMsgView.prototype._checkImgInAttachments =
function(img) {
	if (!this._msg || img.getAttribute("zmforced")) { return; }

	var attachments = this._msg.attachments;
	var csfeMsgFetch = appCtxt.get(ZmSetting.CSFE_MSG_FETCHER_URI);
	try {
		var src = img.getAttribute("src") || img.getAttribute("dfsrc");
	}
	catch(e) {
		AjxDebug.println(AjxDebug.DATA_URI, "_checkImgInAttachments: couldn't access attribute src or dfsrc");
	}
	var cid;
	if (/^cid:(.*)/.test(src)) {
		cid = "<" + RegExp.$1 + ">";
	}

	for (var i = 0; i < attachments.length; i++) {
		var att = attachments[i];

		if (att.foundInMsgBody) { continue; }

		if (cid && att.ci == cid) {
			att.foundInMsgBody = true;
			break;
		} else if (src && src.indexOf(csfeMsgFetch) == 0) {
			var mpId = src.substring(src.lastIndexOf("=") + 1);
			if (mpId == att.part) {
				att.foundInMsgBody = true;
				break;
			}
		} else if (att.cl) {
			var filename = src.substring(src.lastIndexOf("/") + 1);
			if (filename == att.filename) {
				att.foundInMsgBody = true;
				break;
			}
		}
	}
};

ZmMailMsgView.prototype._fixMultipartRelatedImages =
function(msg, idoc) {
	// fix <img> tags
	var images = idoc.getElementsByTagName("img");
	var hasExternalImages = false;
	var self = this;
	var iframe = document.getElementById(this._iframeId);
	var onload = function() {
		//resize iframe onload of image
		ZmMailMsgView._resetIframeHeight(self, iframe);
		this.onload = null; // *this* is reference to <img> el.
	};
	for (var i = 0; i < images.length; i++) {
		var external = ZmMailMsgView._isExternalImage(images[i]);
		if(!external){ //Inline image
			ZmMailMsgView.__unfangInternalImage(msg, images[i], "src");
			images[i].onload = onload;
		}
		hasExternalImages = external || hasExternalImages;
	}
	// fix all elems with "background" attribute
	hasExternalImages = this._fixMultipartRelatedImagesRecurse(msg, idoc.body) || hasExternalImages;

	// did we get them all?
	return !hasExternalImages;
};

ZmMailMsgView.prototype._fixMultipartRelatedImagesRecurse =
function(msg, node) {
	var hasExternalImages = false;

	function recurse(node){
		var child = node.firstChild;
		while (child) {
			if (child.nodeType == AjxUtil.ELEMENT_NODE) {
				hasExternalImages = ZmMailMsgView.__unfangInternalImage(msg, child, "background", true) || hasExternalImages;
				recurse(child);
			}
			child = child.nextSibling;
		}
	}

	if(node.innerHTML.indexOf("dfbackground") != -1) {
		recurse(node);
	}
	else if (node.attributes && node.getAttribute("dfbackground") != -1) {
		hasExternalImages = ZmMailMsgView.__unfangInternalImage(msg, node, "background", true);	
	}

	return hasExternalImages;
};

/**
 * Determines if an img element references an external image
 * @param elem {HTMLelement}
 * @return {Boolean} true if image is external
 */
ZmMailMsgView._isExternalImage = 
function(elem) {
	if (!elem) {
		return false;
	}
	return Boolean(elem.getAttribute("dfsrc"));
}

/**
 * Unfangs images
 * @param msg {ZmMailMsg} mail message
 * @param elem  {HTMLElement} element to be checked
 * @param aname {String} attribute name
 * @param prependDF  {Boolean} true to prepend "df" to attribute name 
 */
ZmMailMsgView.__unfangInternalImage =
function(msg, elem, aname, prependDF) {
	try {
	  var avalue = elem.getAttribute(prependDF ? "df" + aname : aname);
	}
	catch(e) {
		AjxDebug.println(AjxDebug.DATA_URI, "__unfangInternalImage: couldn't access attribute " + aname);
	}
	if (avalue) {
		if (avalue.substr(0,4) == "cid:") {
			var cid = "<" + AjxStringUtil.urlComponentDecode(avalue.substr(4)) + ">"; // Parse percent-escaping per bug #52085 (especially %40 to @)
			avalue = msg.getContentPartAttachUrl(ZmMailMsg.CONTENT_PART_ID, cid);
			if (avalue) {
				elem.setAttribute(aname, avalue);
				// elem.setAttribute(df_aname, avalue)
				return false;
			}else{
				// Since dfsrc="cid:xxxx", it cannot be external url
				return false;
			}
		} else if (avalue.substring(0,4) == "doc:") {
			avalue = [appCtxt.get(ZmSetting.REST_URL), ZmFolder.SEP, avalue.substring(4)].join('');
			if (avalue) {
				elem.setAttribute(aname, avalue);
				return false;
			}
		} else if (avalue.indexOf("//") == -1) { // check for content-location verison
			avalue = msg.getContentPartAttachUrl(ZmMailMsg.CONTENT_PART_LOCATION, avalue);
			if (avalue) {
				elem.setAttribute(aname, avalue);
				//elem.setAttribute(df_aname, avalue)
				return false;
			}
		} else if (avalue.substring(0,5) == "data:") {
			return false;
		}
		return true;
	}
	return false;
};


ZmMailMsgView.prototype._createDisplayImageClickClosure =
function(msg, idoc, id, iframe) {
	var self = this;
	return function(ev) {
        var target = DwtUiEvent.getTarget(ev),
            targetId = target ? target.id : null,
            addrToAdd = "";
        var diEl = document.getElementById(id);
        
        //This is required in case of the address is marked as trusted, the function is called without any target being set
        var force = (msg && msg.showImages) ||  appCtxt.get(ZmSetting.DISPLAY_EXTERNAL_IMAGES);

        if(!force) {
            if(!targetId) { return; }
            if(targetId.indexOf("domain") != -1) {
                //clicked on domain
                addrToAdd = msg.sentByDomain;
            }
            else if(targetId.indexOf("email") != -1) {
                //clicked on email
                addrToAdd = msg.sentByAddr;
            }
            else if(targetId.indexOf("dispImgs") != -1) {
               //do nothing here - just load the images
            }
            else if(targetId.indexOf("close") != -1) {
                if (diEl) {
                    diEl.style.display = "none";
                }
                return;
            }
            else {
                //clicked elsewhere in the info bar - DO NOTHING AND RETURN
                return;
            }
        }
        //Create a modifyprefs req and add the addr to modify
        if(addrToAdd) {
            var trustedList = self.getTrustedSendersList();
            trustedList.add(addrToAdd, null, true);
            self._controller.addTrustedAddr(trustedList.getArray(), new AjxCallback(self, self._addTrustedAddrCallback, [addrToAdd]), new AjxCallback(self, self._addTrustedAddrErrorCallback, [addrToAdd]));
        }

		var images = idoc.getElementsByTagName("img");
		var onload = function() {            
			ZmMailMsgView._resetIframeHeight(self, iframe);
			this.onload = null; // *this* is reference to <img> el.
		};
		for (var i = 0; i < images.length; i++) {
			var dfsrc = images[i].getAttribute("dfsrc");
			if (dfsrc && dfsrc.match(/https?:\/\/([-\w\.]+)+(:\d+)?(\/([\w\_\.]*(\?\S+)?)?)?/)) {
				// If we just loop through the images, IE for some reason,
				// doesn't fetch the image. By launching them off in the
				// background we seem to kick IE's engine a bit.
				images[i].onload = onload;
				if (AjxEnv.isIE) {
					var args = [images[i], i, images.length, msg, idoc, iframe, self];
					var act = new AjxTimedAction(null, ZmMailMsgView._swapIdAndSrc, args);
					AjxTimedAction.scheduleAction(act, 0);
				} else {
					images[i].src = images[i].getAttribute("dfsrc");
				}
			}
		}

		if (diEl) {
			diEl.style.display = "none";
		}
		this._htmlBody = idoc.documentElement.innerHTML;
		if (msg) {
			msg.setHtmlContent(this._htmlBody);
			msg.showImages = true;
		}
        //Make sure the link is not followed
        return false;
	};
};

ZmMailMsgView.prototype._resetIframeHeightOnTimer =
function(iframe, attempt) {
	DBG.println(AjxDebug.DBG1, "_resetIframeHeightOnTimer attempt: " + (attempt != null ? attempt : "null"));
	// Because sometimes our view contains images that are slow to download, wait a
	// little while before resizing the iframe.
	var act = this._resizeAction = new AjxTimedAction(this, ZmMailMsgView._resetIframeHeight, [this, iframe, attempt]);
	AjxTimedAction.scheduleAction(act, 200);
};

ZmMailMsgView.prototype._makeHighlightObjectsDiv =
function(origText) {
	var self = this;
	function func() {
		var div = document.getElementById(self._highlightObjectsId);
		div.innerHTML = ZmMsg.pleaseWaitHilitingObjects;
		setTimeout(function() {
			self.highlightObjects(origText);
			div.style.display = "none";
			ZmMailMsgView._resetIframeHeight(self, document.getElementById(self._iframeId));
		}, 3);
		return false;
	}
	// avoid closure memory leaks
	(function() {
		var infoBarDiv = document.getElementById(self._infoBarId);
		if (infoBarDiv) {
			self._highlightObjectsId = ZmId.getViewId(this._viewId, ZmId.MV_HIGHLIGHT_OBJ, self._mode);
			var subs = {
				id: self._highlightObjectsId,
				text: ZmMsg.objectsNotDisplayed,
				link: ZmMsg.hiliteObjects
			};
			var html = AjxTemplate.expand("mail.Message#InformationBar", subs);
			infoBarDiv.appendChild(Dwt.parseHtmlFragment(html));

			var div = document.getElementById(subs.id+"_link");
			Dwt.setHandler(div, DwtEvent.ONCLICK, func);
		}
	})();
};

ZmMailMsgView.prototype._stripHtmlComments =
function(html) {
	// bug: 38273 - Remove HTML Comments <!-- -->
	// But make sure not to remove inside style|script tags.
	var regex =  /<(?:!(?:--[\s\S]*?--\s*)?(>)\s*|(?:script|style|SCRIPT|STYLE)[\s\S]*?<\/(?:script|style|SCRIPT|STYLE)>)/g;
	html = html.replace(regex,function(m, $1) {
		return $1 ? '':m;
	});
	return html;
};

ZmMailMsgView.prototype._makeIframeProxy =
function(container, html, isTextMsg, isTruncated, origText) {
	// bug fix #4943
	if (html == null) { html = ""; }

	if (!isTextMsg) {
		//Microsoft silly smilies
		html = html.replace(/<span style="font-family:Wingdings">J<\/span>/g, "\u263a"); // :)
		html = html.replace(/<span style="font-family:Wingdings">L<\/span>/g, "\u2639"); // :(
	}

	var displayImages;
	if (!isTextMsg &&
		(!appCtxt.get(ZmSetting.DISPLAY_EXTERNAL_IMAGES) || (this._msg && this._msg.folderId == ZmOrganizer.ID_SPAM)) &&
		(this._msg == null || (this._msg && !this._msg.showImages)) &&
		/<img/i.test(html))
	{
		// prevent appending the "Display Images" info bar more than once
		var dispImagesDiv = document.getElementById(this._displayImagesId);
		if (!dispImagesDiv) {
			var infoBarDiv = document.getElementById(this._infoBarId);
			if (infoBarDiv) {
				var subs = {
					id: this._displayImagesId,
					text: ZmMsg.externalImages,
					link: ZmMsg.displayExternalImages,
					alwaysText: ZmMsg.alwaysDisplayExternalImages,
                    domain: this._msg.sentByDomain,
                    email: this._msg.sentByAddr,
                    or: ZmMsg.or
				};
				var extImagesHtml = AjxTemplate.expand("mail.Message#ExtImageInformationBar", subs);
				displayImages = Dwt.parseHtmlFragment(extImagesHtml);
				infoBarDiv.appendChild(displayImages);
			}
		}
	}

	var callback;
	var msgSize = (html.length / 1024);
	var maxHighlightSize = appCtxt.get(ZmSetting.HIGHLIGHT_OBJECTS);
	if (isTextMsg) {
		if (this._objectManager) {
			if (msgSize <= maxHighlightSize) {
				//Using callback to lazily find objects instead of doing it on a run.
				callback = new AjxCallback(this, this.lazyFindMailMsgObjects, [500]);
			} else {
				this._makeHighlightObjectsDiv(origText);
			}
		}
		if (AjxEnv.isSafari) {
			html = "<html><head></head><body>" + html + "</body></html>";
		}
	} else {
		html = this._stripHtmlComments(html);
		if (this._objectManager) {
			// this callback will post-process the HTML after the IFRAME is created
			if (msgSize <= maxHighlightSize) {
				callback = new AjxCallback(this, this._processHtmlDoc);
			} else {
				this._makeHighlightObjectsDiv();
			}
		}
	}

	var msgTruncated;
	this._isMsgTruncated = false;
	if (isTruncated) {
		this._isMsgTruncated = true;
		var msgTruncatedDiv = document.getElementById(this._msgTruncatedId);
		if (!msgTruncatedDiv) {
			var infoBarDiv = document.getElementById(this._infoBarId);
			if (infoBarDiv) {
				var subs = {
					id: this._msgTruncatedId,
					text: ZmMsg.messageTooLarge,
					link: ZmMsg.viewEntireMessage
				};
				var msgTruncatedHtml = AjxTemplate.expand("mail.Message#InformationBar", subs);
				msgTruncated = Dwt.parseHtmlFragment(msgTruncatedHtml);
				infoBarDiv.appendChild(msgTruncated);
			}
		}
	}

	// bug fix #9475 - IE isnt resolving MsgBody class in iframe so set styles explicitly
	var inner_styles = AjxEnv.isIE ? ".MsgBody-text, .MsgBody-text * { font: 10pt monospace; }" : "";
	var params = {
		parent: this,
		className: "MsgBody",
		id: ZmId.getViewId(this._viewId, ZmId.MV_MSG_BODY, this._mode),
		hidden: true,
		html: html,
		styles: inner_styles,
		noscroll: !this._scrollWithIframe,
		posStyle: DwtControl.STATIC_STYLE,
		processHtmlCallback: callback,
		useKbMgmt: true
	};
	var ifw = this._ifw = new DwtIframe(params);
	this._iframeId = ifw.getIframe().id;

	var idoc = ifw.getDocument();

	if (AjxEnv.isGeckoBased) {
		// patch local links (pass null as object so it gets called in context of link)
		var geckoScrollCallback = AjxCallback.simpleClosure(ZmMailMsgView.__localLinkClicked, null, this);
		var links = idoc.getElementsByTagName("a");
		for (var i = links.length; --i >= 0;) {
			var link = links[i];
			if (!link.target) {
				link.onclick = geckoScrollCallback; // has chances to be a local link
			}
		}
	}

	// assign the right class name to the iframe body
	idoc.body.className = isTextMsg
		? "MsgBody MsgBody-text"
		: "MsgBody MsgBody-html";

	idoc.body.style.height = "auto"; //see bug 56899 - if the body has height such as 100% or 94%, it causes a problem in FF in calcualting the iframe height. Make sure the height is clear.

	ifw.getIframe().onload = AjxCallback.simpleClosure(this._onloadIframe, this, ifw);

	// import the object styles
	var head = idoc.getElementsByTagName("head")[0];
	if (!head) {
		head = idoc.createElement("head");
		idoc.body.parentNode.insertBefore(head, idoc.body);
	}
	var link = idoc.createElement("link");
	link.rel = "stylesheet";
	link.href = appContextPath+"/css/msgview.css?v="+cacheKillerVersion;
	head.appendChild(link);

	ifw.getIframe().style.visibility = "";

	if (!isTextMsg) {
		this._htmlBody = idoc.body.innerHTML;

		// TODO: only call this if top-level is multipart/related?
		// setup the click handler for the images
		var didAllImages = this._fixMultipartRelatedImages(this._msg, idoc);
		if (didAllImages) {
			if (displayImages) {
				displayImages.style.display = "none";
			}
		} else {
			var func = this._createDisplayImageClickClosure(this._msg, idoc, this._displayImagesId, ifw.getIframe());
			if (displayImages) {
				Dwt.setHandler(displayImages, DwtEvent.ONCLICK, func);
			}
			else if (appCtxt.get(ZmSetting.DISPLAY_EXTERNAL_IMAGES) ||
					 (this._msg && this._msg.showImages))
			{
				func.call();
			}
		}
	}

	if (msgTruncated) {
		Dwt.setHandler(msgTruncated, DwtEvent.ONCLICK, AjxCallback.simpleClosure(this._handleMsgTruncated, this));
	}

	// set height of view according to height of iframe on timer
	this._resetIframeHeightOnTimer(ifw.getIframe());
};

ZmMailMsgView.prototype._addTrustedAddrCallback =
function(addr) {
    this.getTrustedSendersList().add(addr, null, true);
    appCtxt.set(ZmSetting.TRUSTED_ADDR_LIST, this.getTrustedSendersList().getArray());
    var prefApp = appCtxt.getApp(ZmApp.PREFERENCES);
    var func = prefApp && prefApp["refresh"];
    if (func && (typeof(func) == "function")) {
        func.apply(prefApp, [null, addr]);
    }
};

ZmMailMsgView.prototype._addTrustedAddrErrorCallback =
function(addr) {
    this.getTrustedSendersList().remove(addr);
};

ZmMailMsgView.prototype._isTrustedSender =
function(msg) {
    var trustedList = this.getTrustedSendersList();
    if (trustedList.contains(msg.sentByAddr) || trustedList.contains(msg.sentByDomain)){
        return true;
    }
    return false;
};

ZmMailMsgView.prototype.getTrustedSendersList =
function() {
    return this._controller.getApp().getTrustedSendersList();
};

ZmMailMsgView.showMore =
function(elementId, type) {
	var showMore = document.getElementById(this._getShowMoreId(elementId, type));
	var more = document.getElementById(this._getMoreId(elementId, type));
	showMore.style.display = "none";
	more.style.display = "inline";
};


ZmMailMsgView._getShowMoreId =
function(elementId, type) {
	return elementId + 'showmore_' + type;
};

ZmMailMsgView._getMoreId =
function(elementId, type) {
	return elementId + 'more_addrs_' + type;
};


/**
 *
 * formats the array of addresses as HTML with possible "show more" expand link if more than a certain number of addresses are in the field.
 *
 * @param addrs array of addresses
 * @param options
 * @param type some type identifier (one per page)
 * @param om {ZmObjectManager}
 * @param htmlElId - unique view id so it works with multiple views open.
 *
 * returns {String} the html
 */
ZmMailMsgView.getAddressesFieldHtmlHelper =
function(addrs, options, type, om, htmlElId) {
	var idx = 0;
	var parts = [];
	var showMoreLink = false;
	for (var i = 0; i < addrs.length; i++) {
		if (i > 0) {
			// no need for semicolon if we're showing addr bubbles
			parts[idx++] = options.addrBubbles ? " " : AjxStringUtil.htmlEncode(AjxEmailAddress.SEPARATOR);
		}

		if (i == ZmMailMsgView.MAX_ADDRESSES_IN_FIELD) {
			showMoreLink = true;
			var showMoreId = ZmMailMsgView._getShowMoreId(htmlElId, type);
			var moreId = ZmMailMsgView._getMoreId(htmlElId, type);
			parts[idx++] = "<span id='" + showMoreId + "'>&nbsp;<a href='' onclick='ZmMailMsgView.showMore(\"" + htmlElId + "\", \"" + type + "\"); return false;'>";
			parts[idx++] = ZmMsg.showMore;
			parts[idx++] = "</a></span><span style='display:none;' id='" + moreId + "'>";
		}
		var email = addrs[i];
		if (email.address) {
			parts[idx++] = om
				? (om.findObjects(email, true, ZmObjectManager.EMAIL, false, options))
				: AjxStringUtil.htmlEncode(email.address);
		}
		else {
			parts[idx++] = AjxStringUtil.htmlEncode(email.name);
		}
	}
	if (showMoreLink) {
		parts[idx++] = "</span>";
	}
	return parts.join("");
};


/**
 *
 * formats the array of addresses as HTML with possible "show more" expand link if more than a certain number of addresses are in the field.
 *
 * @param addrs array of addresses
 * @param options
 * @param type some type identifier (one per page)
 *
 * returns {String} the html
 */
ZmMailMsgView.prototype.getAddressesFieldHtml =
function(addrs, options, type) {
	return ZmMailMsgView.getAddressesFieldHtmlHelper(addrs, options, type, this._objectManager, this._htmlElId);
};

ZmMailMsgView.prototype._renderMessage =
function(msg, container, callback) {
	var acctId = appCtxt.getActiveAccount().id;
	var cl;
	if (appCtxt.get(ZmSetting.CONTACTS_ENABLED) &&
		appCtxt.getApp(ZmApp.CONTACTS).contactsLoaded[acctId])
	{
		cl = AjxDispatcher.run("GetContacts");
	}
	var subject = msg.subject || ZmMsg.noSubject;
	var dateFormatter = AjxDateFormat.getDateTimeInstance(AjxDateFormat.LONG, AjxDateFormat.SHORT);
	var dateString = msg.sentDate ? dateFormatter.format(new Date(msg.sentDate)) : dateFormatter.format(new Date(msg.date)); //bug fix #31512 - if no sentdate then display receieddate
	var addr = msg.getAddress(AjxEmailAddress.FROM) || ZmMsg.unknown;
	var sender = msg.getAddress(AjxEmailAddress.SENDER); // bug fix #10652 - check invite if sentBy is set (means on-behalf-of)
	var sentBy = (sender && sender.address) ? sender : addr;
	var sentByAddr = sentBy && sentBy != ZmMsg.unknown ? sentBy.getAddress() : null;
    if (sentByAddr) {
        msg.sentByAddr = sentByAddr;
        msg.sentByDomain = sentByAddr.substr(sentByAddr.indexOf("@")+1);
        msg.showImages = this._isTrustedSender(msg);
    }
	var sentByIcon = cl	? (cl.getContactByEmail((sentBy && sentBy.address ) ? sentBy.address : sentByAddr ) ? "Contact" : "NewContact")	: null;
	var obo = sender ? addr : null;
	var oboAddr = obo && obo != ZmMsg.unknown ? obo.getAddress() : null;
	var additionalHdrs = [];
	var invite = msg.invite;
	var autoSendTime = AjxUtil.isDate(msg.autoSendTime) ? AjxDateFormat.getDateTimeInstance(AjxDateFormat.FULL, AjxDateFormat.MEDIUM).format(msg.autoSendTime) : null;

	if (msg.attrs) {
		for (var hdrName in ZmMailMsgView.displayAdditionalHdrsInMsgView) {
			if (msg.attrs[hdrName]) {
				additionalHdrs.push({hdrName:ZmMailMsgView.displayAdditionalHdrsInMsgView[hdrName], hdrVal: msg.attrs[hdrName]});
			}
		}
	}

	// find addresses we may need to search for contacts for, so that we can
	// aggregate them into a single search
	var contactsApp = appCtxt.getApp(ZmApp.CONTACTS);
	if (contactsApp) {
		var lookupAddrs = [];
		if (sentBy) { lookupAddrs.push(sentBy); }
		if (obo) { lookupAddrs.push(obo); }
		for (var i = 1; i < ZmMailMsg.ADDRS.length; i++) {
			var type = ZmMailMsg.ADDRS[i];
			if (type == AjxEmailAddress.SENDER) { continue; }
			var addrs = msg.getAddresses(type).getArray();
			for (var j = 0; j < addrs.length; j++) {
				if (addrs[j]) {
					lookupAddrs.push(addrs[j].address);
				}
			}
		}
		if (lookupAddrs.length > 1) {
			contactsApp.setAddrLookupGroup(lookupAddrs);
		}
	}

	var options = {};
	options.addrBubbles = appCtxt.get(ZmSetting.USE_ADDR_BUBBLES);
	options.shortAddress = appCtxt.get(ZmSetting.SHORT_ADDRESS);
	
	if (this._objectManager) {
		this._lazyCreateObjectManager();

		// notify zimlets that we're finding objects in the message
		appCtxt.notifyZimlets("onFindMsgObjects", [msg, this._objectManager, this]);

		this._objectManager.setHandlerAttr(ZmObjectManager.DATE,
											ZmObjectManager.ATTR_CURRENT_DATE,
											this._dateObjectHandlerDate);

		subject 	= this._objectManager.findObjects(subject, true);
		sentBy		= this._objectManager.findObjects(sentBy, true, ZmObjectManager.EMAIL, false, options);
		dateString	= this._objectManager.findObjects(dateString, true, ZmObjectManager.DATE);
		if (obo) {
			obo		= this._objectManager.findObjects(addr, true, ZmObjectManager.EMAIL, false, options);
		}
	} else {
		sentBy = AjxStringUtil.htmlEncode(sentBy.toString());
		if (obo) {
			obo = AjxStringUtil.htmlEncode(obo.toString());
		}
	}

	var participants = [];
	for (var i = 1; i < ZmMailMsg.ADDRS.length; i++) {
		var type = ZmMailMsg.ADDRS[i];
		if (type == AjxEmailAddress.SENDER) { continue; }

		var addrs = msg.getAddresses(type).getArray();
		if (addrs.length > 0) {
			var prefix = AjxStringUtil.htmlEncode(ZmMsg[AjxEmailAddress.TYPE_STRING[type]]);
			var partStr = this.getAddressesFieldHtml(addrs, options, type);
			participants.push({ prefix: prefix, partStr: partStr });
		}
	}

	var isTextView = !appCtxt.get(ZmSetting.VIEW_AS_HTML);
	var attachmentsCount = msg.getAttachmentLinks(true, isTextView, true).length;

	// do we add a close button in the header section?
	var hasHeaderCloseBtn = (this._mode == ZmId.VIEW_MSG && !appCtxt.isChildWindow);

	var folder = appCtxt.getById(msg.folderId);
	var isSyncFailureMsg = (folder && folder.nId == ZmOrganizer.ID_SYNC_FAILURES);
    if(!msg.showImages) {
        msg.showImages = folder && folder.isFeed();
    }

	this._hdrTableId		= ZmId.getViewId(this._viewId, ZmId.MV_HDR_TABLE, this._mode);
	var closeBtnCellId		= hasHeaderCloseBtn ? ZmId.getViewId(this._viewId, ZmId.MV_CLOSE_BTN_CELL, this._mode) : null;
	var reportBtnCellId		= ZmId.getViewId(this._viewId, ZmId.MV_REPORT_BTN_CELL, this._mode);
	this._expandRowId		= ZmId.getViewId(this._viewId, ZmId.MV_EXPAND_ROW, this._mode);
	var expandHeaderId		= ZmId.getViewId(this._viewId, ZmId.MV_EXPAND_HDR, this._mode);

	var subs = {
		id: 				this._htmlElId,
		hdrTableId: 		this._hdrTableId,
		hdrTableTopRowId:	ZmId.getViewId(this._viewId, ZmId.MV_HDR_TABLE_TOP_ROW, this._mode),
		closeBtnCellId:		closeBtnCellId,
		expandRowId:		this._expandRowId,
		expandHeaderId:		expandHeaderId,
		attachId:			this._attLinksId,
		infoBarId:			this._infoBarId,
		subject:			subject,
		dateString:			dateString,
		hasAttachments:		(attachmentsCount != 0),
		attachmentsCount:	attachmentsCount
	};

	if (invite && !invite.isEmpty() && this._inviteMsgView) {
		this._inviteMsgView.addSubs(subs, sentBy, sentByAddr, sender ? addr : null);
	}
	else {
		subs.sentBy = sentBy;
		subs.sentByNormal = sentByAddr;
		subs.sentByIcon = sentByIcon;
		subs.sentByAddr = sentByAddr;
		subs.obo = obo;
		subs.oboAddr = oboAddr;
		subs.participants = participants;
		subs.reportBtnCellId = reportBtnCellId;
		subs.isSyncFailureMsg = isSyncFailureMsg;
		subs.autoSendTime = autoSendTime;
		subs.additionalHdrs = additionalHdrs;
		subs.isOutDated = invite && invite.isEmpty()
	}

	var template = (invite && !invite.isEmpty() && this._inviteMsgView)
		? "mail.Message#InviteHeader" : "mail.Message#MessageHeader";
	var html = AjxTemplate.expand(template, subs);

	var el = container || this.getHtmlElement();
	el.appendChild(Dwt.parseHtmlFragment(html));
	this._headerElement = Dwt.byId(this._htmlElId + "_headerElement");

	/**************************************************************************/
	/* Add to DOM based on Id's used to generate HTML via templates           */
	/**************************************************************************/

	// add the expand/collapse arrow button now that we have add to the DOM tree
	var expandHeaderEl = document.getElementById(expandHeaderId);
	if (expandHeaderEl) {
		// Added for bug 26579. Creating this control at object level was not working in IE
		var id = ZmId.getButtonId(this._mode, ZmId.OP_EXPAND, ZmId.MSG_VIEW);
		if (this._expandButton) {
			this._expandButton.dispose();
		}
		this._expandButton = new DwtToolBarButton({parent:this, id:id, parentElement:expandHeaderId});
		this._expandButton.addSelectionListener(new AjxListener(this, this._expandButtonListener));
		this._expandButton.setImage(this._expandHeader ? "HeaderExpanded" : "HeaderCollapsed");
		this._expandButton.setVisible(Dwt.DISPLAY_BLOCK);
	}

	// add the close button if applicable
	if (hasHeaderCloseBtn) {
		var id = ZmId.getButtonId(this._mode, ZmOperation.CLOSE, ZmId.MSG_VIEW);
		var closeButton = new DwtButton({parent:this, id:id, parentElement:closeBtnCellId});
		closeButton.setImage("Close");
		closeButton.setText(ZmMsg.close);
		closeButton.addSelectionListener(new AjxListener(this, this._closeButtonListener));
	}

	// add the report button if applicable
	var reportBtnCell = document.getElementById(reportBtnCellId);
	if (reportBtnCell) {
		var id = ZmId.getButtonId(this._mode, ZmId.REPORT, ZmId.MSG_VIEW);
		var reportBtn = new DwtButton({parent:this, id:id, parentElement:reportBtnCell});
		reportBtn.setText(ZmMsg.reportSyncFailure);
		reportBtn.addSelectionListener(new AjxListener(this, this._reportButtonListener, msg));
	}

	// if multiple body parts, ignore prefs and just append everything
	var origText;
	var bodyParts = msg.getBodyParts();
	var len = bodyParts.length;
	if (len > 1) {
		var html = [];
		var hasHtmlPart = msg.hasHtmlPart();
		for (var i = 0; i < len; i++) {
			var bp = bodyParts[i];
			if (ZmMimeTable.isRenderableImage(bp.ct)) {
				// Hack: (Bug:27320) Done specifically for sMime
				var imgHtml = (bp.content)
					? ["<img zmforced='1' class='InlineImage' src='", bp.content, "'>"].join("")
					: ["<img zmforced='1' class='InlineImage' src='", appCtxt.get(ZmSetting.CSFE_MSG_FETCHER_URI), "&id=", msg.id, "&part=", bp.part, "'>"].join("");
				html.push(imgHtml);
			} else {
				var content = (bp.ct != ZmMimeTable.TEXT_HTML) ? AjxStringUtil.convertToHtml(bp.content) : bp.content;
				if (bp.ct == ZmMimeTable.TEXT_PLAIN) {
					html.push(hasHtmlPart ? "<pre>" : "");
					html.push(content);
					html.push(hasHtmlPart ? "</pre>" : "");
					origText = bp.content;
				} else {
					if (appCtxt.get(ZmSetting.VIEW_AS_HTML)) {
						html.push(content);
					} else {
						// bug fix #31840 - convert HTML to text
						var div = document.createElement("div");
						div.innerHTML = content;
						var convert = AjxStringUtil.convertHtml2Text(div);

						html.push(hasHtmlPart ? "<pre>" : "");
						html.push(AjxStringUtil.htmlEncode(convert));
						html.push(hasHtmlPart ? "</pre>" : "");
					}
				}
			}
		}
		this._makeIframeProxy(el, html.join(""), !hasHtmlPart, false, origText);
	} else {
		var bodyPart = msg.getBodyPart();
		if (bodyPart) {
			var c = bodyPart.content;

			if (bodyPart.ct == ZmMimeTable.TEXT_HTML && appCtxt.get(ZmSetting.VIEW_AS_HTML)) {
				if (invite && !invite.isEmpty() && this._inviteMsgView) {
					c = this._inviteMsgView.truncateBodyContent(c, true);
				}

				// fix broken inline images - take one like this: <img dfsrc="http:...part=1.2.2">
				// and make it look like this: <img dfsrc="cid:DWT123"> by looking up the cid for that part
				if (msg._attachments && ZmMailMsgView.IMG_FIX_RE.test(c)) {
					var partToCid = {};
					for (var i = 0; i < msg._attachments.length; i++) {
						var att = msg._attachments[i];
						if (att.ci) {
							partToCid[att.part] = att.ci.substring(1, att.ci.length - 1);
						}
					}
					c = c.replace(ZmMailMsgView.IMG_FIX_RE, function(s, p1, p2, p3) {
						return partToCid[p2] ? [p1, '"cid:', partToCid[p2], '"', p3].join("") : s;
					});
				}

                if(!c){
                    c = AjxTemplate.expand("mail.Message#EmptyMessage");
                }

				this._makeIframeProxy(el, c, false, bodyPart.truncated);
			} else if (ZmMimeTable.isRenderableImage(bodyPart.ct)) {
				var html = [
					"<img zmforced='1' class='InlineImage' src='",
					appCtxt.get(ZmSetting.CSFE_MSG_FETCHER_URI),
					"&id=", msg.id,
					"&part=", bodyPart.part, "'>"
				].join("");
				this._makeIframeProxy(el, html, false);
			} else {
				// otherwise, get the text part if necessary
				if (bodyPart.ct != ZmMimeTable.TEXT_PLAIN) {
					// try to go retrieve the text part
					var content = msg.getTextPart();
					if (content === -1) {
						var respCallback = new AjxCallback(this, this._handleResponseRenderMessage, [el, bodyPart, callback]);
						msg.fetchTextPart(respCallback);
						return;
					}
					
					if (content != null) {
						content = (bodyPart.ct != ZmMimeTable.TEXT_HTML) ? AjxStringUtil.convertToHtml(content) : content;
						this._makeIframeProxy(el, content, true);
					}
					if (callback) { callback.run(); }

					return;

				} else {
					if (invite && !invite.isEmpty() && this._inviteMsgView) {
						c = this._inviteMsgView.truncateBodyContent(c);
					}

                    var isTextMsg = true;
                    if(!c){
                        c = AjxTemplate.expand("mail.Message#EmptyMessage");
                        isTextMsg = false; //To make sure we display html content properly
                    }
					c = isTextMsg ? AjxStringUtil.convertToHtml(c) : c;
					this._makeIframeProxy(el, c, isTextMsg, bodyPart.truncated, bodyPart.content);
				}
			}
		}
	}

	this._setAttachmentLinks();
	this._expandRows(this._expandHeader);
	Dwt.setLoadedTime("ZmMailItem", new Date());
	if (callback) { callback.run(); }
};

ZmMailMsgView.prototype._handleResponseRenderMessage =
function(el, bodyPart, callback, result, isTruncated) {
	var content = result ? result.getResponse() : null;

	// if no text part, check if theres a calendar part and generate some canned
	// text, otherwise, get the html part if one exists
	if (content == null) {
		if (bodyPart.ct == ZmMimeTable.TEXT_CAL) {
			// NOTE: IE doesn't match multi-line regex, even when explicitly
			// specifying the "m" attribute.
			var lines = bodyPart.content.split(/\r\n/);
			var desc = [];
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i];
				if (line.match(/^DESCRIPTION:/)) {
					desc.push(line.substr(12));
					for (var j = i + 1; j < lines.length; j++) {
						line = lines[j];
						if (line.match(/^\s+/)) {
							desc.push(line.replace(/^\s+/, " "));
							continue;
						}
						break;
					}
					break;
				}
			}
			if (desc.length > 0) {
				content = desc.join("");
				content = content.replace(/\\t/g, "\t");
				content = content.replace(/\\n/g, "\n");
				content = content.replace(/\\(.)/g, "$1");
			}
		}
		else if (bodyPart.ct == ZmMimeTable.TEXT_HTML) {
			// bug fix #8960 - convert the html content to text using the DOM
			var div = document.createElement("div");
			div.innerHTML = bodyPart.content;
			content = AjxStringUtil.convertHtml2Text(div);
		}
	}

	var html = (bodyPart.ct != ZmMimeTable.TEXT_HTML) ? AjxStringUtil.convertToHtml(content) : content;
	var origText = (bodyPart.ct != ZmMimeTable.TEXT_HTML) ? content : null;
	this._makeIframeProxy(el, (content || ""), true, isTruncated, origText);

	this._setAttachmentLinks();
	this._expandRows(this._expandHeader);

	if (callback) { callback.run(); }
	
};

ZmMailMsgView.prototype._setTags =
function(msg) {
	if (!appCtxt.get(ZmSetting.TAGGING_ENABLED) || msg == null || !this._tagList) { return; }

	var numTags = msg.tags.length;
	var table = document.getElementById(this._hdrTableId);
	var tagRow = document.getElementById(this._tagRowId);
	var tagCell = null;

	if (tagRow != null && table.rows[table.rows.length-1] == tagRow) {
		if (numTags > 0) {
			tagCell = tagRow.cells[1];
		} else {
			table.deleteRow(-1);
			return;
		}
	} else {
		if (numTags > 0) {
			tagRow = table.insertRow(-1);
			tagRow.id = this._tagRowId;
			var tagLabelCell = tagRow.insertCell(-1);
			tagLabelCell.className = "LabelColName";
			tagLabelCell.innerHTML = ZmMsg.tags + ":";
			tagLabelCell.style.verticalAlign = "middle";
			tagCell = tagRow.insertCell(-1);
		} else {
			return;
		}
	}

	var tagList = appCtxt.getTagTree(msg.getAccount());

	// get sorted list of tags for this msg
	var ta = [];
	for (var i = 0; i < numTags; i++) {
		ta[i] = tagList.getById(msg.tags[i]);
	}
	ta.sort(ZmTag.sortCompare);

	var html = [];
	var i = 0;

	html[i++] = "<table cellspacing=0 cellpadding=0 border=0 width=100%><tr>";
	html[i++] = "<td style='overflow:hidden; id='";
	html[i++] = this._tagCellId;
	html[i++] = AjxEnv.isIE || AjxEnv.isSafari ? "' class='Tags'>" : "'>";

	if (AjxEnv.isGeckoBased)
		html[i++] = "<table border=0 cellspacing=0 cellpadding=0><tr>";
	for (var j = 0; j < ta.length; j++) {
		var tag = ta[j];
		if (!tag) continue;
		var anchorId = [this._tagCellId, ZmMailMsgView._TAG_ANCHOR, tag.id].join("");
		var imageId = [this._tagCellId, ZmMailMsgView._TAG_IMG, tag.id].join("");

		if (AjxEnv.isGeckoBased) {
			html[i++] = "<td width=16>";
			html[i++] = AjxImg.getImageHtml(tag.getIconWithColor(), null, ["id='", imageId, "'"].join(""));
			html[i++] = "</td><td class='Tags' style='white-space:nowrap;'>";
		}
		html[i++] = "<a href='javascript:' onclick='ZmMailMsgView._tagClick(\"";
		html[i++] = this._htmlElId;
		html[i++] = '","';
		html[i++] = tag.id;
		html[i++] = "\"); return false;' id='";
		html[i++] = anchorId;
		html[i++] = "'>";
		if (AjxEnv.isIE || AjxEnv.isSafari) {
			html[i++] = "<table style='display:inline; vertical-align:middle; width:16px' border=0 cellspacing=0 cellpadding=0><tr><td>";
			html[i++] = AjxImg.getImageHtml(tag.getIconWithColor(), null, ["id='", imageId, "'"].join(""));
			html[i++] = "</td></tr></table>";
		}
		html[i++] = AjxStringUtil.htmlEncodeSpace(tag.name);
		html[i++] = "</a>";
		if (AjxEnv.isGeckoBased)
			html[i++] = "</td>";
	}
	if (AjxEnv.isGeckoBased)
		html[i++] = "</tr></table>";
	html[i++] = "</td></tr></table>";
	tagCell.innerHTML = html.join("");
};

ZmMailMsgView.prototype._setAttachmentLinks =
function() {
    this._attachmentLinkIdToFileNameMap = null;
	var isTextView = !appCtxt.get(ZmSetting.VIEW_AS_HTML);
	var attLinks = this._msg.getAttachmentLinks(true, isTextView, true);
	var el = document.getElementById(this._attLinksId + "_container");
	if (el) {
		el.style.display = attLinks.length == 0 ? "none" : "";
	}
	if (attLinks.length == 0) { return; }

	// prevent appending attachment links more than once
	var attLinksTable = document.getElementById(this._attLinksId + "_table");
	if (attLinksTable) { return; }

	var htmlArr = [];
	var idx = 0;
	var imageAttsFound = 0;
	var hasGeneratedAttachments = false;

	var attColumns = (this._controller.isReadingPaneOn() && this._controller.isReadingPaneOnRight())
		? 1 : ZmMailMsgView.ATTC_COLUMNS;
	var dividx = idx;	// we might get back here
	htmlArr[idx++] = "<table id='" + this._attLinksId + "_table' border=0 cellpadding=0 cellspacing=0>";

	var rows = 0;
	for (var i = 0; i < attLinks.length; i++) {
		var att = attLinks[i];

		hasGeneratedAttachments = hasGeneratedAttachments || !att.part;

		if ((i % attColumns) == 0) {
			if (i != 0) {
				htmlArr[idx++] = "</tr>";
			}
			htmlArr[idx++] = "<tr>";
			++rows;
		}

		htmlArr[idx++] = "<td>";
		htmlArr[idx++] = "<table border=0 cellpadding=0 cellspacing=0 style='margin-right:1em; margin-bottom:1px'><tr>";
		htmlArr[idx++] = "<td style='width:18px'>";
		htmlArr[idx++] = AjxImg.getImageHtml(att.linkIcon, "position:relative;");
		htmlArr[idx++] = "</td><td style='white-space:nowrap'>";

		if (appCtxt.get(ZmSetting.ATTACHMENTS_BLOCKED)) {
			// if attchments are blocked, just show the label
			htmlArr[idx++] = att.label;
		} else {
			var linkArr = [];
			var j = 0;
            var lnk = att.link;
            var displayFileName = AjxStringUtil.clipFile(att.label, 30);
            if (displayFileName != att.label) {
                if (!this._attachmentLinkIdToFileNameMap) {this._attachmentLinkIdToFileNameMap = {}};
                this._attachmentLinkIdToFileNameMap[att.attachmentLinkId] = att.label;
            }

            linkArr[j++] = att.isHit ? "<span class='AttName-matched'>" : "";
            linkArr[j++] = lnk;
            linkArr[j++] = AjxStringUtil.htmlEncode(displayFileName);
            linkArr[j++] = att.isHit ? "</a></span>" : "</a>";

			var link = linkArr.join("");
			// objectify if this attachment is an image
			if (att.objectify && this._objectManager) {
				this._lazyCreateObjectManager();
				var imgHandler = this._objectManager.getImageAttachmentHandler();
				idx = this._objectManager.generateSpan(imgHandler, htmlArr, idx, link, {url:att.url});
			} else {
				htmlArr[idx++] = link;
			}
		}
		if (att.size || att.htmlLink || att.vcardLink || att.download || att.briefcaseLink || att.importICSLink) {
			htmlArr[idx++] = "&nbsp;(";
			if (att.size) {
				htmlArr[idx++] = att.size;
				htmlArr[idx++] = ") ";
			}
			if (att.htmlLink && !appCtxt.get(ZmSetting.ATTACHMENTS_BLOCKED)) {
				htmlArr[idx++] = att.htmlLink;
				htmlArr[idx++] = ZmMsg.preview;
				htmlArr[idx++] = "</a>";
			} else if (att.vcardLink) {
				htmlArr[idx++] = att.vcardLink;
				htmlArr[idx++] = ZmMsg.addressBook;
				htmlArr[idx++] = "</a>";
			}
			if (att.download && !appCtxt.get(ZmSetting.ATTACHMENTS_BLOCKED)) {
				if (att.htmlLink || att.vcardLink) {
					htmlArr[idx++] = " | ";
				}
				htmlArr[idx++] = att.download;
				htmlArr[idx++] = ZmMsg.download;
				htmlArr[idx++] = "</a>";
			}
			if (att.briefcaseLink && !appCtxt.get(ZmSetting.ATTACHMENTS_BLOCKED)) {
				if (att.htmlLink || att.vcardLink || att.download) {
					htmlArr[idx++] = " | ";
				}
				htmlArr[idx++] = att.briefcaseLink;
				htmlArr[idx++] = ZmMsg.addToBriefcase;
				htmlArr[idx++] = "</a>";
			}

			if (att.importICSLink) {
				if (att.briefcaseLink || att.htmlLink || att.vcardLink || att.download) {
					htmlArr[idx++] = " | ";
				}
				htmlArr[idx++] = att.importICSLink;
				htmlArr[idx++] = ZmMsg.addToCalendar;
				htmlArr[idx++] = "</a>";
			}

			// bug: 233 - remove attachment support
			if (att.removeLink) {
				if (att.briefcaseLink || att.htmlLink || att.vcardLink || att.download || att.importICSLink) {
					htmlArr[idx++] = " | ";
				}
				htmlArr[idx++] = att.removeLink;
				htmlArr[idx++] = ZmMsg.remove;
				htmlArr[idx++] = "</a>";
			}

			// Attachment Link Handlers
			if (ZmMailMsgView._attachmentHandlers) {
				var contentHandlers = ZmMailMsgView._attachmentHandlers[att.ct];
				var handlerFunc;
				if (contentHandlers) {
					for (handlerId in contentHandlers) {
						handlerFunc = contentHandlers[handlerId];
						if (handlerFunc) {
							htmlArr[idx++] = " | " + handlerFunc.call(this,att);
						}
					}
				}
			}
		}

		htmlArr[idx++] = "</td></tr></table>";
		htmlArr[idx++] = "</td>";

		if (att.ct.indexOf("image") != -1) {
			++imageAttsFound;
		}
	}

	// limit display size.  seems like an attc. row has exactly 16px; we set it
	// to 56px so that it becomes obvious that there are more attachments.
	if (this._limitAttachments != 0 && rows > ZmMailMsgView._limitAttachments) {
		htmlArr[dividx] = "<div style='height:";
		htmlArr[dividx] = this._attcMaxSize;
		htmlArr[dividx] = "px; overflow:auto;' />";
	}
	htmlArr[idx++] = "</tr></table>";

	if (!hasGeneratedAttachments && attLinks.length > 1) {
		imageAttsFound = imageAttsFound > 1;
		htmlArr[idx++] = ZmMailMsgView._buildZipUrl(this._msg.id, attLinks, imageAttsFound, this._msg.subject);
	}

	var attLinksDiv = document.getElementById(this._attLinksId);
	attLinksDiv.innerHTML = htmlArr.join("");
};

ZmMailMsgView.prototype.getToolTipContent =
function(evt) {
    if (!this._attachmentLinkIdToFileNameMap) {return null};

    var tgt = DwtUiEvent.getTarget(evt, false);
    if (tgt && tgt.nodeName.toLowerCase() == "a") {
        var id = tgt.getAttribute("id");
        if (id) {
            var fileName = this._attachmentLinkIdToFileNameMap[id];
            if (fileName) {
                return AjxStringUtil.htmlEncode(fileName);
            }
        }
    }
    return null;
};

// AttachmentLink Handlers
ZmMailMsgView.prototype.addAttachmentLinkHandler =
function(contentType,handlerId,handlerFunc){
	if (!ZmMailMsgView._attachmentHandlers) {
		ZmMailMsgView._attachmentHandlers = {};
	}

	if (!ZmMailMsgView._attachmentHandlers[contentType]) {
		ZmMailMsgView._attachmentHandlers[contentType] = {};
	}

	ZmMailMsgView._attachmentHandlers[contentType][handlerId] = handlerFunc;
};

// Listeners

ZmMailMsgView.prototype._controlEventListener =
function(ev) {
	var iframe = document.getElementById(this._iframeId);
	// we get here before we have a chance to initialize the IFRAME
	if (iframe) {
		this._resetIframeHeightOnTimer(iframe);
	}
	if (this._inviteMsgView && this._inviteMsgView.isActive()) {
		this._inviteMsgView.resize();
	}
};

ZmMailMsgView.prototype._shareToolBarListener =
function(ev) {
	ev._buttonId = ev.item.getData(ZmOperation.KEY_ID);
	ev._share = this._msg.share;
	this.notifyListeners(ZmMailMsgView.SHARE_EVENT, ev);
};

ZmMailMsgView.prototype._msgChangeListener =
function(ev) {
	if (ev.type != ZmEvent.S_MSG) { return; }
	if (ev.event == ZmEvent.E_DELETE || ev.event == ZmEvent.E_MOVE) {
		if (ev.source == this._msg && (appCtxt.getCurrentViewId() == this._viewId)) {
			this._controller._app.popView();
		}
	} else if (ev.event == ZmEvent.E_TAGS || ev.event == ZmEvent.E_REMOVE_ALL) {
		this._setTags(this._msg);
	} else if (ev.event == ZmEvent.E_MODIFY) {
		if (ev.source == this._msg) {
			this.set(ev.source, true);
		}
	}
};

ZmMailMsgView.prototype._selectStartListener =
function(ev) {
	// reset mouse event to propagate event to browser (allows text selection)
	ev._stopPropagation = false;
	ev._returnValue = true;
};

ZmMailMsgView.prototype._tagChangeListener =
function(ev) {
	if (ev.type != ZmEvent.S_TAG) {	return; }

	var fields = ev.getDetail("fields");
	if (ev.event == ZmEvent.E_MODIFY && (fields && fields[ZmOrganizer.F_COLOR])) {
		var tag = ev.getDetail("organizers")[0];
		var img = document.getElementById(this._tagCellId +  ZmDoublePaneView._TAG_IMG + tag.id);
		if (img) {
			AjxImg.setImage(img, tag.getIconWithColor());
		}
	}

	if (ev.event == ZmEvent.E_DELETE || ev.event == ZmEvent.MODIFY) {
		this._setTags(this._msg);
	}
};

ZmMailMsgView.prototype._expandButtonListener =
function(ev) {
	this._expandRows(!this._expandHeader);
};

ZmMailMsgView.prototype._expandRows =
function(expand) {
	var expandRow = document.getElementById(this._expandRowId);
	if (!expandRow) { return; }

	this._expandHeader = expand;
	if (this._expandButton) {
		this._expandButton.setImage(expand ? "HeaderExpanded" : "HeaderCollapsed");
	}

	var table = expandRow.parentNode;
	if (!expand) {
		this._addressRows = [];
		while (expandRow.nextSibling) {
			var addressRow = expandRow.nextSibling;
			this._addressRows.push(addressRow);
			table.removeChild(addressRow);
		}
	}
	else if (this._addressRows) {
		for (var i = 0; i < this._addressRows.length; i++) {
			var addressRow = this._addressRows[i];
			table.appendChild(addressRow);
		}
		this._addressRows = null;
	}
	var attContainer = document.getElementById(this._attLinksId + "_container");
	if (attContainer) {
		Dwt.setVisible(attContainer, expand);
	}
	if (this._scrollWithIframe) {
		var iframe = document.getElementById(this._iframeId);
		if (iframe) {
			ZmMailMsgView._resetIframeHeight(this, iframe);
		}
	}
};

ZmMailMsgView.prototype._closeButtonListener =
function(ev) {
	// bug fix #30835 - prism triggers this listener twice for some reason :/
	if (!appCtxt.isOffline || (this._viewId == appCtxt.getCurrentViewId())) {
		this._controller._backListener();
	}
};

ZmMailMsgView.prototype._reportButtonListener =
function(msg, ev) {
	var proxy = AjxUtil.createProxy(msg);

	proxy.clearAddresses();
	var toAddress = new AjxEmailAddress(appCtxt.get(ZmSetting.OFFLINE_REPORT_EMAIL));
	proxy._addrs[AjxEmailAddress.TO] = AjxVector.fromArray([toAddress]);

	var bp = msg.getBodyPart();
	if (bp) {
		var top = new ZmMimePart();
		top.setContentType(bp.ct);
		top.setContent(msg.getBodyPart().content);
		proxy.setTopPart(top);
	}

	var respCallback = new AjxCallback(this, this._sendReportCallback, msg);
	var errorCallback = new AjxCallback(this, this._sendReportError);
	proxy.send(false, respCallback, errorCallback, null, true);
};

ZmMailMsgView.prototype._sendReportCallback =
function(msg) {
	this._controller._doDelete([msg], true);
};

ZmMailMsgView.prototype._sendReportError =
function() {
	appCtxt.setStatusMsg(ZmMsg.reportSyncError, ZmStatusView.LEVEL_WARNING);
};


// Callbacks

ZmMailMsgView.prototype._msgTagClicked =
function(tagId) {
	var tag = appCtxt.getById(tagId);
	appCtxt.getSearchController().search({query: tag.createQuery()});
};

ZmMailMsgView.prototype._handleMsgTruncated =
function() {
	// remember that the user clicked this link
	this._msg.viewEntireMessage = true;

	var url = ("/h/message?id=" + this._msg.id);
    if (this._isTrustedSender(this._msg)) {
        url += '&xim=1';
    }
	window.open(appContextPath+url, "_blank");
};

// Focus management - just pass through to native element's focus()
// and blur() methods, which will indicate focus with a dotted border,
// and make the element actively scrollable. Doesn't work in IE, which
// does not support focus for non-input elements.

ZmMailMsgView.prototype._focus =
function() {
	// need this flag because the hidden input field in DwtKeyboard Mgr
	// gets a blur event which it passes to us
	this._settingFocus = true;
	this.getHtmlElement().focus();
	this._settingFocus = false;
};

ZmMailMsgView.prototype._blur =
function() {
	if (this._settingFocus) { return; }
	this.getHtmlElement().blur();
};

// Static methods

ZmMailMsgView._swapIdAndSrc =
function (image, i, len, msg, idoc, iframe, view) {
	// Fix for IE: Over HTTPS, http src urls for images might cause an issue.
	try {
		image.src = image.getAttribute("dfsrc");
	}
	catch (ex) {
		// do nothing
	}

	if (i == len - 1) {
		if (msg) {
			msg.setHtmlContent(idoc.documentElement.innerHTML);
		}
		view._resetIframeHeightOnTimer(iframe);
	}
};

ZmMailMsgView.prototype._onloadIframe =
function(dwtIframe) {
	var iframe = dwtIframe.getIframe();
	try { iframe.onload = null; } catch(ex) {}
	ZmMailMsgView._resetIframeHeight(this, iframe);
};

ZmMailMsgView._resetIframeHeight =
function(self, iframe, attempt) {
	var h;
	if (self._scrollWithIframe) {
		h = self.getH();
		function subtract(el) {
			if (el) {
				if (typeof el == "string") {
					el = document.getElementById(el);
				}
				if (el) {
					h -= Dwt.getSize(el).y;
				}
			}
		}
		subtract(self._headerElement);
		subtract(self._displayImagesId);
		subtract(self._highlightObjectsId);
		if (self._isMsgTruncated) {
			subtract(self._msgTruncatedId);
		}
		if (self._inviteMsgView && self._inviteMsgView.isActive()) {
			if (self._inviteMsgView._inviteToolbar) {//if toolbar not created there's nothing to subtract (e.g. sent folder)
				subtract(self._inviteMsgView.getInviteToolbar().getHtmlElement());
			}
			if (self._inviteMsgView._dayView) {
				subtract(self._inviteMsgView._dayView.getHtmlElement());
			}
		}
		if (self._hasShareToolbar && self._shareToolbar) {
			subtract(self._shareToolbar.getHtmlElement());
		}
		iframe.style.height = h + "px";
	} else {
		if (attempt == null) { attempt = 0; }
		try {
			if (!iframe.contentWindow ||
				!iframe.contentWindow.document ||
				(AjxEnv.isFirefox3up && attempt == 0))
			{
				if (attempt < ZmMailMsgView.SETHEIGHT_MAX_TRIES) {
					attempt++;
					self._resetIframeHeightOnTimer(iframe, attempt);
				}
				return; // give up
			}
		} catch(ex) {
			if (attempt < ZmMailMsgView.SETHEIGHT_MAX_TRIES) {
				attempt++;
				self._resetIframeHeightOnTimer(iframe, attempt++); // for IE
			}
			return; // give up
		}

		var doc = iframe.contentWindow.document;
		var origHeight = AjxEnv.isIE ? doc.body.scrollHeight : 0;

		// first off, make it wide enough to fill ZmMailMsgView.
		iframe.style.width = "100%"; // *** changes height!

		// wait, are we too high? (bug 21037)
		if (AjxEnv.isGeckoBased &&
			Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) > 30000) {
			self.setScrollWithIframe(true);
			return;
		}

		// remember the current width
		var view_width = iframe.offsetWidth;

		// if there's a long unbreakable string, the scrollWidth of the body
		// element will be bigger--we must make the iframe that wide, or there
		// won't be any scrollbars.
		var w = doc.body.scrollWidth;
		if (w > view_width) {
			iframe.style.width = w + "px"; // *** changes height!

			// Now (bug 20743), by forcing the body a determined width (that of
			// the view) we are making the browser wrap those paragraphs that
			// can be wrapped, even if there's a long unbreakable string in the message.
			doc.body.style.overflow = "visible";
			if (view_width > 20) {
				doc.body.style.width = view_width - 20 + "px"; // *** changes height!
			}
		}

		// we are finally in the right position to determine height.
		h = Math.max(doc.documentElement.scrollHeight, origHeight);

		iframe.style.height = h + "px";

		if (AjxEnv.isWebKitBased) {
			// bug: 39434, WebKit specific
			// After the iframe ht is set there is change is body.scrollHeight, weird.
			// So reset ht to make the entire body visible.
			var newHt = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
			if (newHt > h) {
				iframe.style.height = newHt + "px";
			}
		}
	}
};

// note that IE doesn't seem to be able to reset the "scrolling" attribute.
// this function isn't safe to call for IE!
ZmMailMsgView.prototype.setScrollWithIframe =
function(val) {
	this._scrollWithIframe = val;
	this._limitAttachments = this._scrollWithIframe ? 3 : 0; //making it local
	this._attcMaxSize = this._limitAttachments * 16 + 8;

	this.setScrollStyle(val ? DwtControl.CLIP : DwtControl.SCROLL);
	var iframe = document.getElementById(this._iframeId);
	if (iframe) {
		iframe.style.width = "100%";
		iframe.scrolling = val;
		ZmMailMsgView._resetIframeHeight(this, iframe);
	}
};

ZmMailMsgView._tagClick =
function(myId, tagId) {
	var dwtObj = DwtControl.fromElementId(myId);
	dwtObj.notifyListeners(ZmMailMsgView._TAG_CLICK, tagId);
};

ZmMailMsgView._detachCallback =
function(isRfc822, mode, result) {
	var ac = window.parentAppCtxt || window.appCtxt;
	var resp = result.getResponse().GetMsgResponse;
	var list = ac.getApp(ZmApp.MAIL).getMailListController().getList();
	var msg = new ZmMailMsg(resp.m[0].id, list, true); // do not cache this temp msg
	msg._loadFromDom(resp.m[0]);
	msg._loaded = true; // bug fix #8868 - force load for rfc822 msgs since they may not return any content
	msg.readReceiptRequested = false; // bug #36247 - never allow read receipt for rfc/822 message
	msg._part = resp.m[0].part;
	ZmMailMsgView.detachMsgInNewWindow(msg, isRfc822, mode);
};

ZmMailMsgView.detachMsgInNewWindow =
function(msg, isRfc822, mode) {
	var appCtxt = window.parentAppCtxt || window.appCtxt;
	var newWinObj = appCtxt.getNewWindow(true);
	if(newWinObj) {// null check for popup blocker
		newWinObj.command = "msgViewDetach";
		newWinObj.params = { msg:msg, isRfc822:isRfc822, mode:mode };
	}
};

ZmMailMsgView.rfc822Callback =
function(msgId, msgPartId, mode) {
	var isRfc822 = Boolean((msgPartId != null));
	var appCtxt = window.parentAppCtxt || window.appCtxt;
	var params = {
		sender: appCtxt.getAppController(),
		msgId: msgId,
		partId: msgPartId,
		getHtml: appCtxt.get(ZmSetting.VIEW_AS_HTML),
		markRead: true,
		callback: (new AjxCallback(null, ZmMailMsgView._detachCallback, [isRfc822, mode]))
	};
	ZmMailMsg.fetchMsg(params);
};

ZmMailMsgView.contactIconCallback =
function(addr, icon) {
	if (icon == "Contact") {
		var params = {
			action: ZmOperation.NEW_MESSAGE,
			toOverride: (addr + AjxEmailAddress.SEPARATOR)
		};
		AjxDispatcher.run("Compose", params);
	} else {
		AjxDispatcher.require(["ContactsCore", "Contacts"], false);
		var contact = new ZmContact(null);
		var email = AjxEmailAddress.parse(addr);
		contact.initFromEmail(email);
		AjxDispatcher.run("GetContactController").show(contact, true);
	}
};

ZmMailMsgView.vcardCallback =
function(msgId, partId) {
	ZmZimbraMail.unloadHackCallback();

	var ac = window.parentAppCtxt || window.appCtxt;
	ac.getApp(ZmApp.CONTACTS).createFromVCard(msgId, partId);
};

ZmMailMsgView.downloadAndOpenAttachmentCallback =
function(downloadURL) {
    chrome.downloads.download({"url": downloadURL}, function() { 
        //download has initiated, adding listener to track changes.
        chrome.downloads.onChanged.addListener(handleDownloadAndOpen);
    });

    function handleDownloadAndOpen(e) {
         if(e.filename) { 
             fileName=e.filename.current;
         }
         if(e.state && e.state.current == "complete") {
             chrome.downloads.onChanged.removeListener(handleDownloadAndOpen);
             nw.Shell.openItem(fileName);
         }
    };
};


ZmMailMsgView.removeAttachmentCallback =
function(msgId, partIds) {
	ZmZimbraMail.unloadHackCallback();

	if (!(partIds instanceof Array)) { partIds = partIds.split(","); }

	var msg = (partIds.length > 1)
		? ZmMsg.attachmentConfirmRemoveAll
		: ZmMsg.attachmentConfirmRemove;

	var dlg = appCtxt.getYesNoMsgDialog();
	dlg.registerCallback(DwtDialog.YES_BUTTON, ZmMailMsgView._removeAttachmentCallback, null, [msgId, partIds]);
	dlg.setMessage(msg, DwtMessageDialog.WARNING_STYLE);
	dlg.popup();
};

ZmMailMsgView._removeAttachmentCallback =
function(msgId, partIds) {
	appCtxt.getYesNoMsgDialog().popdown();

	var jsonObj = {RemoveAttachmentsRequest: {_jsns:"urn:zimbraMail"}};
	var request = jsonObj.RemoveAttachmentsRequest;
	request.m = { id: msgId, part: partIds.join(",") };

	var searchParams = {
		jsonObj: jsonObj,
		asyncMode: true,
		callback: (new AjxCallback(null, ZmMailMsgView._handleRemoveAttachment, [msgId])),
		noBusyOverlay: true
	};
	return appCtxt.getAppController().sendRequest(searchParams);
};

ZmMailMsgView._handleRemoveAttachment =
function(oldMsgId, result) {
	var ac = window.parentAppCtxt || window.appCtxt;
	// cache this actioned ID so we can reset selection to it once the CREATE
	// notifications have been processed.
	var msgNode = result.getResponse().RemoveAttachmentsResponse.m[0];
	var mailListCtlr = ac.getApp(ZmApp.MAIL).getMailListController();
	mailListCtlr.actionedMsgId = msgNode.id;
	var list = mailListCtlr.getList();

	var avm = appCtxt.getAppViewMgr();
	var views = avm._views;
	var msg = new ZmMailMsg(msgNode.id, list, true);
	msg._loadFromDom(msgNode);

	for (var viewId in views) {
		var viewObj = views[viewId];
		var view = viewObj && (viewObj[ZmAppViewMgr.C_APP_CONTENT] || viewObj[ZmAppViewMgr.C_APP_CONTENT_FULL]);
		if (view) {
			if (AjxUtil.isFunction(view.handleRemoveAttachment)) {
				view.handleRemoveAttachment(oldMsgId, msg);
			}
		}
	}
};

ZmMailMsgView.prototype.handleRemoveAttachment =
function(oldMsgId, newMsg) {
	if (!this._msg || this._msg.id == oldMsgId) {
		this._msg = null;
		this.set(newMsg);
	}
};

ZmMailMsgView._buildZipUrl =
function(itemId, attachments, viewAllImages, filename) {
	if (AjxUtil.isString(filename)) {
		filename = filename.replace(ZmMailMsgView.FILENAME_INV_CHARS_RE, "");
	} else {
		filename = null;
	}
	filename = AjxStringUtil.urlComponentEncode(filename || ZmMsg.downloadAllDefaultFileName);
	var url = [appCtxt.get(ZmSetting.CSFE_MSG_FETCHER_URI), "&id=", itemId, "&filename=", filename,"&charset=", appCtxt.getCharset(), "&part="].join("");
	var parts = [];
	for (var j = 0; j < attachments.length; j++) {
		parts.push(attachments[j].part);
	}
	var partsStr = parts.join(",");
	var params = { url:(url+partsStr), partIds:partsStr, itemId:itemId };
	if (viewAllImages) {
		params.viewAllUrl = "/h/viewimages?id="+itemId;
	}

	return AjxTemplate.expand("mail.Message#AllAttachments", params);
};

ZmMailMsgView.briefcaseCallback =
function(msgId, partId, name) {
	ZmZimbraMail.unloadHackCallback();

	// force create deferred folders if not created
	AjxDispatcher.require("BriefcaseCore");
	var aCtxt = appCtxt.isChildWindow ? parentAppCtxt : appCtxt;
	var briefcaseApp = aCtxt.getApp(ZmApp.BRIEFCASE);
	briefcaseApp._createDeferredFolders();

	appCtxt.getApp(ZmApp.BRIEFCASE).createFromAttachment(msgId, partId, name);
};

ZmMailMsgView.prototype.deactivate =
function() {
	this._controller.inactive = true;
};

ZmMailMsgView.addToCalendarCallback =
function(msgId, partId, name) {
	ZmZimbraMail.unloadHackCallback();

	// force create deferred folders if not created
	AjxDispatcher.require("CalendarCore");
	var aCtxt = appCtxt.isChildWindow ? parentAppCtxt : appCtxt;
	var calApp = aCtxt.getApp(ZmApp.CALENDAR);
	calApp._createDeferredFolders();

	appCtxt.getApp(ZmApp.CALENDAR).importAppointment(msgId, partId, name);
};

ZmMailMsgView.prototype.getMsgBodyElement =
function(){
    return document.getElementById(ZmId.getViewId(this._viewId, ZmId.MV_MSG_BODY, this._mode));
};
