"use strict"
const
    request = require('request'),
    rssReader = require('feed-read'),
    youtubeThumbnail = require('youtube-thumbnail'),
    properties = require('../config/properties.js'),
    weather = require('weather-js'),
    Parser = require('rss-parser'),
    convert = require('xml-js'),
    Regex = require("regex");

var
    User = require('../model/user');

const allJokes = [
    'Why was the Math book sad? Because it had so many problems.😂😂😂😂',
    "Today a man knocked on my door and asked for a small donation towards the local swimming pool. I gave him a glass of water.😂😂😂",
    "2 bachche aapas mein baaten kar rahe the\n1 bachcha: mere daada jee 50 laakh chhod kar mare the\n2 bachcha: isamen kaun see badi baat hai mere daada jee\nsaari duniya chhod kar mare the"
];

exports.tokenVerification = function (req, res) {
    if (req.query['hub.verify_token'] === properties.facebook_challenge) {
        res.send(req.query['hub.challenge']);
        console.log("Validating Webhook")
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
}

exports.handleMessage = function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        var events = data.entry[0].messaging[0];

        // There may be multiple if batched
        data.entry.forEach(function (pageEntry) {
            var webhook_event = pageEntry.messaging[0];
            var sender_psid = webhook_event.sender.id;

            if (events.message && events.message.text) {
                var text = events.message.text;
                var normalizedText = text.toLowerCase().replace(" ", '')

                switch (normalizedText) {
                    case "buy":
                        buyButton(sender_psid);
                        break;
                    case "/subscribe":
                        subscribeUser(sender_psid);
                        console.log("Called the function subscribeUser")
                        break;
                    case "/unsubscribe":
                        unsubscribeUser(sender_psid);
                        console.log("Called the function unsubscribeUser")
                        break;
                    case "/subscribestatus":
                        subscribeStatus(sender_psid);
                        console.log("Called the function subscribeStatus")
                        break;
                    default:
                        callWitAI(text, function (err, intent, location, query) {
                            handleIntent(intent, location, query, sender_psid)
                        })
                }
            }
            // Get the sender PSID
            console.log('Sender PSID: ' + sender_psid);
        });
        res.sendStatus(200);
    }
}


function subscribeUser(id) {
    var newUser = new User({
        fb_id: id,
    });
    User.findOneAndUpdate({
        fb_id: newUser.fb_id
    }, {
        fb_id: newUser.fb_id
    }, {
        upsert: true
    }, function (err, user) {
        if (err) {
            console.log("Error in updating");
            sendTextMessage(id, "There was error subscribing you for daily articles");
        } else {
            console.log('User saved successfully!');
            sendTextMessage(newUser.fb_id, "Congrtulaions! You've been successfully subscribed. 😃")
        }
    });
}

function unsubscribeUser(id) {
    // call the built-in save method to save to the database
    User.findOneAndRemove({
        fb_id: id
    }, function (err, user) {
        if (err) {
            sendTextMessage(id, "There wan error unsubscribing you for daily articles");
        } else {
            console.log('User deleted successfully!');
            sendTextMessage(id, 'You have been unsubscribed! To subscribe again message "/subscribe"')
        }
    });
}

function subscribeStatus(id) {
    User.findOne({
        fb_id: id
    }, function (err, user) {
        var Status = false
        if (err) {
            console.log(err)
        } else {
            if (user != null) {
                Status = true
            }
            var subscribedText = "Your subscribed status is " + Status;
            sendTextMessage(id, subscribedText)
        }
    })
}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
    request({
        "uri": properties.facebook_message_endpoint,
        "qs": {
            "access_token": properties.facebook_token
        },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
        }
    });
}

function callRequestAPI(messageData) {
    request({
        "uri": properties.facebook_request_uri,
        "qs": {
            "access_token": properties.facebook_token
        },
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Request API", response.statusCode, response.statusMessage, body.error);
        }
    });
}

function sendTextMessage(recipientId, messageText) {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText,
        }
    };

    callSendAPI(messageData);

}
exports.sendText = function (recipientId, messageText) {
    sendTextMessage(recipientId, messageText)
}

function _sendArticleMessage(sender_psid, article) {
    var regex = /(http)?s?:?(\/\/[^"']*\.(?:png|jpg|jpeg|gif|png|svg))/gi;
    var image_src = article["content"].match(regex);
    // console.log(image_src)
    var message_body = {
        recipient: {
            id: sender_psid
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    "elements": [{
                        title: article.title,
                        image_url: image_src[0],
                        item_url: article.link,
                        subtitle: article.published.toString(),
                        // "buttons": [{
                        //     "type": "web_url",
                        //     "url": article.link,
                        //     "title": "Read",
                        //     "webview_height_ratio": "full"
                        // }],
                        "buttons": [{
                            "type": "element_share",
                            "share_contents": {
                                "attachment": {
                                    "type": "template",
                                    "payload": {
                                        "template_type": "generic",
                                        "elements": [{
                                            title: article.title,
                                            image_url: image_src[0],
                                            "default_action": {
                                                "type": "web_url",
                                                url: article.link
                                            },
                                            "buttons": [{
                                                "type": "web_url",
                                                url: article.link,
                                                "title": "Read"
                                            }]
                                        }]
                                    }
                                }
                            }
                        }]
                    }]
                }
            }

        }
    }
    // Sends the response message
    callSendAPI(message_body);
}
// function shareButton(sender_psid) {
//     var message_body = {
//         recipient: {
//             id: sender_psid
//         },
//         message: {
//             attachment: {
//                 type: "template",
//                     payload: {
//                     template_type: "generic",
//                         "elements": [
//                             {
//                                 "title": "Breaking News: Record Thunderstorms",
//                                 "subtitle": "The local area is due for record thunderstorms over the weekend.",
//                                 "image_url": "https://i2-prod.gloucestershirelive.co.uk/incoming/article2790617.ece/ALTERNATES/s1200/0_Thunderstorm-at-sunset.jpg",
//                                 "buttons": [
//                                     {
//                                         "type": "element_share",
//                                         "share_contents": {
//                                             "attachment": {
//                                                 "type": "template",
//                                                 "payload": {
//                                                     "template_type": "generic",
//                                                     "elements": [
//                                                         {
//                                                             "title": "I took the hat quiz",
//                                                             "subtitle": "My result: Fez",
//                                                             "image_url": "https://bot.peters-hats.com/img/hats/fez.jpg",
//                                                             "default_action": {
//                                                                 "type": "web_url",
//                                                                 "url": "http://m.me/petershats?ref=invited_by_24601"
//                                                             },
//                                                             "buttons": [
//                                                                 {
//                                                                     "type": "web_url",
//                                                                     "url": "http://m.me/petershats?ref=invited_by_24601",
//                                                                     "title": "Read"
//                                                                 }
//                                                             ]
//                                                         }
//                                                     ]
//                                                 }
//                                             }
//                                         }
//                                     }
//                                 ]
//                             }
//                         ]
//                 }
//             }
//         }
//     }
//     callSendAPI(message_body)
// } 

function callButton(sender_psid) {
    var message_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "Need further assistance? Talk to a representative 📞📞",
                    "buttons": [{
                        "type": "phone_number",
                        "title": "Call Representative",
                        "payload": "+917992458695"
                    }]
                }
            }
        }
    }
    callSendAPI(message_body)
}

function weatherForecast(sender_psid, city) {
    weather.find({
        search: city,
        degreeType: 'C'
    }, function (err, result) {
        if (err) console.log(err);
        var todayWeather = "In " + result[0]["location"]["name"] + " the temperature is " + result[0]["current"]["temperature"] + "°C" + " and the wind speed is " + result[0]["current"]["windspeed"] + " and it feels like " + result[0]["current"]["skytext"]
        var nextDayWeather = result[0]["forecast"][2]["day"] + " will be " + result[0]["forecast"][2]["skytextday"] + " with highest temperature of " + result[0]["forecast"][2]["high"] + "°C"
        var report = todayWeather + " but  " + nextDayWeather;
        sendTextMessage(sender_psid, todayWeather + " but  " + nextDayWeather + "😊😊😊");
        console.log(report)
    });

}

function sendVideos(sender_psid, videos) {
    // console.log(videos)
    var thumbnail = youtubeThumbnail(videos.link);
    var image = thumbnail["high"]["url"];
    var message_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    template_type: "generic",
                    "elements": [{
                        title: videos.title,
                        "image_url": image,
                        subtitle: videos["author"],
                        item_url: videos.link,
                        "buttons": [{
                            "type": "web_url",
                            "url": videos.link,
                            "title": "Watch it!",
                            "webview_height_ratio": "full"
                        }]
                    }]
                }
            }
        }
    }
    callSendAPI(message_body)
}
exports.sendVideos = function(sender_psid, videos) {
    sendVideos(sender_psid, videos)
}

function buyButton(sender_psid) {
    var message_body = {
        "recipient": {
            "id": sender_psid
        },
        'message': {
            'attachment': {
                'type': 'template',
                'payload': {
                    'text': 'Please checkout.',
                    'template_type': 'button',
                    'buttons': [{
                        'payment_summary': {
                            'merchant_name': "Peter's Apparel",
                            'currency': 'USD',
                            'payment_type': 'FIXED_AMOUNT',
                            'price_list': [{
                                'amount': '29.99',
                                'label': 'Subtotal'
                            }, {
                                'amount': '2.47',
                                'label': 'Taxes'
                            }],
                            'requested_user_info': ['contact_name'],
                            'is_test_payment': true
                        },
                        'type': 'payment',
                        'payload': 'DEVELOPER_DEFINED_PAYLOAD',
                        'title': 'buy'
                    }, {
                        'type': 'postback',
                        'payload': '{"title": "Confirm Order", "event_value": "", "event_name": "confirm_order"}',
                        'title': 'Confirm Order'
                    }, {
                        'type': 'postback',
                        'payload': '{"title": "Add Coupon Code", "event_value": "", "event_name": "add_coupon"}',
                        'title': 'Add Coupon Code'
                    }]
                }
            }
        },
        'recipient': {
            'id': '1232211580183568'
        }
    }
    callSendAPI(message_body)
}

exports.sendArticleMessage = function (sender, article) {
    _sendArticleMessage(sender, article)
}

function _getArticle(callback, newsType) {
    if (typeof (newsType) === 'undefined') {
        newsType = "buzz"
    }
    // console.log("Called _getArticle")
    var news_endpoint = "https://www.news18.com/rss/" + newsType + ".xml"
    rssReader(news_endpoint, function (err, articles) {
        if (err) {
            callback(err)
        } else {
            if (articles.length > 0) {
                callback(null, articles)
            } else {
                callback("no articles")
            }
        }
    })
}

function getVideos(callback) {
    var youtube_endpoint = "https://www.youtube.com/feeds/videos.xml?channel_id=UCrC8mOqJQpoB7NuIMKIS6rQ"
    rssReader(youtube_endpoint, function (err, videos) {
        if (err) {
            callback(err)
        } else {
            if (videos.length > 0) {
                // console.log(videos.length)
                callback(null, videos)

            } else {
                callback("no videos")
            }
        }
    })
}
exports.videos = function (callback) {
    getVideos(callback)
}
// function sendVideos(sender_psid) {
//     var message_body = {
//         recipient: {
//             id: sender_psid
//         },
//         message: {
//             attachment: {
//                 type: "template",
//                 payload: {
//                     template_type: "media",
//                     elements: [{
//                         // title:videos.title,
//                         media_type: "video",
//                         url: "https://www.facebook.com/GrowingIndia/videos/2255906558059103/"

//                     }]
//                 }
//             }
//         }
//     }
//     // Sends the response message
//     callSendAPI(message_body);
// }
// function uploadVideo() {
//     console.log("Uploading Video")
//     var message_body = {
//         "message": {
//             "attachment": {
//                 "type": "video",
//                 "payload": {
//                     "is_reusable": true,
//                     "url": "https://www.facebook.com/fmfpage/videos/571087186716395/"
//                 }
//             }
//         }
//     }
//     callRequestAPI(message_body)
// }
// uploadVideo();
exports.getArticle = function (callback, newsType) {
    _getArticle(callback, newsType)
}

function handleIntent(intent, location, query, sender_psid) {
    // intent = "wiki"
    console.log(intent);
    console.log(query);
    console.log(location)
    switch (intent) {

        case "wish":
            var myDate = new Date();
            var hrs = myDate.getHours();
            var greet;
            console.log(hrs)
            if (hrs < 12)
                greet = 'Good Morning';
            else if (hrs >= 12 && hrs < 17)
                greet = 'Good Afternoon';
            else if (hrs >= 17 && hrs <= 24)
                greet = 'Good Evening';
            sendTextMessage(sender_psid, greet)
            break;

        case "joke":
            const jokes = allJokes;
            sendTextMessage(sender_psid, jokes[/*Math.floor(Math.random() * jokes.length)*/2])
            break;
        case "greeting":
            sendTextMessage(sender_psid, 'Hi! 🙋‍♂️🙋‍♂️\nHow can I help you?\nTo know what I can do type\n"Get Started"');
            break;
        case "get started":
        case "about bot":
            sendTextMessage(sender_psid, 'I am Probot 🤖.\nI can do things like\n1.Get news for you:\n  "Show some sports news"\n  "What are the international updates"\n\n2.Send videos:\n  "send a video"\n  "Show me a video"\n\n3.Search articles on wikipedia for you:\n  "Search on wiki about USA"\n\n4.I can even even tell you the weather of a location:\n  "What is the weather in Kolkata"\n\nAnd subscribe for much more')
            break;
        case "more news":
            _getArticle(function (err, articles) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "How about these?")
                    var maxArticles = Math.min(articles.length, 5);
                    for (var index = 1; index < maxArticles; index++) {
                        _sendArticleMessage(sender_psid, articles[index]);
                    }
                }
            }, "buzz");
            break;
        case "video":
            getVideos(function (err, videos) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "Found a video for you...")
                    // sendVideos(sender_psid)
                    var maxVideos = Math.min(videos.length, 25)
                    sendVideos(sender_psid, videos[Math.floor(Math.random() * maxVideos)])
                }
            })
            break;
        case "wiki":
            if(query == undefined) {
                query = location
            }
            getWiki(function (err, wiki) {
                if (err) {
                    console.log(err)
                } else {
                    sendTextMessage(sender_psid, "Related search results are: ")
                    parseWiki(sender_psid, wiki)
                }
            }, query)
            break;
        case "subscribe":
            subscribeUser(sender_psid);
            break;
        case "unsubscribe":
            unsubscribeUser(sender_psid);
            break;
        case "subscribe status":
            subscribeStatus(sender_psid);
            break;
        case "gratitude":
            sendTextMessage(sender_psid, "Glad to hear that!\n\n😊😊😊");
            break;
            // case "news":
            //     _getArticle(function (err, articles) {
            //         if (err) {
            //             console.log(err);
            //         } else {
            //             sendTextMessage(sender_psid, "Here's what I found...")
            //             _sendArticleMessage(sender_psid, articles[0])
            //         }
            //     }, "news")
            //     break;
        case "cricket":
        case "sports":
            _getArticle(function (err, articles) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "Here are some updates:");
                    var maxArticles = Math.min(articles.length, 5);
                    for (var index = 1; index < maxArticles; index++) {
                        _sendArticleMessage(sender_psid, articles[index]);
                    }
                }
            }, "sports");
            break;
        case "international news":
            _getArticle(function (err, articles) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "These are some of the international headlines");
                    var maxArticles = Math.min(articles.length, 5);
                    for (var index = 1; index < maxArticles; index++) {
                        _sendArticleMessage(sender_psid, articles[index]);
                    }
                }
            }, "world");
            break;
        case "help":
            callButton(sender_psid);
            break;
        case "weather":
            weatherForecast(sender_psid, location);
            console.log("called func");
            break;
        default:
            sendTextMessage(sender_psid, "I'm not sure about that one :/")
            break;

    }
}

function callWitAI(query, callback) {
    query = encodeURIComponent(query);
    request({
        uri: properties.wit_endpoint + query,
        qs: {
            access_token: "7VBN3GXGHV6PMBCQOVWNW5LCZNOGUO4O"
        },
        method: 'GET'
    }, function (error, response, body) {
        var location, wiki
        if (!error && response.statusCode == 200) {
            // console.log("Successfully got %s", response.body);
            try {
                body = JSON.parse(response.body)
                var intent = body["entities"]["intent"][0]["value"]
                try {
                    location = body["entities"]["location"][0]["value"]
                } catch (error) {
                }
                try {
                    wiki = body["entities"]["wikipedia_search_query"][0]["value"]
                    console.log("query @:"+wiki)
                } catch (error) {}
                // console.log("in call wit.ai"+body["entities"]["intent"][0]["value"])
                callback(null, intent, location, wiki)
            } catch (e) {
                callback(e)
            }
        } else {
            // console.log(response.statusCode)
            console.error("Unable to send message. %s", error);
            callback(error)
        }
    });
}

function getWiki(callback, query) {
    var url = "https://en.wikipedia.org/w/api.php?action=opensearch&search=" + query + "&format=xml";
    request(url, function (err, response, body) {
        if (err) {
            console.log("connection error");
        } else {
            var result = convert.xml2json(body, {
                compact: false,
                spaces: 2
            });
            // console.log(result)
            var res = JSON.parse(result);
            // console.log(res)
            callback(null, res);
        }
    });
}

function parseWiki(sender_psid, wiki) {
    var ele = wiki["elements"][0]["elements"][1]["elements"];
    var data = {}
    for (let index = 0; index < 4; index++) {
        var title = ele[index]["elements"][0]["elements"][0]["text"]
        var link = ele[index]["elements"][1]["elements"][0]["text"]
        var subtitle = ele[index]["elements"][2]["elements"][0]["text"]
        try {
            var image = ele[index]["elements"][3]["attributes"]["source"]
            var i = image.lastIndexOf("/")
            image = image.slice(0, i+1) + image.slice(i+3);
            image = image.replace(/px/g, '1024$&')
        } catch (error) {
            var image = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Wiki-black.png/1024px-Wiki-black.png"
        }
        console.log(title+": "+ image)
        data.title = title;
        data.link = link;
        data.image = image;
        data.subtitle = subtitle;
        sendWiki(sender_psid, data);
        if (ele[index+1]== undefined) {
            break;
        }
    }      
}

function sendWiki(sender_psid, wiki) {
     var message_body = {
         "recipient": {
             "id": sender_psid
         },
         "message": {
             "attachment": {
                 "type": "template",
                 "payload": {
                     template_type: "generic",
                     "elements": [{
                         title: wiki.title,
                         "image_url": wiki.image,
                         item_url: wiki.link,
                         subtitle: wiki.subtitle,
                         "buttons": [{
                             "type": "web_url",
                             "url": wiki.link,
                             "title": "Read On Wikipedia",
                             "webview_height_ratio": "full"
                         }]
                     }]
                 }
             }
         }
     }
    //  console.log("Called SendWiki")
     callSendAPI(message_body)
}


// var {google} = require('googleapis');
// var youtube = google.youtube({
//     version: 'v3',
//     auth: properties.youtube_key
// });


// youtube.search.list({
//     part: 'snippet',
//     q: 'Iskcon'
// }, function (err, data) {
//     if (err) {
//         console.error('Error: ' + err);
//     }
//     if (data) {
//         console.log(data)
//     }
// });