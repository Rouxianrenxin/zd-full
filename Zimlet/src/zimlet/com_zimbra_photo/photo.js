/*
 * 
 */

// Initialize 
function Com_Zimbra_Photo() {
    this.nameToImage= {
	"Bill Evans" : "bill_evans.jpg",
	"Jimmy Smith" : "jimmy_smith.jpg",
	"Medeski" : "medeski.jpg",
	"Thelonious Monk" : "monk.jpg",
	"Ray Charles" : "ray_charles.jpg"
    };
}

Com_Zimbra_Photo.prototype.init =
    function() {
	// Pre-load placeholder image
	(new Image()).src = this.getResource('blank_pixel.gif');
    };

Com_Zimbra_Photo.prototype = new ZmZimletBase();
Com_Zimbra_Photo.prototype.constructor = Com_Zimbra_Photo;

Com_Zimbra_Photo.prototype.match =
    function(line, startIndex) {
	var match;

	for (var name in this.nameToImage) {
	    var i = line.indexOf(name, startIndex);
	    // Skip if not found or this match isn't earlier
	    if (i < 0 || (match != null && i >= match.index)) {
		continue;
	    }

	    match = {index: i};
	    match[0] = name;
	}
	return match;
    };

Com_Zimbra_Photo.prototype.toolTipPoppedUp =
    function(spanElement, obj, context, canvas) {
	var image = this.nameToImage[obj];
	// alert("obj = '" + obj + "', image='" + image + "'");
	canvas.innerHTML = '<img src="' +
	this.getResource(image) +
	'"/>';
    };
