

/**
 * Returns the Auth Type of this connector.
 * @return {object} The Auth type.
 */
function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector(); 
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.NONE)
    .build();
}



/*
* This function generates the visual elements seen on the config screen.
* It also sets the date range to required. This ensures that Google Data Studio will always send the date range of a given widget
* in the request JSON.
*/
function getConfig(request) {
  
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();
       
  
  config.setDateRangeRequired(true);
  
  return config.build();

}



/* IMPORTANT: DO NOT CHANGE METRIC ID. ID matches IGDB API metric name and is used to progrommatically call
* IGDB metrics based on Google data studio's requested metrics.
*/
function getFields(request) { 
  
  
  //setting variables as shortcuts for later use
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;
  
  
  
  fields.newDimension()
    .setId('first_release_date')
    .setName('Release Date')
    .setType(types.NUMBER)
    .setDescription("The original release of the game");
  
  fields.newDimension()
    .setId('name')
    .setName('Name')
    .setType(types.TEXT)
    .setDescription("The game's name");
  
  fields.newDimension()
    .setId('url')
    .setName('URL')
    .setType(types.URL)
    .setDescription("The image of the cover's url");
  
  fields.newDimension()
    .setId('cover')
    .setName('Cover')
    .setType(types.IMAGE)
    .setFormula('IMAGE($url,"cannot display")')
    .setDescription("The game's cover image");
  
  fields.newDimension()
    .setId('summary')
    .setName('Summary')
    .setType(types.TEXT)
    .setDescription("A summary for the game");
  
  fields.newMetric()
    .setId('rating')
    .setName('Rating')
    .setType(types.NUMBER)
    .setDescription("Rating of game")
    .setAggregation(aggregations.AVG);
  
  fields.newMetric()
    .setId('rating_count')
    .setName('Number of Reviews')
    .setType(types.NUMBER)
    .setDescription("The amount of time it takes to play through the game")
    .setAggregation(aggregations.SUM);
  
  fields.newMetric()
    .setId('popularity')
    .setName('Popularity')
    .setType(types.NUMBER)
    .setDescription("Popularity of a game")
    .setAggregation(aggregations.AVG);

  
  
  
  console.log(JSON.stringify(fields));
  
  
  return fields;
}


//calls getFields method and returns the fields for the schema
//called after authorization and config methods
function getSchema(request) {
  
  
  
  
  var fields = getFields(request).build();
  console.log(JSON.stringify(fields));
  console.log(fields.toString());
  //resetAuth();
  return { schema: fields };
  
}





/*function trial(){
  
  var url = "https://api-v3.igdb.com/games";
  
  var responseString = UrlFetchApp.fetch(url, {
      headers: {
        'user-key': '6f0f63ec2a0fff5341e28189a9530efc',
        'Accept': 'application/json'
      }, method: 'post',
    payload: 'fields name,parent_game,rating,first_release_date; sort rating desc; where first_release_date > 1573010079 & rating > 0;',
    muteHttpExceptions : true 
    });
  
  console.log(responseString);
  
}*/


//converts date from standard from to unix time
function convertDate(x){
   return Math.floor(new Date(x).getTime() / 1000);
}
 

/*
* This function is called by the fetchDataFromApi function.
* It returns a JSON string that contains all data requested including fields that are not part of the games endpoint.
*/
function addOtherFields(responseString, otherEndpointFields, requestedFields){
  var response = JSON.parse(responseString);
  var finalResponse = [];
  console.log("**" + JSON.stringify(requestedFields));
  
  for(var i = 0; i < response.length; i++){
    
       var url = "https://api-v3.igdb.com/covers";
       var row = {};
       
    
       var newResponseString = UrlFetchApp.fetch(url, {
         headers: {
           'user-key': '6f0f63ec2a0fff5341e28189a9530efc',
           'Accept': 'application/json'
         }, method: 'post',
         payload: 'fields url; where game = ' + response[i].id + ';',
         muteHttpExceptions : true 
       });
    
       //console.log("newResponseString[" + i + "]: " + newResponseString);
       response[i].url = "https:" + JSON.parse(newResponseString)[0].url;
    
       for(var m = 0; m < requestedFields.length; m++){
           row[requestedFields[m].name] = response[i][requestedFields[m].name];
       }
       
       finalResponse.push(row);
    
  }
  
  return JSON.stringify(finalResponse);
     
     
}




/**
 * Queries the IGDB API based on what fields are requested by google data studio along with the dates given
 * Returns a JSON response that is obtained from the API. 
 */
function fetchDataFromApi(request, requestedFields) {
  console.log("In fetch data method");
  
  var otherEndpointFields = [];
  var gamesFields = requestedFields;
  var nonGameFieldsRequested = false;
  
  //remove fields not inside the games endpoint from requested Fields and add them to the other list
  for(var i = 0; i < gamesFields.length; i++){
        if(gamesFields[i] == "url"){
             nonGameFieldsRequested = true;
             otherEndpointFields.push(gamesFields[i]);
             gamesFields.splice(i,1);
        }
  }
  
  console.log("otherEndpointFields: " + JSON.stringify(otherEndpointFields));
  
  //modify the data from the request to put it in an acceptable form for IGDB API
  var fields = "";
  for(var i = 0; i < gamesFields.length; i++){
    if(i + 1 != gamesFields.length){
       fields += gamesFields[i] + ",";
    }
    else{
      fields += gamesFields[i];
    }
  }
  
  console.log("fields: " + fields);
  
  var beginningTime = convertDate(request.dateRange.startDate);
  console.log("beginningTime: " + beginningTime);
  var endingTime = convertDate(request.dateRange.endDate);
  console.log("endingTime: " + endingTime);
  
  
  var load = "fields " + fields + "; sort popularity desc; where rating > 0 & first_release_date > " + beginningTime + " & first_release_date < ";
  
  load +=   endingTime + ";" + "limit 20;";
  
  console.log("payload: " + load);
  
  
  var url = "https://api-v3.igdb.com/games";
  
  //make HTTP query
  var responseString = UrlFetchApp.fetch(url, {
      headers: {
        'user-key': '6f0f63ec2a0fff5341e28189a9530efc',
        'Accept': 'application/json'
      }, method: 'post',
    payload: load,
    muteHttpExceptions : true 
    });
  
  //adds in metrics from other endpoints if any are requested
  if(nonGameFieldsRequested){
      responseString = addOtherFields(responseString, otherEndpointFields, request.fields);
  }
  
  console.log(responseString);
  return JSON.parse(responseString);
  
}


/*
* Takes in a JSON API response and creates the data portion of the final response to Google Data Studio
*/
function reformatData(response,request, requestedFields) {
  console.log("In reformat data method");
  
  //do not parse
  var formattedData = [];
  
  for(var i = 0; i < response.length; i++){
    var row = {'values': []};
       for(var m = 0; m < requestedFields.length; m++){
            var field = requestedFields[m];
            row.values.push(response[i][field]);
       }
    formattedData.push(row);
  }
  
  console.log("formattedData: " + JSON.stringify(formattedData));
  
  
  
  return formattedData;
}
  
 
    
  




/**
 * Adds the schema portion of the final response JSON and returns the final response that will be returned to Google Data Studio
 */
function getFormattedData(formattedData, requestedFields) {
  console.log("In format method");
  var finalResponse = {"schema": []};
   
  for(var m = 0; m < requestedFields.length; m++){

      var field = requestedFields[m];
      
    
          if(field == "first_release_date"){
            finalResponse.schema.push({"name": "first_release_date" , "dataType" :"NUMBER"});
          }
          if(field == "rating"){
            finalResponse.schema.push({"name" : "rating" , "dataType" : "NUMBER"});
          } 
          if(field == "name"){
            finalResponse.schema.push({"name": "name" , "dataType" :"STRING"});
          }
          if(field == "popularity"){
            finalResponse.schema.push({"name" : "popularity" , "dataType" : "NUMBER"});
          }
          if(field == "summary"){
            finalResponse.schema.push({"name": "summary" , "dataType" :"STRING"});
          }
          if(field == "url"){
            finalResponse.schema.push({"name": "url" , "dataType" :"STRING"});
          }
          if(field == "rating_count"){
            finalResponse.schema.push({"name" : "rating_count" , "dataType" : "NUMBER"});
          }
    
       
          
    }
   
  
  
  //add data to response in proper format
  finalResponse.rows = formattedData; 
  
  console.log(JSON.stringify(finalResponse));
  return finalResponse;
}



/*
* Method Called by Google Data Studio. Takes a request for data and returns a response to that request.
*/
function getData(request) {
  //resetAuth();
  var cc = DataStudioApp.createCommunityConnector();
  console.log(JSON.stringify(request));
  var requestedFields = [];
  var backupRequestedFields = [];
  
  for(var i = 0; i < request.fields.length; i++){
     requestedFields.push(request.fields[i].name);
     backupRequestedFields.push(request.fields[i].name);
  }
  
  console.log(JSON.stringify(requestedFields));

  try {
    
    var apiResponse = fetchDataFromApi(request, requestedFields);
    var combinedData = reformatData(apiResponse, request, backupRequestedFields);
    var data = getFormattedData(combinedData, backupRequestedFields);
    
  } catch (e) {
    
    console.log("Error" + e);
    cc.newUserError()
      .setDebugText("Error fetching data from API. Exception details: " + e)
      .setText(
        "The connector has encountered an unrecoverable error. Please try again later."
      )
      .throwException();
    
  }
  
  
  console.log("data: " + JSON.stringify(data))
  return data;
}

//Gives user access to debug statements
//Always keep active for testing. Otherwise comment out
/*function isAdminUser(){
  return true;
}*/



