/*jslint browser: true, devel: true, eqeq: true*/
"use strict";

// Global functions
/*global google, Modernizr, $*/

// Function list
/*global initialize, geocodeAddress, setMapViewport, calculateRoute,
	generateTable, setAttractionMarkers, notifyUser, removeNotifications,
	initPlanTour, initAttractions, initHotels*/

// Initialised in mapproperties.js
/*global reasonableZoom, mapProperties*/

// Google Maps specific variable declaration
var geocoder,
	directionsDisplay,
	directionsService,
	map;

// Variables for 'autocomplete' on the start and end location text boxes
var startLocation,
	endLocation,
	userLocation;

var userMarker;

// Store the travel type
var travelType = "walking",
	isLooping = false;

var minimumRating = 2;

// End of time (for cookie storage purposes)
var endOfTime = "expires=Fri, 31 Dec 9999 23:59:59 GMT;",
	immediate = "expires=Thu, 01 Jan 1970 00:00:00 UTC;";

// Transit, traffic, and bicycle layers
var transitLayer,
	trafficLayer,
	bicycleLayer;

/* FOR POPUP PAGE */
// Variables of the current location set by asynchronous method 
var currentLocationName,
	currentLocation;

var addedAttractionsArray = [];


function initialize() {
	initPlanTour();
	initAttractions();
	initHotels();
}

function initPlanTour() {
	// Function scope variables
    var startAutocomplete,
		endAutocomplete,
		attractionAutocomplete,
		hotelAutocomplete;
	
	// Detect browser location support
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(function (position) {
			userLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
			map.setCenter(userLocation);
			map.setZoom(reasonableZoom);
		}, function () {
			console.log("Geolocation service failed");
		});
	} else {
		console.log("Browser does not support Geolocation");
	}
		
	//Add Map to Div
	map = new google.maps.Map(document.getElementById("map-canvas"), mapProperties);
	
	// Prepare directions API
	directionsDisplay = new google.maps.DirectionsRenderer();
	directionsService = new google.maps.DirectionsService();

	//Initialise Geocoder object
	geocoder = new google.maps.Geocoder();

	// Initialising the autocomplete objects, restricting the search
	// to geographical location types.
	startAutocomplete = new google.maps.places.Autocomplete((document.getElementById('start-location')), { types: ['geocode'] });
	endAutocomplete = new google.maps.places.Autocomplete((document.getElementById('end-location')), { types: ['geocode'] });


	// When the user selects an address from the dropdown,
	// populate the address fields in the form.
	// start location autocomplete event
	google.maps.event.addListener(startAutocomplete, 'place_changed', function () {
		geocodeAddress(document.getElementById('start-location').value, 1);
	});

	// destination location autocomplete event
	google.maps.event.addListener(endAutocomplete, 'place_changed', function () {
		geocodeAddress(document.getElementById('end-location').value, 2);
	});
	
	// Initialise date picker for departure time
	if (!Modernizr.inputtypes['datetime-local']  || navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
		$("#departure-time").datetimepicker({
			sideBySide: true,
			format: "D MMM YYYY h:mm a"
		});
	} else {
		// Remove the button and place the input field in the parent
		// styling breaks if the button is removed without reordering DOM
		$("#departure-time>input").attr("type", "datetime-local");
	}
	
	transitLayer = new google.maps.TransitLayer();
	trafficLayer = new google.maps.TrafficLayer();
	bicycleLayer = new google.maps.BicyclingLayer();
}

function initAttractions() {
	// Function scope variables
	var attractionAutocomplete;
					
	// Initialising the autocomplete objects, restricting the search
	// to geographical location types.
	attractionAutocomplete = new google.maps.places.Autocomplete(document.getElementById('attraction-location'), {
		types: ['establishment'],
		componentRestrictions: {country: "aus"}
	});
		
	// When the user selects an address from the dropdown,
	// populate the address fields in the form.
	//start location autocomplete event
	google.maps.event.addListener(attractionAutocomplete, 'place_changed', function () {
		currentLocationName = document.getElementById('attraction-location').value;
		geocodeAddress(document.getElementById('attraction-location').value, 3);
		
		$("#add-attraction").removeAttr("disabled");
	});
	
	$("#attraction-table-container").hide();
}

function initHotels() {
	$("#cost-range").slider({});
	
	$("#cost-range").on("slide", function (slideEvt) {
		$("#cost-min").text("$" + slideEvt.value[0]);
		$("#cost-max").text("$" + slideEvt.value[1]);
	});
}

//Takes the entered address and set the start and end location latitude and longitude
//The assign variable being a 1 or a 2 determines whether the locations is the start or destination
function geocodeAddress(location, assign) {
	geocoder.geocode({ 'address': location }, function (results, status) {
		if (status === google.maps.GeocoderStatus.OK) {
			//global variable assignment
			if (assign === 1) {
				startLocation = results[0].geometry.location;
			} else if (assign === 2) {
				endLocation = results[0].geometry.location;
			} else if (assign === 3) {
				currentLocation = results[0].geometry.location;
			}
			
			if (assign !== 3) {
				calculateRoute();
			}
		} else {
			console.log('Geocode was not successful for the following reason: ' + status);
		}
	});
}


function setMapViewport(arrayOfLocations) {
	var i, mapBounds;
	mapBounds = new google.maps.LatLngBounds();
	if (arrayOfLocations.length > 0) {
		for (i = 0; i < arrayOfLocations.length; i += 1) {
			mapBounds.extend(arrayOfLocations[i]);
		}
		
		map.fitBounds(mapBounds);
		
		if (arrayOfLocations.length === 1) {
			map.setZoom(reasonableZoom);
		}
	}
}

function addAttraction() {
	var location = {name: currentLocationName, location: currentLocation};
	addedAttractionsArray.push(location);

	// Clears the attractions auto complete box 
	document.getElementById("attraction-location").value = '';
	$("#add-attraction").attr("disabled", true);

	generateTable();
//	setAttractionMarkers();
	calculateRoute();
}

function generateTable() {
    var table,
        row,
        locationNameCell,
        travelInfoCell,
        infoButtonCell,
        closeButtonCell,
        i;
    
	table = document.getElementById("attraction-table");

	// Delete contents of table
	$(table).empty();
	
	if (addedAttractionsArray.length === 0) {
		$("#attraction-table-container").hide();
	} else {
		$("#attraction-table-container").show();
		for (i = 0; i < addedAttractionsArray.length; i += 1) {
			row = table.insertRow(-1);

			locationNameCell = row.insertCell(0);
			travelInfoCell = row.insertCell(1);
			infoButtonCell = row.insertCell(2);
			closeButtonCell = row.insertCell(3);

			locationNameCell.innerHTML = addedAttractionsArray[i].name;
			travelInfoCell.innerHTML = "00:00 0km";
			infoButtonCell.innerHTML = "<span class='glyphicon glyphicon-info-sign'></span>";
			closeButtonCell.innerHTML = "<button type='button' class='close' onclick='deleteAttraction(this)'>&times;</button>";
		}
	}
}


// Fixed and shortened
function deleteAttraction(button) {
	var row = $(button).parent().parent();
	addedAttractionsArray.splice(row.index(), 1);
	
	generateTable();
//	setAttractionMarkers();
	calculateRoute();
}

function shareRoute() {
	
}

/** Get the Google travel method **/
function getGTravelMode() {
	var travelMode;
	if (travelType === "driving") {
		travelMode = google.maps.TravelMode.DRIVING;
	} else if (travelType === "walking") {
		travelMode = google.maps.TravelMode.WALKING;
	} else if (travelType === "cycling") {
		travelMode = google.maps.TravelMode.BICYCLING;
	} else if (travelType === "transit") {
		travelMode = google.maps.TravelMode.TRANSIT;
	}
	return travelMode;
}

function calculateRoute() {
	// Function level variables
	var request,
		allLocations,
		waypoints = [],
		i;
	
	// Calculate and draw directions
	for (i = 0; i < addedAttractionsArray.length; i += 1) {
		console.log(addedAttractionsArray[i].location);
		waypoints.push({
			location: addedAttractionsArray[i].location,
			stopover: true
		});
	}
	
	if (startLocation != undefined && endLocation != undefined) {
		directionsDisplay.setMap(map);
		request = {
			origin: startLocation,
			destination: endLocation,
			travelMode: getGTravelMode(),
			waypoints: waypoints,
			optimizeWaypoints: true
		};
		directionsService.route(request, function (response, status) {
			if (status === google.maps.DirectionsStatus.OK) {
				directionsDisplay.setDirections(response);
			}
		});
	} else if (startLocation != undefined && isLooping) {
		directionsDisplay.setMap(map);
		request = {
			origin: startLocation,
			destination: startLocation,
			travelMode: getGTravelMode(),
			waypoints: waypoints,
			optimizeWaypoints: true
		};
		directionsService.route(request, function (response, status) {
			if (status === google.maps.DirectionsStatus.OK) {
				directionsDisplay.setDirections(response);
			}
		});
	} else {
		directionsDisplay.setMap(null);
	}
	
	// Set the maps view
	allLocations = [];
	if (startLocation != undefined) {
		allLocations.push(startLocation);
	}
	if (endLocation != undefined) {
		allLocations.push(endLocation);
	}
	for (i = 0; i < addedAttractionsArray.length; i += 1) {
		allLocations.push(addedAttractionsArray[i].location);
	}
	
    setMapViewport(allLocations);
}

/** Generates and regenerates all the attraction markers **/
/*function setAttractionMarkers() {
	var i, newMarker;
	// Clear current markers
	for (i = 0; i < attractionMarkers.length; i += 1) {
		attractionMarkers[i].setMap(null);
	}
	attractionMarkers = [];
	
	// Add all attractions to map
	for (i = 0; i < addedAttractionsArray.length; i += 1) {
		newMarker = new google.maps.Marker({
			animation: google.maps.Animation.DROP,
			map: map,
			position: addedAttractionsArray[i].location
		});
		attractionMarkers.push(newMarker);
	}
}*/

function setTravelType(originElement, newTravelType) {
	travelType = newTravelType;
	$("#travel-mode>.btn-group").each(function () {
		$(this).children().first().attr("class", "btn btn-default");
	});
	if (newTravelType === "transit") {
		$(originElement).attr("class", "btn btn-warning");
		notifyUser("<span class='glyphicon glyphicon-warning-sign'></span> Experimental Transit.", "This travel mode is experimental and subject to change by Google", "warning");
	} else {
		$(originElement).attr("class", "btn btn-success");
		removeNotifications();
	}
	
	transitLayer.setMap(undefined);
	bicycleLayer.setMap(undefined);
	trafficLayer.setMap(undefined);
	
	switch (travelType) {
    case "transit":
        transitLayer.setMap(map);
        break;
    case "cycling":
        bicycleLayer.setMap(map);
        break;
    case "driving":
        trafficLayer.setMap(map);
        break;
	}
	
	calculateRoute();
}

function setRating(originElement, newRating) {
	minimumRating = newRating;
	$("#hotel-rating>.btn-group").each(function () {
		$(this).children().first().attr("class", "btn btn-default");
	});
	$(originElement).attr("class", "btn btn-success");
}

function setRoundTrip(button) {
	// Returns a string rather than a boolean
	// ALSO is inverted
	if ($(button).attr("aria-pressed") !== "true") {
		isLooping = true;
		$("#end-location").hide();
		$(button).addClass("btn-success");
		$(button).removeClass("btn-default");
		
		endLocation = null;
		$("#end-location").val("");
	} else {
		isLooping = false;
		$("#end-location").show();
		$(button).addClass("btn-default");
		$(button).removeClass("btn-success");
	}
	calculateRoute();
}

/** Save and load the trip at the beginning and end of each session, 
	Save/load buttons are not user friendly **/
function saveTrip() {
	
}

function loadTrip() {
	
}

function changeTab(tabName) {
	var newTab = $("#planTab a[href='" + tabName + "']");
	newTab.tab("show");
	
	$("#footer-tabs a").each(function () {
		$(this).removeAttr("class");
		if ($(this).attr("href") === tabName) {
			$(this).attr("class", "active");
		}
	});
	
	$(".current-tab-title").html($("#planTab>.active>a").html());
}

/** type includes success, info, warning, danger **/
function notifyUser(title, text, type) {
	// Can't do multiline strings apparently?
	var html = "<div class='alert alert-" + type + " alert-dismissible' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><strong>" + title + "</strong> " + text + "</div>";
	$("#popup-container").append(html);
}

function removeNotifications() {
	$("#popup-container").html("");
}

