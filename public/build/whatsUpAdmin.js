app.View.EventAdd = Backbone.View.extend({
    name: 'EventAdd',
    el: '#addModal',
    events:{
	'click #addItem' : 'addItem'
    },
    addItem: function(){

	//Get data from form and pass to router
	var form = $('#eventAddForm :input');
	var values = {};
	form.each( function(){
	    values[this.name] = $(this).val();
	});
	console.log( values );
	if( typeof this.validateLocation == 'function' )
	    this.validateLocation( values );



    },
    //hide and reset modal
    hideModal: function(){
	console.log("hiding modal");
	$(this.el).modal('hide');
	$("#eventAddForm")[0].reset();
	$("#modalErr").html('');
    },
    modalError: function( err ){
	console.log("Error modal");
	$("#modalErr").html("&nbsp"+ err );
    }
});

app.View.EventTable = Backbone.View.extend({
    name: 'EventTable',
    el: '#tableViewArea',
    events:{
	'click #saveButton': 'saveData',
	'click .table-remove': 'remove'
    },
   render: function( data ){

	console.log( "View render" , data );
	var source = $('#tableTemplate').html();
	var template = Handlebars.compile( source );
	var html = template( data );
	console.log( html );
	$( "#tableArea" ).html( html );
    },
    saveData: function(){
	if( typeof this.saveCollection == 'function' )
	    this.saveCollection();
    },
    remove: function( e ){
	$(e.target).parents('tr').detach();
	if( typeof this.removeById == 'function' )
	    this.removeById( $(e.target).attr('value')  );
    }

});



app.Model.EventModel = Backbone.Model.extend({
    initialize: function(){
	console.log("New event created");
    }
});

//To hold our event models as they are created
app.Collection.EventCollection = Backbone.Collection.extend({
    name: "EventCollection",
    url: 'getUserEvents',
    cache: null,
    topId: 0,
    userId: 0,
    initialize: function(){
	console.log("New event collection created");
    },
    getUserData: function(){
	var scope = this;
	this.fetch({
	    success: function(){
		if( typeof scope.onDataLoaded == 'function' )
		    scope.onDataLoaded();
		else
		    console.error("No handle for data load");
	    },
	    error: function(){
		if( typeof scope.onDataError == 'function' )
		    scope.onDataError();
		else
		    console.error("No handle for data error");
	    }
	});
    },
    saveData: function(){
	console.log("Collection saving data");
	this.sync( 'create', this );
    },
    newLocation: function( values ){
	this.cache = values;
	var datesResult = this.validateDate( values ) 
	
	if( datesResult == true )
	    this.validateLocation( values );
        else
            if( typeof this.validationFailure == 'function' )
		this.validationFailure( datesResult );
		
    },
    validateLocation: function( values ){
	var req = new XMLHttpRequest();
	var scope = this;
	var qString = 'http://nominatim.openstreetmap.org/search/q='
	              + values.street +
	             ',' + values.city +
	              '?format=json';
 
	req.addEventListener("load", this.nominatimListener );
	req.collectionCallback = function( response ){
	    scope.validationCallback( response );
	}
	req.open('GET', qString );
	req.send();
        console.log("Verification request sent");	
    },
    nominatimListener: function(){
	console.log(this.responseText);
	this.collectionCallback( this.responseText );
    },
    validationCallback: function( response ){
	var data = JSON.parse(response); 
	console.log("Got response callback" , data );
	if( typeof data[0] == 'undefined' || typeof data[0].lat == 'undefined' || typeof data[0].lon == 'undefined'){
	    if( typeof this.validationFailure == 'function' )
		this.validationFailure( "Could not lookup that address");
	}
	else
	    if( typeof this.validationSuccess == 'function' )
		this.validationSuccess({ lat: data[0].lat, lon:data[0].lon});
    },
    validateDate: function( values ){
	var startdate = values.startdate;
	var enddate = values.enddate;
	var starttime = values.starttime;
	var endtime = values.endtime;
	console.log( "Values",values );
	console.log( "dates ",startdate, enddate, starttime, values.endtime );
	if( !this.checkDate( startdate ) || !this.checkDate( enddate ) )
	    return "Dates not formatted correctly";
	if( !this.checkTime( starttime ) || !this.checkTime( endtime ) )
	    return "Times not formatted correctly";
	return true;
    },
    checkDate: function( dateIn ){
	var reDate = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
	if( !dateIn.match( reDate ) )
	    return false;
	return true;
    },
    checkTime: function( timeIn ){
	var reTime = /^\d{1,2}:\d{2}([ap]m)?$/;
	if( !timeIn.match( reTime ) )
	    return false;
	return true;
    },
    removeById: function( eventid ){
	console.log("Removing event id", eventid );
	this.remove( this.where( { eventid: Number(eventid) } ) ); 
    }
	
	
});

app.Router.AdminRouter = Backbone.Router.extend({
    routes:{
	"": "tableRoute"
    },
    tableRoute: function(){
	
	console.log("Admin router routing default route");
	
	console.log( Handlebars );
	var eventAddView = app.getViewByName('EventAdd');
	var eventTableView = app.getViewByName('EventTable');
	var eventCollection = app.getCollection('EventCollection');


	eventTableView.saveCollection = function(){
	    eventCollection.saveData();
	}
	eventTableView.removeById = function( eventId ){
	    eventCollection.removeById( eventId );
	}
	eventAddView.validateLocation = function( values ){
	    eventCollection.newLocation( values );
	}
	eventCollection.validationSuccess = function( data ){
	    console.log("Validation was a success");
	    console.log( eventCollection.cache, data );
	    var cache = eventCollection.cache;
	    this.topId=this.topId+1;
	   eventCollection.add({
		description:cache.description,
		enddate: cache.enddate,
		startdate: cache.startdate,
		starttime: cache.starttime,
		endtime: cache.endtime,
		name: cache.title,
		lat: data.lat,
		lon: data.lon,
		street: cache.street,
		city: cache.city,
		ownerid: this.userId,
		eventid: this.topId
	    
	    });
	    var viewData = [];
	    for( i in this.models )
		viewData.push( this.models[i].toJSON() );
	    eventTableView.render( viewData );
	    eventAddView.hideModal();
	};

	eventCollection.onDataLoaded = function(){
	    console.log("Data load success");

	    var viewData = [];
	    var max = 0;
	    if( this.models.length > 0 )
		this.userId = this.models[0].get('ownerid');
	    for( i in this.models ){
		viewData.push( this.models[i].toJSON() );
		var eId = this.models[i].get('eventid');
			if( eId > max)
		   max = eId;
	    }
	    this.topId = max;
	   console.log("Owner id ", this.userId," top id", this.topId );
	   eventTableView.render( viewData );
	};
	eventCollection.onDataError = function(){
	    console.log("Data load error" );
	};
	eventCollection.validationFailure = function( err ){
	    console.log("Form validation error: ", err );
	    eventAddView.modalError( err );
	}
    
       eventCollection.getUserData();
	//Initialize MVC
   },
});

function startApp(){
    app.application({
	name:"WhatsUpAdmin",
	views: ['EventTable','EventAdd'],
	collections : ['EventCollection'],
	routers: ['AdminRouter']
    });

}










