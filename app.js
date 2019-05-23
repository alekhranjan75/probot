'use strict';

const
  bodyParser = require('body-parser'),
  express = require('express'),
  request = require('request'),
  path = require('path'),
  schedule = require('node-schedule'),
  mongoose = require('mongoose');

var User = require('./app/model/user');
var apiController = require('./app/controller/api');
var routes = require('./app/routes/index');
var webhooks = require('./app/routes/webhooks');
var app = express();

app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');
app.set('views', './app/views');

app.use(express.static(path.join(__dirname, 'app', 'public')));
app.use(bodyParser.json());
app.use('/', routes);
app.use('/webhook', webhooks);

// to avoid warnings
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

const uri = "mongodb+srv://admin:ZaW7Uy8y77dpFUK@mydatabase-imkxx.mongodb.net/test?retryWrites=true";
mongoose.connect(uri, {
    useNewUrlParser: true
  },
  function (err) {
    if (err) throw err;

    console.log('Successfully connected to database');
  }
);

var news = schedule.scheduleJob('*/50 * * * *', function () {

  User.find({}, function (err, users) {
    if (users != null) {
      apiController.getArticle(function (err, articles) {
        users.forEach(function (user) {
          var max = Math.min(articles.length, 25)
          apiController.sendText(user.fb_id, "Here is your daily news update...")
          apiController.sendArticleMessage(user.fb_id, articles[Math.floor(Math.random() * max)])
        });
      }, "buzz")
    }
  });
});
var video = schedule.scheduleJob('*/50 * * * *', function () {
   
   User.find({}, function (err, users) {
     if (users != null) {
     apiController.videos(function(err, videos) {
        users.forEach(function (user) {
          var max = Math.min(videos.length, 25)
          apiController.sendText(user.fb_id, "Found a daily video for you...")
          apiController.sendVideos(user.fb_id, videos[Math.floor(Math.random() * max)])
        });
      })
    }
   })
})

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;