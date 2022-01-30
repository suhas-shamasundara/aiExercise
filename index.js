import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const SPACE = " ";
const PUNCTUATIONS = /[\.,;:'"<>?\/~`!@#$%\^&*()\-_=+{}|\\\[\]]/g;
const DIGITS = /\d/g;
const NEW_LINE = /\n/g;
const TAB = /\t/g;
const CARRIAGE_RETURN = /\r/g;
const MULTI_SPACE = /\s+/g;

async function init(){
	let count = 10;
	let finalObject = {};

	if(process.argv.length > 2 && typeof parseInt(process.argv[2]) == 'number'){
		count = process.argv[2];
	}

	if(count > 0){
		let story = await fetchStory();
		if(story != false){
			let mostUsedWords = sortMostUsedWords(story, count);
			console.log(`============================== Top ${count} Words ==============================`);
			console.table(mostUsedWords);

			let parsedData = await fetchDetailsFromDictionary(mostUsedWords);
			if(parsedData != false){
				finalObject = formatData(parsedData);
				if(finalObject != false){
					for(let word in finalObject){
						finalObject[word].count = mostUsedWords[word];
					}
					console.log('============================== Merge complete ==============================');
					console.log(finalObject);
				}
			}
		}
	} else {
		console.log('============================== Invalid number_of_words value ==============================');
	}
}

// Fetch the content from the provided URL
// Remove punctuations and special characters
// This makes counting words easier - based on spaces.

async function fetchStory(){
	console.log('============================== Fetching story ==============================');
	let story;
	try {
		let storyURL = "http://norvig.com/big.txt";
		story = await fetch(storyURL);
		if(!story.ok){
			throw new Error(story.status);
		}
		story = await story.text();
		story = story.replace(PUNCTUATIONS,SPACE).replace(DIGITS,SPACE).
					replace(NEW_LINE,SPACE).replace(TAB,SPACE).replace(CARRIAGE_RETURN,SPACE)
					.replace(MULTI_SPACE,SPACE);
	} catch(error){
		console.log("Error while fetching story", error);
		story = false;
	}

	return story;
}

// Count the words based on space between them
// Sort them in the decending order.

function sortMostUsedWords(story, count=10){
	console.log('============================== Counting and Sorting Words ==============================');
	let splitStory = story.split(SPACE);
	let wordCount = {};
	splitStory.forEach(word => {
		if(wordCount[word]){
			wordCount[word] += 1;
		} else {
			wordCount[word] = 1;
		}
		
	})

	let sortedWords = Object.entries(wordCount).sort((first, second) => {
		return second[1] - first[1];
	})

	let mostUsedWords = {};
	sortedWords.slice(0,count).forEach(wordEntry => {
		mostUsedWords[wordEntry[0]] = wordEntry[1];
	});
	return mostUsedWords;
}

// Fetch the details for each words from the API provided.
// Show error if there is a failure, else return JSON data

async function fetchDetailsFromDictionary(mostUsedWords){
	console.log('============================== Fetching from dictionary ==============================');
	// console.log(process.env.AI_EXCERCISE_KEY);
	let url = "https://dictionary.yandex.net/api/v1/dicservice.json/lookup";
	let jsonData;

	let rawDataPromise = await Promise.all(Object.keys(mostUsedWords).map(word => fetch(`${url}`,{
		method:"POST",
		headers:{
			"Content-Type": 'application/x-www-form-urlencoded'
		},
		body:`key=${process.env.AI_EXCERCISE_KEY}&lang=en-en&text=${word}`
	})))
	.then(promiseArray => {
		let failedRequest = promiseArray.find(request=>!request.ok)
		if(failedRequest){
			throw new Error(failedRequest.status);
		} else {
			return promiseArray.map(rawData => rawData.json());
		}
	})
	.catch(error => {
		console.log("Error while fetching from Dictionary", error);
		return false;
	})

	if(rawDataPromise){
		jsonData = await Promise.all(rawDataPromise)
		.then(data => {
			return data;
		})
		.catch(error => {
			console.log("Error in parsing the Dictionary data", error);
			return false;
		})
	} else {
		jsonData = false;
	}
	return jsonData;
}

// Parse the JSON data to extract only synonyms
// Convert the array in to comma separated value string

function formatData(parsedData){
	console.log('============================== Parsing Dictionary data ==============================');
	let formattedData = {};
	parsedData.forEach(data => {
		if(data.def && data.def.length > 0){
			formattedData[data.def[0].text] = {
				pos : data.def[0].pos
			}
			let synString = "";
			if(data.def[0].tr && data.def[0].tr.length > 0){
				let synArray = []
				data.def[0].tr.forEach(item => {
					if(item.syn && item.syn.length > 0){
						synArray = [...synArray, ...item.syn];
					}
				})
				synString = synArray.reduce((synonyms, syn) => {
					return `${syn.text}, ${synonyms}`;
				}, "");
			}
			formattedData[data.def[0].text]["synonyms"] = synString.substring(0, synString.length-2);
		}
	})
	return formattedData;
}

init();