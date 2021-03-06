const fs = require('fs');
const ini = require('ini');
const mfp = require('mfp');
const config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
const requestService = require('request');
var previousMfpCarbs = 0;
console.log("Myfitnesspal nightscout booting up.");

function getMFPCarbs(){

	var currentTime = new Date();
	//AHHHHHHHHHHHHHHHHHHHHH I HATE TIMEZONES. WHY MUST THEY EXIST AND TORMENT ME LIKE THIS?
	var utcDate = new Date(currentTime.getTime() + currentTime.getTimezoneOffset()*60000);
	currentTime = new Date(utcDate.getTime() + config.UTCOffset*60*60000);
	var currentDate = currentTime.getFullYear() + '-' + (((currentTime.getMonth() + 1) < 10) ? '0' : '') + (currentTime.getMonth() + 1) + '-' + ((currentTime.getDate() < 10) ? '0' : '') + currentTime.getDate();
	var currentDateUTC = utcDate.getFullYear() + '-' + (((utcDate.getMonth() + 1) < 10) ? '0' : '') + (utcDate.getMonth() + 1) + '-' + ((utcDate.getDate() < 10) ? '0' : '') + utcDate.getDate();
	//console.log(currentDate)
	//console.log(currentDateUTC)
	//use utc for nightscout site sorting
	if(config.API_SECRET == "nightscoutApiSecretHere" || config.nightscoutSite == "https://siteName.herokuapp.com" || config.myfitnesspalUsername == "usernameHere"){
		console.log("The config file still has default values that need to be changed.");
	}else{
		mfp.fetchSingleDate(config.myfitnesspalUsername,currentDate,"all",function(data){
			//console.log(data);
			var mfpCarbs = data["carbs"];
			if(!mfpCarbs){mfpCarbs=0};
			//console.log(mfpCarbs);
			//now get mfp carbs in nightscout to see if we need to add some more.
			if(previousMfpCarbs == mfpCarbs){
				//do nothing. they're the same amount since last time.
				//console.log("No new mfp entries. Carbs are still "+mfpCarbs);
			}else{
				//new value! set the value and do comparison
				previousMfpCarbs = mfpCarbs;	
				mfpCarbsInNightscout(currentDateUTC,currentDate,function(currentCarbsInNS){
					//console.log(currentCarbsInNS);
					if(currentCarbsInNS != null){
						console.log(mfpCarbs+" carbs entered in myfitnesspal and "+currentCarbsInNS+" grams of carbs entered in nightscout through mfp");
						if(Number(currentCarbsInNS) < mfpCarbs){
							console.log("We need to add an entry for myfitnesspal!");
							var neededAmount = mfpCarbs-currentCarbsInNS
							//basic safety check (improve)
							if(neededAmount > 0.1 && neededAmount < 500){
								console.log("entering "+neededAmount+" carbs");
								nightscoutPostCarbs(currentDate,neededAmount);
							}
						}else{
							console.log("we have plenty of insulin.");
						}
					}
				});
			}
		})
	}
}

function mfpCarbsInNightscout(currentDateUTC,currentDate,callbackFunction){
	requestService(config.nightscoutSite+'/api/v1/treatments?find[enteredBy]=MyfitnessPal&find[created_at][$gte]='+currentDateUTC, function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	   	  var bodyParsed = JSON.parse(body);
	   	  //loop through every entry
	   	  var totalCarbsDosedFor = 0;
	   	  for(var i = 0; i<bodyParsed.length;i++){
	   	  	var currentEntry = bodyParsed[i];
	   	  	if(currentEntry["carbs"]){
	   	  		if(currentEntry["reason"] == currentDate){
		   	  		//console.log(currentEntry["carbs"]);
		   	  		totalCarbsDosedFor = totalCarbsDosedFor+currentEntry["carbs"];
	   	  		}
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

function nightscoutPostCarbs(currentDate,carbAmount){
    var nightscoutOptions = {
    url: config.nightscoutSite+'/api/v1/treatments.json',
    json:true,
    body: {
      "enteredBy": "MyfitnessPal", 
      "reason": currentDate, 
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

setInterval(function(){
    getMFPCarbs()}, 5000);