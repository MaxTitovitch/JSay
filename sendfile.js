const Sender = require("./services/Sender");
let user = {
    fcmtoken: '+375333038199',
    code: 'Name: Иван Иванов'
};


Sender.sendSMS(user.fcmtoken,  user.code);