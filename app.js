const express = require("express");
const bodyParser = require("body-parser");
const multer  = require('multer');
const MongoClient = require("mongodb").MongoClient;
const Service = require("./services/Service");
const Validator = require("./services/Validator");
const Sender = require("./services/Sender");
const formData = require("express-form-data");
const os = require("os");
const fs = require('fs');

const app = express();
const urlencodedParser = bodyParser.urlencoded({extended: false});
const mongoClient = new MongoClient("mongodb://localhost:27017/", { useNewUrlParser: true, useUnifiedTopology: true });
let dbClient;
process.env.TZ = 'Europe/Moscow';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/static/img/photo')
  },
  filename: function (req, file, cb) {
    let name = Date.now() + '.' + file.originalname.split('.').reverse()[0];
    req.body.photo = `static/img/photo/${name}`;
    cb(null, name)
  }
});

const upload = multer({ storage: storage });


app.post("/set-photo", urlencodedParser, upload.single('photo'), function(req, res){
  let validation = Validator.validateText(req.body.photo, 'Photo');
  if(validation !== true) {
    res.status(400).send(Object.assign({status: 'error', },validation));
    return;
  }

  req.app.locals.collection.findOne(
    {token: {$ne: null, $eq: req.body.token}},
    function(err, result){
      let name = __dirname + '/' + result.photo;
      fs.unlinkSync(name);
    }
  );

  req.app.locals.collection.findOneAndUpdate(
    {token: {$ne: null, $eq: req.body.token}},
    { $set: {photo: req.body.photo === 'null' ? null : req.body.photo}},
    {
      returnOriginal: false
    },
    function(err, result){
      if(err) {
        res.status(400).send({status: 'error', photo: 'Server error'});
      } else if(result.lastErrorObject.n !== 1) {
        res.status(400).send({status: 'error', photo: 'Incorrect authentication'});
      } else {
        res.send({status: 'success'});
      }
    }
  );

});




const options = {
    uploadDir: os.tmpdir(),
    autoClean: true
};

app.use(formData.parse(options));
app.use(formData.format());
app.use(formData.stream());
app.use(formData.union());

app.use("/static", express.static(__dirname + "/static"));

mongoClient.connect(function(err, client){
  if(err) {
    return console.error(err);
  }
  dbClient = client;
  app.locals.collection = client.db("db").collection("users");
  app.listen(3000, function(){
    console.log(new Date().toISOString() + ": Server run...");
  });
});

app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
})

var CronJob = require('cron').CronJob;
var job = new CronJob('0 */1 * * * *', function() {
  let notification_time = new Date().toLocaleTimeString().substr(0,5);
  app.locals.collection.find({notification_time: notification_time, notification: true}).toArray(function(err, results){
    if(results) {
      if(results.length > 0) {
        console.log(new Date().toISOString() + ": Messages sent");
        for (let i = 0; i < results.length; i++) {
          Sender.send(results[i].fcmtoken,  'Прими 🚿', results[i].sound);
        }
      }
    }
  });
});
job.start();

app.post("/preregister", urlencodedParser, function(req, res){
  let validation = [Validator.validateString(req.body.name, 'Name'), Validator.validatePhone(req.body.phone, 'Phone'),
    Validator.validateText(req.body.fcmtoken, 'FCMToken')];
  if(validation[0] !== true || validation[1] !== true || validation[2] !== true) {
    if(validation[0] === true) validation[0] = {};
    if(validation[1] === true) validation[1] = {};
    if(validation[2] === true) validation[2] = {};
    res.status(400).send( Object.assign({status: 'error' }, validation[0], validation[1], validation[2]));
    return;
  }

  const user = Service.getUser();
  user.name = req.body.name.trim();
  user.phone =  req.body.phone;
  user.fcmtoken =  req.body.fcmtoken;
  user.code =  Service.createCode();
  let date = new Date();
  date.setHours(date.getHours() + 2);
  user.date_of_preregistration_end = parseInt(date.getTime()/1000);

  req.app.locals.collection.insertOne(user, function(err, result){
    if(err) {
      res.status(400).send({status: 'error', phone: 'Phone isn\'t unique'});
    } else {
      Sender.sendSMS(user.phone,  `Код: ${user.code} \nОтправитель: JSay`);
      res.send({status: 'success'});
    }
  });

});

app.post("/register", urlencodedParser, function(req, res){
  let validation = Validator.validateCode(req.body.code, 'Code');
  if(validation !== true) {
    res.status(400).send(Object.assign({status: 'error', },validation));
    return;
  }

  let date = new Date();
  date.setDate(date.getDate() + 30);

  req.app.locals.collection.findOneAndUpdate(
      {code: req.body.code, date_of_preregistration_end: {$gte: parseInt(new Date().getTime()/1000)}},
      { $set: {token: Service.createToken(), date_of_next_send: parseInt(date.getTime()/1000), code: null}},
      {
        returnOriginal: false
      },
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        }else if(result.lastErrorObject.n !== 1) {
          res.status(400).send({status: 'error', code: 'Incorrect data'});
        } else {
          res.send({status: 'success', token: result.value.token});
        }
      }
  );

});

app.post("/set-fcmtoken", urlencodedParser, function(req, res){
  let validation = Validator.validateText(req.body.fcmtoken, 'FCMToken');
  if(validation !== true) {
    res.status(400).send(Object.assign({status: 'error', },validation));
    return;
  }

  req.app.locals.collection.findOneAndUpdate(
      {token: {$ne: null, $eq: req.body.token}},
      { $set: {fcmtoken: req.body.fcmtoken.trim()}},
      {
        returnOriginal: false
      },
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', photo: 'Server error'});
        } else if(result.lastErrorObject.n !== 1) {
          res.status(400).send({status: 'error', photo: 'Incorrect authentication'});
        } else {
          res.send({status: 'success'});
        }
      }
  );

});

app.post("/auth", urlencodedParser, function(req, res){
  let validation = [Validator.validatePhone(req.body.phone, 'Phone')];
  if(validation[0] !== true) {
    if(validation[0] === true) validation[0] = {};
    res.status(400).send( Object.assign({status: 'error' }, validation[0]));
    return;
  }

  req.app.locals.collection.findOne(
      {phone: req.body.phone, token: {$ne: null}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'User doesn\'t exist'});
        }else {
          res.send({status: 'success', token: result.token});
        }
      }
  );

});

app.get("/restore", urlencodedParser, function(req, res){
  let validation = Validator.validatePhone(req.query.phone.replace(' ', '+'), 'Phone');
  if(validation !== true) {
    res.status(400).send( Object.assign({status: 'error' }, validation));
    return;
  }

  req.app.locals.collection.findOne(
      {phone: req.query.phone.replace(' ', '+'), token: {$ne: null}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'User doesn\'t exist data'});
        } else {
          Sender.sendSMS(result.phone,  `Имя: ${result.name} \nОтправитель: JSay`);
          res.send({status: 'success', name: result.name});
        }
      }
  );

});

app.get("/get-photo", urlencodedParser, function(req, res){
  req.app.locals.collection.findOne(
    {token: {$ne: null, $eq: req.query.token}},
    function(err, result){
      if(err) {
        res.status(400).send({status: 'error', phone: 'Server error'});
      } else if(!result) {
        res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
      }else {
        res.send({status: 'success', photo: result.photo});
      }
    }
  );
});

app.get("/get-info", urlencodedParser, function(req, res){
  req.app.locals.collection.findOne(
      {token: {$ne: null, $eq: req.query.token}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success', name: result.name, phone: result.phone, photo: result.photo});
        }
      }
  );
});

app.post("/set-info", urlencodedParser, function(req, res){
  let validation = [Validator.validateString(req.body.name, 'Name'), Validator.validatePhone(req.body.phone, 'Phone')];
  if(validation[0] !== true || validation[1] !== true) {
    if(validation[0] === true) validation[0] = {};
    if(validation[1] === true) validation[1] = {};
    res.status(400).send( Object.assign({status: 'error' }, validation[0], validation[1]));
    return;
  }

  req.app.locals.collection.findOneAndUpdate(
      {token: {$ne: null, $eq: req.body.token}},
      { $set: {phone: req.body.phone, name: req.body.name}},
      {
        returnOriginal: false
      },
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success'});
        }
      }
  );
});

app.get("/get-sound", urlencodedParser, function(req, res){
  req.app.locals.collection.findOne(
      {token: {$ne: null, $eq: req.query.token}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success', sound: result.sound});
        }
      }
  );
});

app.post("/set-sound", urlencodedParser, function(req, res){
  let validation = Validator.validateBool(req.body.sound, 'Sound');
  if(validation !== true) {
    res.status(400).send(Object.assign({status: 'error', },validation));
    return;
  }

  let sound = req.body.sound;
  sound = sound === 'true' ? true : (sound === 'false' ? false : sound);

  req.app.locals.collection.findOneAndUpdate(
      {token: {$ne: null, $eq: req.body.token}},
      { $set: {sound: sound}},
      {
        returnOriginal: false
      },
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success'});
        }
      }
  );
});

app.get("/get-notification", urlencodedParser, function(req, res){
  req.app.locals.collection.findOne(
      {token: {$ne: null, $eq: req.query.token}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success', notification: result.notification, notification_time: result.notification_time});
        }
      }
  );
});

app.post("/set-notification", urlencodedParser, function(req, res){
  let validation = [Validator.validateBool(req.body.notification, 'Notification'),
    Validator.validateTime(req.body.notification_time, 'Notification time')];
  if(validation[0] !== true || validation[1] !== true) {
    if(validation[0] === true) validation[0] = {};
    if(validation[1] === true) validation[1] = {};
    res.status(400).send( Object.assign({status: 'error' }, validation[0], validation[1]));
    return;
  }

  let notification = req.body.notification;
  notification = notification === 'true' ? true : (notification === 'false' ? false : notification);

  req.app.locals.collection.findOneAndUpdate(
      {token: {$ne: null, $eq: req.body.token}},
      { $set: {notification: notification, notification_time: notification !== false ? req.body.notification_time : null}},
      {
        returnOriginal: false
      },
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        }else {
          res.send({status: 'success'});
        }
      }
  );
});

app.post("/congratulation", urlencodedParser, function(req, res){
  req.app.locals.collection.findOne(
      {token: {$ne: null, $eq: req.body.token}},
      function(err, result){
        if(err) {
          res.status(400).send({status: 'error', phone: 'Server error'});
        } else if(!result) {
          res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
        } else {
          let date_of_next_send = result.date_of_next_send;
          if (date_of_next_send <= parseInt(new Date().getTime()/1000) && date_of_next_send !== null) {
            req.app.locals.collection.findOneAndUpdate(
                {token: req.body.token},
                { $set: {date_of_next_send: null}},
                {returnOriginal: false},
                function(err, result){
                  if(err) {
                    res.status(400).send({status: 'error', phone: 'Server error'});
                  } else if(!result) {
                    res.status(400).send({status: 'error', phone: 'Incorrect authentication'});
                  }else {
                    res.send({status: 'success', result: true});
                  }
                }
            );
          } else {
            res.send({status: 'success', result: false});
          }
        }
      }
  );
});


app.post("/support", urlencodedParser, function(req, res){
  let validation = [Validator.validateText(req.body.message, 'Message'), Validator.validateEmail(req.body.email, 'Email')];
  if(validation[0] !== true || validation[1] !== true) {
    if(validation[0] === true) validation[0] = {};
    if(validation[1] === true) validation[1] = {};
    res.status(400).send( Object.assign({status: 'error' }, validation[0], validation[1]));
    return;
  }

  Service.sendEmail(req.body.message, req.body.email ).then((response) => {
      res.send({status: 'success'});
  }).catch((error) => {
      res.status(400).send({status: 'error', email: 'Server error'});
  });

});

process.on("SIGINT", () => {
  dbClient.close();
  process.exit();
});