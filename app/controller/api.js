const
    request = require('request'),
    rssReader = require('feed-read'),
    properties = require('../config/properties.js');

var
    User = require('../model/user');

const allJokes = {
    chuck: [
        'Chuck Norris counted to infinity - twice.',
        'Death once had a near-Chuck Norris experience.',
    ],
    tech: [
        'Did you hear about the two antennas that got married? The ceremony was long and boring, but the reception was great!',
        'Why do geeks mistake Halloween and Christmas? Because Oct 31 === Dec 25.',
    ],
    default: [
        'Why was the Math book sad? Because it had so many problems.',
        "Today a man knocked on my door and asked for a small donation towards the local swimming pool. I gave him a glass of water."
    ],
};

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
                    case "urlbutton":
                        URLButton(sender_psid);
                        break;
                    case "share":
                        shareButton(sender_psid);
                        break;
                    case "call":
                        callButton(sender_psid);
                        break;
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
                        callWitAI(text, function (err, intent) {
                            handleIntent(intent, sender_psid)
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
    User.findOneAndUpdate({ fb_id: newUser.fb_id }, { fb_id: newUser.fb_id }, { upsert: true }, function (err, user) {
        if (err) {
            console.log("Error in updating");
            sendTextMessage(id, "There was error subscribing you for daily articles");
        } else {
            console.log('User saved successfully!');
            sendTextMessage(newUser.fb_id, "You've been subscribed!")
        }
    });
}

function unsubscribeUser(id) {
    // call the built-in save method to save to the database
    User.findOneAndRemove({ fb_id: id }, function (err, user) {
        if (err) {
            sendTextMessage(id, "There wan error unsubscribing you for daily articles");
        } else {
            console.log('User deleted successfully!');
            sendTextMessage(id, "You've been unsubscribed!")
        }
    });
}

function subscribeStatus(id) {
    User.findOne({ fb_id: id }, function (err, user) {
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
function _sendArticleMessage(sender_psid, article) {
    var message_body = {
        recipient: {
            id: sender_psid
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [
                        {
                            title: article.title,
                            subtitle: article.published.toString(),
                            item_url: article.link
                        }
                    ]
                }
            }
        }
    }
    // Sends the response message
    callSendAPI(message_body);
}
function shareButton(sender_psid) {
    var message_body = {
        recipient: {
            id: sender_psid
        },
        message: {
            attachment: {
                type: "template",
                    payload: {
                    template_type: "generic",
                        "elements": [
                            {
                                "title": "Breaking News: Record Thunderstorms",
                                "subtitle": "The local area is due for record thunderstorms over the weekend.",
                                "image_url": "https://www.accuweather.com/en/weather-news/is-it-safe-to-talk-on-your-cell-phone-during-a-thunderstorm/70004528",
                                "buttons": [
                                    {
                                        "type": "element_share",
                                        "share_contents": {
                                            "attachment": {
                                                "type": "template",
                                                "payload": {
                                                    "template_type": "generic",
                                                    "elements": [
                                                        {
                                                            "title": "I took the hat quiz",
                                                            "subtitle": "My result: Fez",
                                                            "image_url": "https://bot.peters-hats.com/img/hats/fez.jpg",
                                                            "default_action": {
                                                                "type": "web_url",
                                                                "url": "http://m.me/petershats?ref=invited_by_24601"
                                                            },
                                                            "buttons": [
                                                                {
                                                                    "type": "web_url",
                                                                    "url": "http://m.me/petershats?ref=invited_by_24601",
                                                                    "title": "Take Quiz"
                                                                }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                }
            }
        }
    }
    callSendAPI(message_body)
} 

function callButton(sender_psid) {
    var message_body = {
        "recipient": {
            "id": sender_psid
  },
        "message": {
            "attachment": {
                "type":"template",
                "payload": {
                    "template_type":"button",
                    "text":"Need further assistance? Talk to a representative",
                    "buttons": [
                        {
                            "type":"phone_number",
                            "title":"Call Representative",
                            "payload":"+919068787418"
          }
                    ]
                }
            }
        }
    }
    callSendAPI(message_body)
}
function URLButton(sender_psid) {
    var message_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": "Try the URL button!",
                    "buttons": [
                        {
                            "type": "web_url",
                            "url": "google.com",
                            "title": "URL Button",
                            "webview_height_ratio": "full"
                        }
                    ]
                }
            }
        }
    }
    callSendAPI(message_body)
}

function buyButton(sender_psid) {
    var message_body = {
        "recipient": {
            "id": sender_psid
        },
         'message': { 'attachment': { 'type': 'template', 'payload': { 'text': 'Please checkout.', 'template_type': 'button', 'buttons': [{ 'payment_summary': { 'merchant_name': "Peter's Apparel", 'currency': 'USD', 'payment_type': 'FIXED_AMOUNT', 'price_list': [{ 'amount': '29.99', 'label': 'Subtotal' }, { 'amount': '2.47', 'label': 'Taxes' }], 'requested_user_info': ['contact_name'], 'is_test_payment': true }, 'type': 'payment', 'payload': 'DEVELOPER_DEFINED_PAYLOAD', 'title': 'buy' }, { 'type': 'postback', 'payload': '{"title": "Confirm Order", "event_value": "", "event_name": "confirm_order"}', 'title': 'Confirm Order' }, { 'type': 'postback', 'payload': '{"title": "Add Coupon Code", "event_value": "", "event_name": "add_coupon"}', 'title': 'Add Coupon Code' }] } } }, 'recipient': { 'id': '1232211580183568' } 
        }
        callSendAPI(message_body)
    }

exports.sendArticleMessage = function (sender, article) {
    _sendArticleMessage(sender, article)
}

function _getArticle(callback, newsType) {
    var google_endpoint = "https://news.google.com/rss/search?q=%3C"+newsType+"%3E&hl=en-IN&gl=IN&ceid=IN:en"
    rssReader(google_endpoint, function (err, articles) {
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
exports.getArticle = function (callback) {
    _getArticle(callback)
}

function handleIntent(intent, sender_psid) {
    switch (intent) {

        case "wish":
            var myDate = new Date();
            var hrs = myDate.getHours();
            var greet;
            console.log(hrs)
            if (hrs < 12)
                greet = 'Good Morning';
            else if (hrs >= 12 && hrs <= 17)
                greet = 'Good Afternoon';
            else if (hrs >= 17 && hrs <= 24)
                greet = 'Good Evening';
            sendTextMessage(sender_psid, greet)
            break;
        
        case "joke":
            console.log("Working")
            const jokes = allJokes[category];
            console.log(allJokes[chuck][0])
            sendTextMessage(sender_psid, jokes[Math.floor(Math.random() * jokes.length)])
            break;
        case "greeting":
            sendTextMessage(sender_psid, "Hi! how can I help you...")
            break;
        case "about bot":
            sendTextMessage(sender_psid, "I'm Newsbot, and I can do a lot of stuff.")
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
            },"news");
            break;
        case "news":
            _getArticle(function (err, articles) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "Here's what I found...")
                    _sendArticleMessage(sender_psid, articles[0])
                }
            })
            break;
        case "sports":
            _getArticle(function (err, articles) {
                if (err) {
                    console.log(err);
                } else {
                    sendTextMessage(sender_psid, "Here are some sports news");
                    var maxArticles = Math.min(articles.length, 5);
                    for (var index = 1; index < maxArticles; index++) {
                        _sendArticleMessage(sender_psid, articles[index]);
                    }
                }
            },"sports");
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
        }, "international");
        break;
        case "cricket":
        _getArticle(function (err, articles) {
            if (err) {
                console.log(err);
            } else {
                sendTextMessage(sender_psid, "Here are cricket updates");
                var maxArticles = Math.min(articles.length, 5);
                for (var index = 1; index < maxArticles; index++) {
                    _sendArticleMessage(sender_psid, articles[index]);
                }
            }
        }, "cricket");
        break;
        default:
            sendTextMessage(sender_psid, "I'm not sure about that one :/")
            break;

    }
}

function callWitAI(query, callback) {
    query = encodeURIComponent(query);
    // console.log(query)
    request({
        uri: properties.wit_endpoint + query,
        qs: { access_token: "7VBN3GXGHV6PMBCQOVWNW5LCZNOGUO4O" },
        method: 'GET'
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // console.log("Successfully got %s", response.body);
            try {
                body = JSON.parse(response.body)
                intent = body["entities"]["intent"][0]["value"]
                // console.log("in call wit.ai"+body["entities"]["intent"][0]["value"])
                callback(null, intent)
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
