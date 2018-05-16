var request = require('request'); // for fetching the feed 
var restify = require('restify');
var builder = require('botbuilder');
var parser = require('rss-parser');
var rss_data = [];
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
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
//=========================================================
// FEED - Fetch and Parse
//=========================================================
var request = require('request'); // for fetching the feed 
var fetch = {
    delay_timer:null,
     request: function(feed,session,args){
        var self = this;
        var delay_msg;
        this.delay_timer = setTimeout(function(){
            delay_msg= new builder.Message(session)
                .text("Collecting results. Please wait.");
            bot.send(delay_msg);
        },500);


        parser.parseURL(feed, function(err, parsed) {
            //console.log(parsed.feed);
            // parsed.feed.entries.forEach(function(entry) {
            //     console.log(entry.title + ':' + entry.link);
            // })
            if(err){
                clearTimeout(this.delay_timer);
                self.error(session,err);
            } else{
                args.news.data = parsed.feed;
                self.done(session,args);
            }
        });
     },
     error: function(session,err){
        console.log(err);
        session.send("Errors");
     },
     done: function(session,args){
        clearTimeout(this.delay_timer);
        console.log('------------------------------');
        args.callback(session,args);
     }
}
//=========================================================
// Search
//=========================================================

//=========================================================
// Bots Dialogs
//=========================================================
var article_dialog = {
    simple: function(session, args){
        return "["+args.title+"]("+args.link+")";
    },
    card: function(session, args){
        var card = new builder.HeroCard(session,args)
            .title(args.title)
            .subtitle(args.pubDate)
            .text(args.content)
            .buttons([
                builder.CardAction.openUrl(session, args.link, 'Read Article')
            ]);
        return new builder.Message(session).addAttachment(card);
    },
    carousel: function(session,args){

    },
    output: function(session,args){
        var output;
        if(args.news.type == 'card'){ //CARDS
            for(var i=0;i<args.news.count; i++){
                output = article_dialog.card(session,args.news.data.entries[i]);
                session.send(output);
            }
        }else{ //DEFAULT TO SIMPLE
            output = "Articles about: "+args.news.term;
            for(var i=0;i<args.news.count; i++){
                output = output +'\n\n * '+ article_dialog.simple(session,args.news.data.entries[i]);
            }
            session.send(output);
        }

     }
}

//=========================================================
// Bot Intents
//=========================================================
var intents = new builder.IntentDialog();
bot.dialog('/', intents);

intents.onDefault(function(session){
    session.send('Sorry, I did not understand \'%s\'. Type \'help\' if you need assistance.', session.message.text);
});


//QUICK
intents.matches(/^hi/i, function (session) {

    session.send("hi\n\n[dude](http://microsoft.com)");

});
//HELP
intents.matches(/^help/i, function (session) {
    var msg = new builder.Message(session)
        .TextFormat(builder.TextFormat.markdown)
        .attachments([
            new builder.HeroCard(session)
                .title("How to use News Bot")
                .text('* Search * Recent * Some other <a href="">option</a>[test](http://microsoft.com)',{TextFormat:markdown})
                .buttons([
                    builder.CardAction.openUrl(session, "http://botframework.com", 'Additional help documents')
                ])
                .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
        ]);
    session.endDialog(msg);

});
//RECENT 
intents.matches(/^recent/i, function (session,args) {
    fetch.request('http://www.npr.org/rss/rss.php?id=1001',session,args);
});

//SEARCH 
intents.matches(/^search/i, function (session, args) {
    args.news ={
        type: "card",
        count: 3
    }
    args.callback = function(session,args){
        article_dialog.output(session,args);
    }
    fetch.request('http://www.npr.org/rss/rss.php?id=1001',session,args);
});