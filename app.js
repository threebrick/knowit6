var restify = require('restify');
var builder = require('botbuilder');
var cognitiveservices = require('botbuilder-cognitiveservices');

//=========================================================
// IBM Discovery Setup
//=========================================================

const watson = require('watson-developer-cloud'); // watson sdk
const WatsonDiscoverySetup = require('./lib/watson-discovery-setup');
var striptags = require('striptags');

const DEFAULT_NAME = 'watson-botframework-chatbot';

require('dotenv').config({
    silent: true
});

var contexts;
var workspace = process.env.WORKSPACE_ID;


//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    //appId: process.env.MICROSOFT_APP_ID,
    //appPassword: process.env.MICROSOFT_APP_PASSWORD
    //appId: '4e6c8ad5-aa9c-4dee-a2eb-7d97098d72d3',
    //appPassword: 'bRUtrd6PqDmDi5Up7Es8Ew1'
    appId: '5778e28e-35e4-4cae-80eb-66d797996152',
    appPassword: '6zh4NJX7zO5iFEuRdKJpXzq'
});
var bot = new builder.UniversalBot(connector);
/*var bot = new builder.UniversalBot(connector, function(session) {

    

    var payload = {
        workspace_id: workspace,
        environment_id: '4a802760-30f9-4126-b6a2-b2e70ffd689f',
        collection_id: '789cba1a-7883-4afc-88c3-3d6aefd2096d',
        context: [],
        queryParams: {
          natural_language_query: session.message.text,
          passages: true
        }
        //query: {
        //    text: session.message.text
        //}
    };
});*/
bot.set('storage', new builder.MemoryBotStorage());         // Register in-memory state storage
//server.post('/api/messages', connector.listen());
server.post('https://eyreserve.azurewebsites.net/api/messages', connector.listen());

//=========================================================
// Recognizers
//=========================================================

var qnarecognizer = new cognitiveservices.QnAMakerRecognizer({
    //knowledgeBaseId: 'set your kbid here',
    //subscriptionKey: 'set your subscription key here',
    knowledgeBaseId: '9aaee0d2-b646-4429-8077-4ba2ef749f32', 
	subscriptionKey: '8c803a75c188429d95d7b6d4dc2d5d12',
    top: 4});

var model='https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/6af4a628-49af-4188-a70c-6a95982c730e?subscription-key=8a605684fc204a3ea3c6f29e2a390002&verbose=true&timezoneOffset=-300';
var recognizer = new builder.LuisRecognizer(model);

//=========================================================
// Discovery Setup
//=========================================================

const DISCOVERY_DOCS = [
  './data/discovery/docs/BankFaqRnR-DB-Failure-General.docx',
  './data/discovery/docs/BankFaqRnR-DB-Terms-General.docx',
  './data/discovery/docs/BankFaqRnR-e2eAO-Terms.docx',
  './data/discovery/docs/BankFaqRnR-e2ePL-Terms.docx',
  './data/discovery/docs/BankRnR-OMP-General.docx'
];

const discovery = watson.discovery({
  password: process.env.DISCOVERY_PASSWORD,
  username: process.env.DISCOVERY_USERNAME,
  version_date: '2017-10-16',
  version: 'v1'
});
let discoveryParams; // discoveryParams will be set after Discovery is validated and setup.
const discoverySetup = new WatsonDiscoverySetup(discovery);
const discoverySetupParams = { default_name: DEFAULT_NAME, documents: DISCOVERY_DOCS };
discoverySetup.setupDiscovery(discoverySetupParams, (err, data) => {
  if (err) {
    handleSetupError(err);
  } else {
    console.log('Discovery is ready!');
    discoveryParams = data;
  }
});

//=========================================================
// Bot Dialogs
//=========================================================
//var intents = new builder.IntentDialog({ recognizers: [recognizer, qnarecognizer] });
var dialog = new builder.IntentDialog({ recognizers: [recognizer, qnarecognizer] });
bot.dialog('/', dialog);
dialog.onBegin(function (session, args, next) {
    session.send("Hi... I'm the Knowledge Help Bot. I can help you find FAQs online and in your documents.  Please ask your question.");

});
    


dialog.matches('Documents', [
    function (session, args, next) {
        //session.send('Welcome to the Document Questions! We are analyzing your message: \'%s\'', session.message.text);
        var payload = {
        workspace_id: workspace,
        environment_id: '4a802760-30f9-4126-b6a2-b2e70ffd689f',
        collection_id: '789cba1a-7883-4afc-88c3-3d6aefd2096d',
        context: [],
        queryParams: {
          natural_language_query: session.message.text,
          passages: true
        }
        
        };
        //session.send(session.message.text);
        console.log('************** Discovery *************** InputText : ' + session.message.text);
        let discoveryResponse = '';
      if (!discoveryParams) {
        console.log('Discovery is not ready for query.');
        discoveryResponse = 'Sorry, currently I do not have a response. Discovery initialization is in progress. Please try again later.';
        if (data.output.text) {
          data.output.text.push(discoveryResponse);
        }
        // Clear the context's action since the lookup and append was attempted.
        data.context.action = {};
        callback(null, data);
        // Clear the context's action since the lookup was attempted.
        payload.context.action = {};
      } else {
        const queryParams = {
          natural_language_query: session.message.text,
          passages: true
        };
    Object.assign(queryParams, discoveryParams);
        discovery.query(queryParams, (err, searchResponse) => {
          discoveryResponse = 'Sorry, currently I do not have a response. Our Customer representative will get in touch with you shortly.';
          if (err) {
            console.error('Error searching for documents: ' + err);
          } else if (searchResponse.passages.length > 0) {
            const bestPassage = searchResponse.passages[0];
            console.log('Passage score: ', bestPassage.passage_score);
            console.log('Passage text: ', bestPassage.passage_text);

            var html = bestPassage.passage_text;
            striptags(html, [], '\n');

            //session.send(bestPassage.passage_text);
            //session.send(striptags(html, [], '\n'));

            // Trim the passage to try to get just the answer part of it.
            const lines = bestPassage.passage_text.split('\n');
            session.send(lines);
            let bestLine;
            let questionFound = false;
            for (let i = 0, size = lines.length; i < size; i++) {
              const line = lines[i].trim();
              if (!line) {
                continue; // skip empty/blank lines
              }
              if (line.includes('?') || line.includes('<h1')) {
                // To get the answer we needed to know the Q/A format of the doc.
                // Skip questions which either have a '?' or are a header '<h1'...
                questionFound = true;
                continue;
              }
              bestLine = line; // Best so far, but can be tail of earlier answer.
              if (questionFound && bestLine) {
                // We found the first non-blank answer after the end of a question. Use it.
                break;
              }
            }
            discoveryResponse =
              bestLine || 'Sorry I currently do not have an appropriate response for your query. Our customer care executive will call you in 24 hours.';
          }

         // if (data.output.text) {
         //   data.output.text.push(discoveryResponse);
         // }
          // Clear the context's action since the lookup and append was completed.
          
       });
      }

    }
]);

//intents.matches('luisIntent2', builder.DialogAction.send('Inside LUIS Intent 2.'));

dialog.matches('qna', [
    function (session, args, next) {
        var answerEntity = builder.EntityRecognizer.findEntity(args.entities, 'answer');
        session.send(answerEntity.entity);
    }
]);

/*dialog.onDefault([
    function(session){
        session.send('Sorry!! No match!!');
    }
]);*/