'use strict';

const
  bodyParser = require('body-parser'),
  express = require('express'),
  request = require('request'),
  path = require('path');

var User = require('./app/model/user');
var apiController = require('./app/controller/api');
var routes = require('./app/routes/index');
var webhooks = require('./app/routes/webhooks');

var app = express();
app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
// app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.set('view engine', 'ejs');
app.set('views', './app/views');

// app.set('views', path.join(__dirname, 'app', 'views'));
// app.set('view engine', 'ejs');

// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'app', 'public')));
app.use(bodyParser.json());
app.use('/', routes);
app.use('/webhook', webhooks);


/*function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}
*/
var User = require('./app/model/user');
var mongoose = require('mongoose');
// to avoid warnings
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

var schedule = require('node-schedule');
const uri = "mongodb+srv://admin:ZaW7Uy8y77dpFUK@mydatabase-imkxx.mongodb.net/test?retryWrites=true";
mongoose.connect(uri, {
    useNewUrlParser: true
  },
  function (err) {
    if (err) throw err;

    console.log('Successfully connected to database');
  }
);

var j = schedule.scheduleJob('*/10 * * * *', function () {

  User.find({}, function (err, users) {
    if (users != null) {
      apiController.getArticle(function (err, articles) {
        users.forEach(function (user) {
          var maxArticles = Math.min(articles.length, 25)
          apiController.sendArticleMessage(user.fb, articles[Math.floor(Math.random() * maxArticles)])
        });
      })
    }
  });
});

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;