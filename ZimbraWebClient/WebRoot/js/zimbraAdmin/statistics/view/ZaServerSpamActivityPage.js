/*
 * 
 */

/**
* @class ZaServerSpamActivityPage 
* @contructor ZaServerSpamActivityPage
* @param parent
* @param app
* @author Greg Solovyev
**/
ZaServerSpamActivityPage = function(parent) {
	this.serverId = parent.serverId; //should pass this server id firstly

	DwtTabViewPage.call(this, parent);
	this._fieldIds = new Object(); //stores the ids of all the form elements

	//this._createHTML();
	this.initialized=false;
	this.setScrollStyle(DwtControl.SCROLL);	
}
 
ZaServerSpamActivityPage.prototype = new DwtTabViewPage;
ZaServerSpamActivityPage.prototype.constructor = ZaServerSpamActivityPage;

ZaServerSpamActivityPage.prototype.toString = 
function() {
	return "ZaServerSpamActivityPage";
}

ZaServerSpamActivityPage.prototype.showMe =  function(refresh) {
	DwtTabViewPage.prototype.showMe.call(this);	
	if(refresh && this._currentObject) {
		this.setObject(this._currentObject);
	}
	if (this._currentObject) {
	    var item = this._currentObject;
        var serverId = this.serverId;

        var charts = document.getElementById('loggerchartserverasav-' + serverId);
        charts.style.display = "block";
        var divIds = [ 'serverasav-no-mta-' + serverId,
            'server-message-asav-48hours-' + serverId,
            'server-message-asav-30days-' + serverId,
            'server-message-asav-60days-' + serverId,
            'server-message-asav-year-' + serverId
        ];

	    ZaGlobalAdvancedStatsPage.hideDIVs(divIds);
	    
	    var hosts = ZaGlobalAdvancedStatsPage.getMTAHosts();
	    if (ZaGlobalAdvancedStatsPage.indexOf(hosts, item.name) != -1) {
	        ZaGlobalAdvancedStatsPage.detectFlash(document.getElementById("loggerchartserverasav-flashdetect-" + serverId));
            var startTimes = [null, 'now-48h', 'now-30d', 'now-60d', 'now-1y'];
            for (var i=1; i < divIds.length; i++){ //skip divId[0] -- servermv-no-mta
                ZaGlobalAdvancedStatsPage.plotQuickChart(divIds[i], item.name, 'zmmtastats', ['filter_virus', 'filter_spam'], ['filtered'], startTimes[i], 'now', { convertToCount: 1 });
            }

        } else {
            var nomta = document.getElementById('loggerchartserverasav-no-mta-' + serverId);
            nomta.style.display = "block";
            charts.style.display = "none";
            ZaGlobalAdvancedStatsPage.setText(nomta, ZaMsg.Stats_NO_MTA);
        }
    }
}

ZaServerSpamActivityPage.prototype.setObject =
function (item) {
	this._currentObject = item;		
}

ZaServerSpamActivityPage.prototype._createHtml = 
function () {
	DwtTabViewPage.prototype._createHtml.call(this);
	var idx = 0;
	var html = new Array(50);
    var serverId = this.serverId;
	html[idx++] = "<h1 style='display: none' id='loggerchartserverasav-flashdetect-" + serverId + "'></h1>";	
	html[idx++] = "<h1 style='display: none' id='loggerchartserverasav-no-mta-" + serverId + "'></h1>";	
	html[idx++] = "<h3 style='padding-left: 10px'>" + ZaMsg.Stats_AV_Header + "</h3>" ;	
	html[idx++] = "<div id='loggerchartserverasav-" + serverId + "'>";	
	html[idx++] = "<table cellpadding='5' cellspacing='4' border='0' align='left' style='width: 90%'>";	
	html[idx++] = "<tr valign='top'><td align='left' class='StatsImageTitle'>" + AjxStringUtil.htmlEncode(ZaMsg.NAD_StatsHour) + "</td></tr>";	
	html[idx++] = "<tr valign='top'><td align='left'>";
	html[idx++] = "<div id='loggerchartserver-message-asav-48hours-" + serverId + "'></div>";	
	html[idx++] = "</td></tr>";
	html[idx++] = "<tr valign='top'><td align='left' class='StatsImageTitle'>" + AjxStringUtil.htmlEncode(ZaMsg.NAD_StatsDay) + "</td></tr>";	
	html[idx++] = "<tr valign='top'><td align='left'>";
	html[idx++] = "<div id='loggerchartserver-message-asav-30days-" + serverId + "'></div>";	
	html[idx++] = "</td></tr>";
	html[idx++] = "<tr valign='top'><td align='left'>&nbsp;&nbsp;</td></tr>";	
	html[idx++] = "<tr valign='top'><td align='left' class='StatsImageTitle'>" + AjxStringUtil.htmlEncode(ZaMsg.NAD_StatsMonth) + "</td></tr>";	
	html[idx++] = "<tr valign='top'><td align='left'>";
	html[idx++] = "<div id='loggerchartserver-message-asav-60days-" + serverId + "'></div>";	
	html[idx++] = "</td></tr>";
	html[idx++] = "<tr valign='top'><td align='left'>&nbsp;&nbsp;</td></tr>";		
	html[idx++] = "<tr valign='top'><td align='left' class='StatsImageTitle'>" + AjxStringUtil.htmlEncode(ZaMsg.NAD_StatsYear) + "</td></tr>";	
	html[idx++] = "<tr valign='top'><td align='left'>";
	html[idx++] = "<div id='loggerchartserver-message-asav-year-" + serverId + "'></div>";	
	html[idx++] = "</td></tr>";
	html[idx++] = "</table>";
	html[idx++] = "</div>";
	this.getHtmlElement().innerHTML = html.join("");
}