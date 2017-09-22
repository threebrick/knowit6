var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({

    appId: '4e6c8ad5-aa9c-4dee-a2eb-7d97098d72d3',
    appPassword: 'bRUtrd6PqDmDi5Up7Es8Ew1'

    //appId: process.env.MICROSOFT_APP_ID,
    //appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
//server.post('/api/messages', connector.listen());
server.post('https://knowit6.azurewebsites.net/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("You said: %s", session.message.text);
});


server.get('/', restify.serveStatic({
 directory: __dirname,
 default: '/index.html'
}));