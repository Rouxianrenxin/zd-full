/*
 * 
 */

/**
 * Creates the briefcase tab view.
 * @class
 * This class represents the briefcase tab view.
 * 
 * @param	{ZmControl}		parent	the parent
 * @param	{String}		className		the class name
 * @param	{constant}		posStyle		the position style
 * 
 * @extends		DwtTabViewPage
 * 
 * @see			Dwt.STATIC_STYLE
 */
ZmBriefcaseTabView = function(parent,className,posStyle) {

	this._app = appCtxt.getApp(ZmApp.BRIEFCASE);
	this.view = ZmId.VIEW_BRIEFCASE_ICON;

    DwtTabViewPage.call(this,parent,className,Dwt.STATIC_STYLE);

    this.setScrollStyle(Dwt.SCROLL);
};

ZmBriefcaseTabView.prototype = new DwtTabViewPage;
ZmBriefcaseTabView.prototype.constructor = ZmBriefcaseTabView;

/**
 * Returns a string representation of the object.
 * 
 * @return		{String}		a string representation of the object
 */
ZmBriefcaseTabView.prototype.toString = function(){
    return "ZmBriefcaseTabView";
};

/**
 * Shows this view.
 * 
 */
ZmBriefcaseTabView.prototype.showMe =
function() {
    DwtTabViewPage.prototype.showMe.call(this);
    this.setSize(Dwt.DEFAULT, 235);
	this._itemCountText.setVisible(true);
    this.showFolder(this._folderId || ZmOrganizer.ID_BRIEFCASE);
};

/**
 * Hides this view.
 * 
 */
ZmBriefcaseTabView.prototype.hideMe =
function() {
    DwtTabViewPage.prototype.hideMe.call(this);
	this._itemCountText.setVisible(false);
};

//Create UI for Briefcase Tab UI
ZmBriefcaseTabView.prototype._createHtml =
function() {

    this._contentEl =  this.getContentHtmlElement();
    this._tableID = Dwt.getNextId();
    this._folderTreeCellId = Dwt.getNextId();
    this._folderListId = Dwt.getNextId();
    var html = [];
    var idx = 0;
    html[idx++] = ['<table class="ZmBriefcaseTabView_Table" id="', this._tableID, '" cellspacing="0" cellpadding="0" border="0">'].join("");
    html[idx++] = '<tr>';
    html[idx++] = ['<td width="30%" valign="top" id="', this._folderTreeCellId, '">'].join("");
    html[idx++] = '</td>';
    html[idx++] = ['<td width="70%" valign="top" id="', this._folderListId, '">'].join("");
    html[idx++] = '</td>';
    html[idx++] = '</tr>';
    html[idx++] = '</table>';
    this._contentEl.innerHTML = html.join("");
    
    this.showBriefcaseTreeView();

	var loadCallback = new AjxCallback(this, this._createHtml1);
	AjxDispatcher.require(["BriefcaseCore", "Briefcase"], false, loadCallback);
};

ZmBriefcaseTabView.prototype._createHtml1 =
function() {

 	this._app = appCtxt.getApp(ZmApp.BRIEFCASE);
	var bc = this._controller = new ZmBriefcaseController(this._app._container, this._app);

    var params = {parent:bc._container, className:"BriefcaseTabBox BriefcaseList", view:this.view,
				  controller:bc};
    var lv = this._listView = this._controller._listView[this.view] = new ZmBriefcaseIconView(params);
    lv.reparentHtmlElement(this._folderListId);
    Dwt.setPosition(lv.getHtmlElement(),Dwt.RELATIVE_STYLE);

	var tb = this.parent._tabBar;
	var el = tb._suffixEl;
	if (el) {
		var b = new DwtText({parent:tb, className:"itemCountText", id:this.view + "Text"});
		this._itemCountText = bc._itemCountText[this.view] = b;
		b.reparentHtmlElement(el.id);
		b.getHtmlElement().style.textAlign = "right";
	}
};

ZmBriefcaseTabView.prototype.setSize =
function(width, height) {

    DwtTabViewPage.prototype.setSize.call(this, width, height);

    var size = this.getSize();
    var treeWidth = size.x * 0.40;
    var listWidth = size.x - treeWidth;
    var newHeight = height - 15;
	if (this._overview) {
		this._overview.setSize(treeWidth, newHeight);
		this._listView.setSize(listWidth - 5, newHeight);
	}
	
    return this;
};

/**
 * Shows the folder.
 * 
 * @param	{String}	folderId		the folder id
 */
ZmBriefcaseTabView.prototype.showFolder =
function(folderId) {
    this._folderId = folderId;
    var callback = new AjxCallback(this, this.showFolderContents, [folderId]);
    var params = {
        folderId:folderId,
        callback:callback,
        noRender:true
    };
    if (appCtxt.multiAccounts) {
        params.accountName = appCtxt.getAppViewMgr().getCurrentView().getFromAccount().name;
    }
    this._app.search(params);
};

/**
 * Shows the folder contents.
 * 
 * @param	{String}	folderId		the folder id
 * @param	{Object}	results			the results
 */
ZmBriefcaseTabView.prototype.showFolderContents =
function(folderId, results) {
	var searchResult = results.getResponse();
	if (searchResult) {
		var list = this._controller._list = searchResult.getResults(ZmItem.BRIEFCASE_ITEM);
		this._controller._list.setHasMore(searchResult.getAttribute("more"));
		ZmListController.prototype.show.call(this._controller, searchResult, ZmId.VIEW_BRIEFCASE_ICON);
		this._listView.set(list);
        this._listView.focus();
		this._controller._setItemCountText();
	}
};

ZmBriefcaseTabView.prototype._handleKeys =
function(ev){
    var key = DwtKeyEvent.getCharCode(ev);
    return (key != DwtKeyEvent.KEY_ENTER && key != DwtKeyEvent.KEY_END_OF_TEXT);
};

ZmBriefcaseTabView.prototype.gotAttachments =
function() {
    return false;
};

ZmBriefcaseTabView.prototype.uploadFiles =
function(attachDialog, docIds) {

    if (!docIds) {
        docIds = [];
        var items = this._listView.getSelection();
        if (!items || (items.length == 0)) {
            var attachDialog = appCtxt.getAttachDialog();
            attachDialog.setFooter(ZmMsg.attachSelectMessage);
            return;
        }
        for (var i in items) {
            docIds.push({id: items[i].id, ct: items[i].contentType, s: items[i].size});
        }
    }

	docIds = AjxUtil.toArray(docIds);

    var callback = attachDialog.getUploadCallback();
    if (callback) {
        callback.run(AjxPost.SC_OK, null, docIds);
    }
};

ZmBriefcaseTabView.prototype.showBriefcaseTreeView =
function() {

    //Force create deferred folders if not created
    var aCtxt = appCtxt.isChildWindow ? parentAppCtxt : appCtxt;
    var briefcaseApp = aCtxt.getApp(ZmApp.BRIEFCASE);
    briefcaseApp._createDeferredFolders();

    var base = this.toString();
    var acct = appCtxt.getActiveAccount();
    var params = {
        treeIds: [ZmOrganizer.BRIEFCASE],
        fieldId: this._folderTreeCellId,
        overviewId: (appCtxt.multiAccounts) ? ([base, acct.name].join(":")) : base,
        account: acct
    };
    this._setOverview(params);

};

ZmBriefcaseTabView.prototype._setOverview =
function(params) {
    var overviewId = params.overviewId;
    var opc = appCtxt.getOverviewController();
    var overview = opc.getOverview(overviewId);
    if (!overview) {
        var ovParams = {
            overviewId: overviewId,
            overviewClass: "BriefcaseTabBox",
            headerClass: "DwtTreeItem",
            noTooltips: true,
            treeIds: params.treeIds
        };
        overview = this._overview = opc.createOverview(ovParams);
        overview.set(params.treeIds);
        document.getElementById(params.fieldId).appendChild(overview.getHtmlElement());
        var treeView = overview.getTreeView(ZmOrganizer.BRIEFCASE);
        treeView.addSelectionListener(new AjxListener(this, this._treeListener));
        this._hideRoot(treeView);
    } else if (params.account) {
        overview.account = params.account;
    }
};

ZmBriefcaseTabView.prototype._treeListener =
function(ev) {
    if (ev.detail == DwtTree.ITEM_SELECTED) {
        var ti = ev.item;
        var folder = ti.getData(Dwt.KEY_OBJECT);
        if (folder) {
            this.showFolder(folder.id);
        }
    }
};

ZmBriefcaseTabView.prototype._hideRoot =
function(treeView) {
    var ti = treeView.getTreeItemById(ZmOrganizer.ID_ROOT);
    if (!ti) {
        var rootId = ZmOrganizer.getSystemId(ZmOrganizer.ID_ROOT)
        ti = treeView.getTreeItemById(rootId);
    }
    ti.showCheckBox(false);
    ti.setExpanded(true);
    ti.setVisible(false, true);
};
