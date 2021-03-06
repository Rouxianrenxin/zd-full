/*
 * 
 */

/**
 * @overview
 * This file defines a search folder class.
 */

/**
 * Creates the search folder.
 * @class
 * This class represents a search folder.
 * 
 * @param	{Hash}	params		a hash of parameters
 * 
 * @extends	ZmFolder
 */
ZmSearchFolder = function(params) {
	params.type = ZmOrganizer.SEARCH;
	ZmFolder.call(this, params);
	
	if (params.query) {
		var searchParams = {
			query:params.query,
			types:params.types,
			sortBy:params.sortBy,
			searchId:params.id,
			accountName:(params.account && params.account.name)
		};
		this.search = new ZmSearch(searchParams);
	}
};

ZmSearchFolder.ID_ROOT = ZmOrganizer.ID_ROOT;

/**
 * Creates a search folder.
 * 
 * @param	{Hash}	params		a hash of parameters
 */
ZmSearchFolder.create =
function(params) {
	var soapDoc = AjxSoapDoc.create("CreateSearchFolderRequest", "urn:zimbraMail");
	var searchNode = soapDoc.set("search");
	searchNode.setAttribute("name", params.name);
	searchNode.setAttribute("query", params.search.query);
	if (params.search.types) {
		var a = params.search.types.getArray();
		if (a.length) {
			var typeStr = [];
			for (var i = 0; i < a.length; i++) {
				typeStr.push(ZmSearch.TYPE[a[i]]);
			}
			searchNode.setAttribute("types", typeStr.join(","));
		}
	}
	if (params.search.sortBy) {
		searchNode.setAttribute("sortBy", params.search.sortBy);
	}

	var accountName;
	if (params.isGlobal) {
		searchNode.setAttribute("f", "g");
		accountName = appCtxt.accountList.mainAccount.name;
	}

	searchNode.setAttribute("l", params.parent.id);
	appCtxt.getAppController().sendRequest({
		soapDoc: soapDoc,
		asyncMode: true,
		accountName: accountName,
		errorCallback: (new AjxCallback(null, ZmOrganizer._handleErrorCreate, params))
	});
};

ZmSearchFolder.prototype = new ZmFolder;
ZmSearchFolder.prototype.constructor = ZmSearchFolder;

/**
 * Returns a string representation of the object.
 * 
 * @return		{String}		a string representation of the object
 */
ZmSearchFolder.prototype.toString =
function() {
	return "ZmSearchFolder";
};

/**
 * Gets the icon.
 * 
 * @return	{String}	the icon
 */
ZmSearchFolder.prototype.getIcon = 
function() {
	return (this.nId == ZmOrganizer.ID_ROOT)
		? null
		: (this.isOfflineGlobalSearch ? "GlobalSearchFolder" : "SearchFolder");
};

/**
 * Gets the tool tip.
 * 
 */
ZmSearchFolder.prototype.getToolTip = function() {};

/**
 * Returns the organizer with the given ID. Looks in this organizer's tree first.
 * Since a search folder may have either a regular folder or another search folder
 * as its parent, we may need to get the parent folder from another type of tree.
 *
 * @param {int}	parentId	the ID of the organizer to find
 * 
 * @private
 */
ZmSearchFolder.prototype._getNewParent =
function(parentId) {
	var parent = appCtxt.getById(parentId);
	if (parent) {
		return parent;
	}
	
	return appCtxt.getById(parentId);
};
