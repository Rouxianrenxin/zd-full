/*
 * 
 */

/**
 * Creates the briefcase icon view.
 * @class
 * This class represents the briefcase icon view.
 * 
 * @param	{Hash}	params		a hash of parameters
 * 
 * @extends		ZmBriefcaseBaseView
 */
ZmBriefcaseIconView = function(params) {
	ZmBriefcaseBaseView.call(this, params);
	this.getHtmlElement().style.backgroundColor = "white";
}

ZmBriefcaseIconView.prototype = new ZmBriefcaseBaseView;
ZmBriefcaseIconView.prototype.constructor = ZmBriefcaseIconView;

/**
 * Returns a string representation of the object.
 * 
 * @return		{String}		a string representation of the object
 */
ZmBriefcaseIconView.prototype.toString =
function() {
	return "ZmBriefcaseIconView";
};

// Data
ZmBriefcaseIconView.prototype._createItemHtml =
function(item, params) {
	
	var name = item.name;
	var contentType = item.contentType;
	
	if(contentType && contentType.match(/;/)) {
			contentType = contentType.split(";")[0];
	}
	var mimeInfo = contentType ? ZmMimeTable.getInfo(contentType) : null;
	icon = "Img" + ( mimeInfo ? mimeInfo.imageLarge : "UnknownDoc_48");

	if(item.isFolder) {
		icon = "ImgBriefcase_48";
	}
	
	if(name.length>14){
		name = name.substring(0,14)+"...";
	}
	
	var div = document.createElement("div");
	div.className = "ZmBriefcaseItemSmall";
	
	var htmlArr = [];
	var idx = 0;

	var icon = null;
	if (!icon) {
		var contentType = item.contentType;
		if(contentType && contentType.match(/;/)) {
			contentType = contentType.split(";")[0];
		}
		var mimeInfo = contentType ? ZmMimeTable.getInfo(contentType) : null;
		icon = mimeInfo ? mimeInfo.image : "UnknownDoc" ;
		if(item.isFolder){
			icon = "Folder";
		}
	}
	
	htmlArr[idx++] = "<table><tr><td>";
    idx = this._getImageHtml(htmlArr, idx, "CheckboxUnchecked", this._getFieldId(item, ZmItem.F_SELECTION));
    htmlArr[idx++] = "</td><td><div class='Img";
	htmlArr[idx++] = icon;
	htmlArr[idx++] = "'></div></td><td nowrap>";
	htmlArr[idx++] = AjxStringUtil.htmlEncode(item.name);
	htmlArr[idx++] = "</td><tr></table>";
	
	if (params && params.isDragProxy) {
		Dwt.setPosition(div, Dwt.ABSOLUTE_STYLE);
	}
	div.innerHTML = htmlArr.join("");
	
	this.associateItemWithElement(item, div);
	return div;
};

ZmBriefcaseIconView.prototype.set =
function(list, sortField, doNotIncludeFolders){

    doNotIncludeFolders = true;

    ZmBriefcaseBaseView.prototype.set.call(this, list, sortField, doNotIncludeFolders);

};