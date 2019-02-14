const fs = require('fs');
const ini = require('ini');
const mfp = require('mfp');
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const requestService = require('request');

var currentTime = new Date();
var currentDate = currentTime.getFullYear() + '-' + (((currentTime.getMonth() + 1) < 10) ? '0' : '') + (currentTime.getMonth() + 1) + '-' + ((currentTime.getDate() < 10) ? '0' : '') + currentTime.getDate();
var currentDateUTC = currentTime.getUTCFullYear() + '-' + (((currentTime.getUTCMonth() + 1) < 10) ? '0' : '') + (currentTime.getUTCMonth() + 1) + '-' + ((currentTime.getUTCDate() < 10) ? '0' : '') + currentTime.getUTCDate();
var previousMfpCarbs = 0;
//use utc for nightscout site sorting
//console.log(config.privateKey)
//console.log(currentDate);
//console.log(currentDateUTC);
console.log("Myfitnesspal nightscout booting up.");
function getMFPCarbs(){
	mfp.fetchSingleDate("legoandmars",currentDate,"all",function(data){
		//console.log(data);
		var mfpCarbs = data["carbs"];
		if(!mfpCarbs){mfpCarbs=0};
		//console.log(mfpCarbs);
		//now get mfp carbs in nightscout to see if we need to add some more.
		if(previousMfpCarbs == mfpCarbs){
			//do nothing. they're the same amount since last time.
			console.log("No new mfp entries. Carbs are still "+mfpCarbs);
		}else{
			//new value! set the value and do comparison
			previousMfpCarbs = mfpCarbs;	
			mfpCarbsInNightscout(function(currentCarbsInNS){
				//console.log(currentCarbsInNS);
				if(currentCarbsInNS != null){
					console.log(mfpCarbs+" carbs entered in myfitnesspal and "+currentCarbsInNS+" grams of carbs entered in nightscout through mfp");
					if(Number(currentCarbsInNS) < mfpCarbs){
						console.log("We need to add an entry for myfitnesspal!");
						var neededAmount = mfpCarbs-currentCarbsInNS
						//basic safety check (improve)
						if(neededAmount > 0.1 && neededAmount < 500){
							console.log("entering "+neededAmount+" carbs");
							nightscoutPostCarbs(neededAmount);
						}
					}else{
						console.log("we have plenty of insulin.");
					}
				}
			});
		}
	})
}

function mfpCarbsInNightscout(callbackFunction){
	requestService(config.nightscoutSite+'/api/v1/treatments?find[enteredBy]=MyfitnessPal&find[created_at][$gte]='+currentDateUTC, function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	   	  var bodyParsed = JSON.parse(body);
	   	  //loop through every entry
	   	  var totalCarbsDosedFor = 0;
	   	  for(var i = 0; i<bodyParsed.length;i++){
	   	  	var currentEntry = bodyParsed[i];
	   	  	if(currentEntry["carbs"]){
	   	  		//console.log(currentEntry["carbs"]);
	   	  		totalCarbsDosedFor = totalCarbsDosedFor+currentEntry["carbs"];
	   	  	}
	   	  }
	   	  //console.log(totalCarbsDosedFor);
	   	  if(callbackFunction){
			callbackFunction(totalCarbsDosedFor);
	   	  }
	    }else{
	      console.log(error);
	      console.log(response.statusCode);
	   	  if(callbackFunction){
			callbackFunction(null);
	   	  }
	    }
	});
}

function nightscoutPostCarbs(carbAmount){
    var nightscoutOptions = {
    url: config.nightscoutSite+'/api/v1/treatments.json',
    json:true,
    body: {
      "enteredBy": "MyfitnessPal", 
      "reason": "i am testing web dev stuff. ignore.", 
      "carbs": carbAmount, 
      "secret": config.API_SECRET}
    };
  requestService.post(nightscoutOptions, function(error, response, body){
    if (!error && response.statusCode == 200) {
      console.log("POSTED!");
    }else{
      console.log(error);
      console.log(response.statusCode);
    }
  });
}

//nightscoutPostCarbs(0.001);
/*mfpCarbsInNightscout(function(totalCarbsInBS){
	console.log(totalCarbsInBS);
})*/

setInterval(function(){
    getMFPCarbs()}, 5000);