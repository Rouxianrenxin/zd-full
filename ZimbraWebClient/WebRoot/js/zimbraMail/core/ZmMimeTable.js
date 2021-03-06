/*
 * 
 */

/**
 * @overview
 * This file contains the mime table information utility class.
 * 
 */

/**
 * Creates the mime table class
 * @class
 * This class represents a mime table that contains utility methods for managing mime types.
 * 
 */
ZmMimeTable = function() {
};

// IGNORE means the client will not display these attachment types to the user
ZmMimeTable.APP						= "application";
ZmMimeTable.APP_ADOBE_PDF			= "application/pdf";
ZmMimeTable.APP_ADOBE_PS			= "application/postscript";
ZmMimeTable.APP_APPLE_DOUBLE 		= "application/applefile";		// IGNORE
ZmMimeTable.APP_EXE					= "application/exe";
ZmMimeTable.APP_MS_DOWNLOAD			= "application/x-msdownload";
ZmMimeTable.APP_MS_EXCEL			= "application/vnd.ms-excel";
ZmMimeTable.APP_MS_PPT				= "application/vnd.ms-powerpoint";
ZmMimeTable.APP_MS_PROJECT			= "application/vnd.ms-project";
ZmMimeTable.APP_MS_TNEF				= "application/ms-tnef"; 		// IGNORE
ZmMimeTable.APP_MS_TNEF2 			= "application/vnd.ms-tnef"; 	// IGNORE (added per bug 2339)
ZmMimeTable.APP_SIGNATURE           = "application/pkcs7-signature"; // IGNORE (added per bug 69476)
ZmMimeTable.APP_MS_VISIO			= "application/vnd.visio";
ZmMimeTable.APP_MS_WORD				= "application/msword";
ZmMimeTable.APP_OCTET_STREAM		= "application/octet-stream";
ZmMimeTable.APP_OPENXML_DOC			= "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
ZmMimeTable.APP_OPENXML_EXCEL		= "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
ZmMimeTable.APP_OPENXML_PPT			= "application/vnd.openxmlformats-officedocument.presentationml.presentation";
ZmMimeTable.APP_XML     			= "application/xml";
ZmMimeTable.APP_ZIMBRA_DOC			= "application/x-zimbra-doc";
ZmMimeTable.APP_ZIMBRA_SLIDES		= "application/x-zimbra-slides";
ZmMimeTable.APP_ZIMBRA_SPREADSHEET	= "application/x-zimbra-xls";
ZmMimeTable.APP_ZIP					= "application/zip";
ZmMimeTable.APP_ZIP2				= "application/x-zip-compressed";
ZmMimeTable.AUDIO					= "audio";
ZmMimeTable.AUDIO_WAV				= "audio/x-wav";
ZmMimeTable.AUDIO_MP3				= "audio/mpeg";
ZmMimeTable.IMG						= "image";
ZmMimeTable.IMG_GIF					= "image/gif";
ZmMimeTable.IMG_BMP					= "image/bmp";
ZmMimeTable.IMG_JPEG				= "image/jpeg";
ZmMimeTable.IMG_PJPEG				= "image/pjpeg";				// bug 23607
ZmMimeTable.IMG_PNG					= "image/png";
ZmMimeTable.IMG_TIFF				= "image/tiff";
ZmMimeTable.MSG_RFC822				= "message/rfc822";
ZmMimeTable.MSG_READ_RECEIPT		= "message/disposition-notification";
ZmMimeTable.MULTI_ALT				= "multipart/alternative"; 		// IGNORE
ZmMimeTable.MULTI_MIXED				= "multipart/mixed"; 			// IGNORE
ZmMimeTable.MULTI_RELATED			= "multipart/related"; 			// IGNORE
ZmMimeTable.MULTI_APPLE_DBL 		= "multipart/appledouble"; 		// IGNORE
ZmMimeTable.MULTI_DIGEST			= "multipart/digest";			// IGNORE
ZmMimeTable.TEXT					= "text";
ZmMimeTable.TEXT_RTF				= "text/enriched";
ZmMimeTable.TEXT_HTML				= "text/html";
ZmMimeTable.TEXT_CAL				= "text/calendar"; 				// IGNORE
ZmMimeTable.TEXT_JAVA				= "text/x-java";
ZmMimeTable.TEXT_VCARD				= "text/x-vcard";
ZmMimeTable.TEXT_DIRECTORY  	    = "text/directory";
ZmMimeTable.TEXT_PLAIN				= "text/plain";
ZmMimeTable.TEXT_XML				= "text/xml";
ZmMimeTable.VIDEO					= "video";
ZmMimeTable.VIDEO_WMV				= "video/x-ms-wmv";
ZmMimeTable.XML_ZIMBRA_SHARE		= "xml/x-zimbra-share";

ZmMimeTable._table = new Object();

// only add types which are NOT ignored by the client	
ZmMimeTable._table[ZmMimeTable.APP]					= {desc: ZmMsg.unknownBinaryType, image: "ExeDoc", imageLarge: "ExeDoc_48", imageMedium: "ExeDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_ADOBE_PDF]		= {desc: ZmMsg.adobePdfDocument, image: "PDFDoc", imageLarge: "PDFDoc_48", imageMedium: "PDFDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_ADOBE_PS]		= {desc: ZmMsg.adobePsDocument, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_EXE]				= {desc: ZmMsg.application, image: "ExeDoc", imageLarge: "ExeDoc_48", imageMedium: "ExeDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_DOWNLOAD]		= {desc: ZmMsg.msDownload, image: "ExeDoc", imageLarge: "ExeDoc_48", imageMedium: "ExeDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_EXCEL]		= {desc: ZmMsg.msExcelDocument, image: "MSExcelDoc", imageLarge: "MSExcelDoc_48", imageMedium: "MSExcelDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_PPT]			= {desc: ZmMsg.msPPTDocument, image: "MSPowerpointDoc", imageLarge: "MSPowerpointDoc_48", imageMedium: "MSPowerpointDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_PROJECT]		= {desc: ZmMsg.msProjectDocument, image: "MSProjectDoc", imageLarge: "MSProjectDoc_48", imageMedium: "MSProjectDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_VISIO]		= {desc: ZmMsg.msVisioDocument, image: "MSVisioDoc", imageLarge: "MSVisioDoc_48", imageMedium: "MSVisioDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_MS_WORD]			= {desc: ZmMsg.msWordDocument, image: "MSWordDoc", imageLarge: "MSWordDoc_48", imageMedium: "MSWordDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_OCTET_STREAM]	= {desc: ZmMsg.unknownBinaryType, image: "UnknownDoc", imageLarge: "UnknownDoc_48", imageMedium: "UnknownDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_OPENXML_DOC]		= {desc: ZmMsg.msWordDocument, image: "MSWordDoc", imageLarge: "MSWordDoc_48", imageMedium: "MSWordDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_OPENXML_EXCEL]	= {desc: ZmMsg.msExcelDocument, image: "MSExcelDoc", imageLarge: "MSExcelDoc_48", imageMedium: "MSExcelDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_OPENXML_PPT]		= {desc: ZmMsg.msPPTDocument, image: "MSPowerpointDoc", imageLarge: "MSPowerpointDoc_48", imageMedium: "MSPowerpointDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_XML]			    = {desc: ZmMsg.xmlDocument, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_ZIMBRA_DOC]  	= {desc: ZmMsg.zimbraDocument, image: "Doc", imageLarge: "Doc_48",  imageMedium: "Doc_32"};
ZmMimeTable._table[ZmMimeTable.APP_ZIMBRA_SLIDES]	= {desc: ZmMsg.zimbraPresentation, image: "Presentation", imageLarge: "Presentation_48", imageMedium: "ZSpreadSheet_32"};
ZmMimeTable._table[ZmMimeTable.APP_ZIMBRA_SPREADSHEET] = {desc: ZmMsg.zimbraSpreadsheet, image: "ZSpreadSheet", imageLarge: "ZSpreadSheet_48", imageMedium: "ZSpreadSheet_32"};
ZmMimeTable._table[ZmMimeTable.APP_ZIP]				= {desc: ZmMsg.zipFile, image: "ZipDoc", imageLarge: "ZipDoc_48", imageMedium: "ZipDoc_32"};
ZmMimeTable._table[ZmMimeTable.APP_ZIP2]			= {desc: ZmMsg.zipFile, image: "ZipDoc", imageLarge: "ZipDoc_48", imageMedium: "ZipDoc_32"};
ZmMimeTable._table[ZmMimeTable.AUDIO]				= {desc: ZmMsg.audio, image: "AudioDoc", imageLarge: "Doc_48", imageMedium: "Doc_32"};
ZmMimeTable._table[ZmMimeTable.AUDIO_WAV]			= {desc: ZmMsg.waveAudio, image: "AudioDoc", imageLarge: "AudioDoc_48", imageMedium: "AudioDoc_32"};
ZmMimeTable._table[ZmMimeTable.AUDIO_MP3]			= {desc: ZmMsg.mp3Audio, image: "AudioDoc", imageLarge: "AudioDoc_48", imageMedium: "AudioDoc_32"};
ZmMimeTable._table[ZmMimeTable.VIDEO]				= {desc: ZmMsg.video, image: "VideoDoc", imageLarge: "VideoDoc_48", imageMedium: "VideoDoc_32"};
ZmMimeTable._table[ZmMimeTable.VIDEO_WMV]			= {desc: ZmMsg.msWMV, image: "VideoDoc", imageLarge: "VideoDoc_48", imageMedium: "VideoDoc_32"};
ZmMimeTable._table[ZmMimeTable.IMG]					= {desc: ZmMsg.image, image: "ImageDoc", imageLarge: "ImageDoc_48", imageMedium: "ImageDoc_32"};
ZmMimeTable._table[ZmMimeTable.IMG_GIF]				= {desc: ZmMsg.gifImage, image: "ImageDoc", imageLarge: "ImageDoc_48", imageMedium: "ImageDoc_32"};
ZmMimeTable._table[ZmMimeTable.IMG_JPEG]			= {desc: ZmMsg.jpegImage, image: "ImageDoc", imageLarge: "ImageDoc_48", imageMedium: "ImageDoc_32"};
ZmMimeTable._table[ZmMimeTable.IMG_PNG]				= {desc: ZmMsg.pngImage, image: "ImageDoc", imageLarge: "ImageDoc_48", imageMedium: "ImageDoc_32"};
ZmMimeTable._table[ZmMimeTable.IMG_TIFF]			= {desc: ZmMsg.tiffImage, image: "ImageDoc", imageLarge: "ImageDoc_48", imageMedium: "ImageDoc_32"};
ZmMimeTable._table[ZmMimeTable.MSG_RFC822]			= {desc: ZmMsg.mailMessage, image: "MessageDoc", imageLarge: "MessageDoc_48", imageMedium: "MessageDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT]				= {desc: ZmMsg.textDocuments, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT_RTF]			= {desc: ZmMsg.enrichedText, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT_HTML]			= {desc: ZmMsg.htmlDocument, image: "HtmlDoc", imageLarge: "HtmlDoc_48", imageMedium: "HtmlDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT_JAVA]			= {desc: ZmMsg.javaSource, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT_PLAIN]			= {desc: ZmMsg.textFile, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};
ZmMimeTable._table[ZmMimeTable.TEXT_XML]			= {desc: ZmMsg.xmlDocument, image: "GenericDoc", imageLarge: "GenericDoc_48", imageMedium: "GenericDoc_32"};

ZmMimeTable.getInfo =
function(type, createIfUndefined) {
	var entry = ZmMimeTable._table[type];
	if (!entry && createIfUndefined) {
		entry = ZmMimeTable._table[type] = {desc: type, image: "UnknownDoc", imageLarge: "UnknownDoc_48"};
	}
	if (entry) {
		if (!entry.type)
			entry.type = type;
	} else {
		// otherwise, check if main category is in table
		var baseType = type.split("/")[0];
		if (baseType)
			entry = ZmMimeTable._table[baseType];
	}
	return entry;
};

/**
 * Checks if the type is ignored.
 * 
 * @param	{constant}	type		the type
 * @return	{Boolean}	<code>true</code> if the type is ignored
 */
ZmMimeTable.isIgnored = 
function(type) {
	return (type == ZmMimeTable.MULTI_ALT ||
			type == ZmMimeTable.MULTI_MIXED ||
			type == ZmMimeTable.MULTI_RELATED ||
			type == ZmMimeTable.MULTI_APPLE_DBL ||
			type == ZmMimeTable.APP_MS_TNEF ||
			type == ZmMimeTable.APP_MS_TNEF2 ||
			type == ZmMimeTable.APP_SIGNATURE ||
			type == ZmMimeTable.XML_ZIMBRA_SHARE);
};

/**
 * Checks if the type is renderable.
 * 
 * @param	{constant}	type		the type
 * @return	{Boolean}	<code>true</code> if the type is renderable
 */
ZmMimeTable.isRenderable =
function(type) {
	return (type == ZmMimeTable.TEXT_HTML ||
			type == ZmMimeTable.TEXT_PLAIN ||
			ZmMimeTable.isRenderableImage(type));
};

ZmMimeTable.isTextType =
function(type){
    return (type.match(/^text\/.*/) &&
            type != ZmMimeTable.TEXT_HTML &&
            type != ZmMimeTable.TEXT_CAL);  
};

/**
 * Checks if the type is a renderable image.
 * 
 * @param	{constant}	type		the type
 * @return	{Boolean}	<code>true</code> if the type is a renderable image
 */
ZmMimeTable.isRenderableImage =
function(type) {
	return (type == ZmMimeTable.IMG_JPEG ||
			type == ZmMimeTable.IMG_GIF ||
			type == ZmMimeTable.IMG_BMP ||
			type == ZmMimeTable.IMG_PNG);
};

/**
 * Checks if the type has an HTML version.
 * 
 * @param	{constant}	type		the type
 * @return	{Boolean}	<code>true</code> if the type has an HTML version
 */
ZmMimeTable.hasHtmlVersion =
function(type) {
	return (!(ZmMimeTable.isIgnored(type) ||
			type.match(/^text\/plain/) ||
			type.match(/^image/) ||
			type.match(/^audio/) ||
			type.match(/^video/)));
};

ZmMimeTable.isMultiMedia =
function(type){
    return (type.match(/^audio/) ||
			type.match(/^video/));
};

ZmMimeTable.isWebDoc =
function(type) {
    return (type == ZmMimeTable.APP_ZIMBRA_SLIDES ||
            type == ZmMimeTable.APP_ZIMBRA_SPREADSHEET ||
            type == ZmMimeTable.APP_ZIMBRA_DOC);
};
