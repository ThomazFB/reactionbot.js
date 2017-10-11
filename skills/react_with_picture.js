//TODO: Use debug() statements

module.exports = function(controller) {

    // To allow for easy manipulation of trigger words, we then get only the keys
    // and put it into an array
    var keywords = [];

    // Listen for a keyword and post a reaction image if you hear it
    controller.hears(keywords, 'ambient', function(bot, message) {
        console.log(bot)
        console.log("@@@@@@@@@@@@@@@@@@@@@")
        console.log(message)
        console.log("@@@@@@@@@@@@@@@@@@@@@")
        console.log(keywords)

        controller.storage.teams.get(message.team, (err, team_data) => {
            if(!err && team_data && team_data.triggers[message.match[0]]){
                console.log(team_data.triggers[message.match[0]])

                bot.reply(message, {
                    'username': 'ReactionBot',
                    'text': '',
                    'attachments': [
                        {
                            'text': '',
                            'image_url': team_data.triggers[message.match[0]]
                        }
                    ]
                });
            } else {
                console.log('Detected word, but could not get reaction from database or reaction belongs to different team');
                console.log(err);
            }
        });
    });


    //TODO: Create different handlers for each team instead of handling all of them in these handlers here

    // Load keywords with team-scope triggers from storage
    controller.storage.teams.all((err, all_team_data) => {
        if(!err){
            all_team_data.forEach((team_data) => {
                if(team_data.triggers){
                    let team_triggers = Object.keys(team_data.triggers);
                    team_triggers.forEach((trigger) => {
                        // I'm directly mutating keywords cause Javascript is pass by a COPY of a reference
                        keywords.push(trigger); 
                    });
                } else {
                    console.log('Could not find triggers for team with id: ' + team_data.id);
                }
            });
        } else{
            console.log(err);
        }

        // Log final state of keywords
        // console.log(keywords);
    });

    //Add a reaction to reactionbot 
    controller.hears('^add (.*) (.*)', 'direct_message,direct_mention', function(bot, message) {
        let trigger = message.match[1];
        let reaction = message.match[2];

        reaction = extract_url(reaction); 

        //TODO: Right now I'm making the assumption that reaction is an image.

        if (trigger && reaction){
            bot.reply(message, "Sure, I'll react to  \"" + trigger + "\" with \"" + reaction + "\" now :grinning:"); 

            controller.storage.teams.get(message.team, function(err, team_data){
                if(!err){
                    team_data.triggers = team_data.triggers || {}; //Create a new triggers obj if it doesnt exist
                    team_data.triggers[trigger] = reaction;
                   
                    // Save new team_data in database
                    controller.storage.teams.save(team_data, function(err){
                        console.log(err);
                    });

                    //Add trigger to trigger list now that reaction is in db
                    keywords.push(trigger);

                } else if (err.displayName === 'NotFound') { // If team does not exist in db, create a new team entry!
                    // Save new team_data in database
                    controller.storage.teams.save({
                        id: message.team,
                        triggers: {
                            [trigger]: reaction
                        }
                    }, (err) => {
                        console.log(err);
                    });

                    //Add trigger to trigger list now that reaction is in db
                    keywords.push(trigger);
                } else {
                    console.log(err);
                }
            });
        } else {
            bot.reply(message, "I didn't understand you sorry :disappointed:. I need a WORD to react to and a REACTION to react with");
        }
    });
    
    // Remove command
    controller.hears('^remove (.*)', 'direct_message,direct_mention', function(bot, message) {
        if (trigger = message.match[1]){
            
            // Remove from db (actually just another add that overwrites)
            controller.storage.teams.get(message.team, function(err, team_data){
                if(!err){
                    if (team_data.triggers && delete team_data.triggers[trigger]){
                        // Save changed team_data in database
                        controller.storage.teams.save(team_data, function(err){
                            console.log(err);
                        });
                        bot.reply(message, "I removed the reaction for " + trigger + "!");
                    } else {
                        bot.reply(message, "I don't think that reaction exists!");
                    }
                } else {
                    console.log(err); 
                }
            });

            // Remove from keyword List (Just removes one instance from the keyword list)
            let index = keywords.indexOf(trigger);
            keywords.splice(index, 1);

        } else {
            bot.reply(message, "I don't think you gave me a WORD to remove. Please try again.");
        }
    });

    //Get command
    controller.hears('^get (.*)', 'direct_message,direct_mention', function(bot, message){
        if (trigger = message.match[1]){
            controller.storage.teams.get(message.team, (err, team_data) => {
                if(!err && team_data.triggers && team_data.triggers[trigger]){
                    bot.reply(message, {
                        'username': 'ReactionBot',
                        'text': '',
                        'attachments': [
                            {
                                'text': '',
                                'image_url': team_data.triggers[trigger]
                            }
                        ]
                    });
                } else {
                    bot.reply("I don't think that reaction exists!");
                    console.log(err);
                }
            });
        } else{
            bot.reply(message, "I don't think you gave me a reaction to try to get!");
        }
    });

    // List command
    controller.hears('^list', 'direct_message,direct_mention', function(bot, message){
        controller.storage.teams.all((err, all_team_data) => {
            if(!err){
                console.log(message.team + ' is asking for a keyword list!');
                console.log(all_team_data);

                let team = all_team_data.find(team => team.id === message.team);
                console.log("Team Name: " + team);
                if(team && team.triggers){
                    let trigger_list = Object.keys(team.triggers).sort();
                    let response = trigger_list.reduce((accumulator, value) => {
                        return accumulator + value + "\n";
                    }, "Trigger word list: \n ```");
                    response += "``` To use any of the above, see help command"; 

                    bot.reply(message, response);
                } else {
                    bot.reply(message, "I couldn't find any triggers words registered for team. :/");
                }
            } else {
                bot.reply(message, "Sorry, I couldn't get the list of keywords");
                console.log(err);
            }
        });
    });

    // Help command
    controller.hears('^help', 'direct_message,direct_mention', function(bot, message){
        let version = process.env.VERSION || ""                                             
        let help_message = `ReactionBot ${version}                                             
COMMANDS:                                                                       
*add <trigger> <image_url>* => Tell ReactionBot to react to any text you say with an image from <image_url>
*remove <trigger>*\t\t\t\t => Tell ReactionBot to stop listening to a <trigger> word  
*get <trigger>*\t\t\t\t\t\t=> Ask ReactionBot to show an image for a <trigger> word   
*list*\t\t\t\t\t\t\t\t\t\t  => Show all the trigger words Reactionbot is listening for
*help*\t\t\t\t\t\t\t\t\t   => Show this help message                            

Have a feature request, bug report, or general inquiry? Please contact us here:
https://reactionbot-js.herokuapp.com/contact.html
` 
        bot.reply(message, help_message);
    });



    // Uploading reactions to reactionbot
    // require("fs").readFile("./reactions.txt", "utf8", (err, data) => {
    //     // Team ID: T4EHZ995K
    //     // Regex: /^(.*) (.*)/g
    //     controller.storage.teams.get("T4EHZ995K", function(err, team_data){
    //         if(!err){
    //             team_data.triggers = team_data.triggers || {}; //Create a new triggers obj if it doesnt exist
    //             console.log("Data: ");
    //             console.log(data);
    //             data.split("\n").forEach((element) => {
    //                 if(element){
    //                     let match = /^(.*) (.*)$/g.exec(element);
    //                     console.log("Element: " + element);
    //                     console.log(match);
    //                     team_data.triggers[match[1]] = match[2];
    //                 } else {
    //                     console.log("Reached the end of file I think");
    //                 }
    //             });
    //             console.log("The length of data is: " + data.split("\n").length);
    //             // Save new team_data in database
    //             controller.storage.teams.save(team_data, function(err){
    //                 console.log(err);
    //             });
    //         }
    //     });
    // });

    /***************************************************************************/
    //TODO: Removing HTML characters?
    function extract_url(text){
        let match = /<([^>\|]+)(?:\|([^>]+))?>/g.exec(text);
        if(url = match[1]){
            return decodeURIComponent(url) // Remove percent encoding 
        }
    }
};
