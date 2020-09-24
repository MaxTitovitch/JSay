let FCM = require('fcm-node');
let serverKey = 'AAAA_zkXm70:APA91bEhCvRxVXWS7pfayvUALYZHL5JQ5Ir6y_REzeKmJaSdcUIv9sYbCA5Ajh2es07jmzFTDP2bOSEAmfM05jSRajoD_nICGpajbMN05M7NsHTey2ITqdobDRd60c9B8iO9Wgjn2Kt_';
let fcm = new FCM(serverKey);
const queryString = require('query-string');

const axios = require('axios').default;
const userName = 'jsay';
const password = 'jsay2020';
axios.defaults.headers.get['Content-Type'] = 'application/json, text/plain, */*; charset=utf-8';


module.exports = class Service {
    static send(deviceId, code, sound) {

        sound = sound === 'true' ? true : (sound === 'false' ? false : sound);
        console.log(sound);
        let message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
            to: deviceId,

            notification: {
                title: 'JSay',
                body: `${code}`
            },
            
        };
        if(sound === true) {
            message.notification.sound = true;
            message.sound = true;
        }

        fcm.send(message, function (err, response) {
            if (err) {
                console.log("Something has gone wrong!", err);
            } else {
                console.log("Successfully sent with response: ", response);
            }
        });
    }

    static sendSMS(phone, code) {
        let data = {
            user: userName,
            pass: password,
            to: phone.substr(1),
            txt: code
        };
        axios.get(`https://api3.greensms.ru/sms/send?${queryString.stringify(data)}`)
            .then(function (response) {
                console.log(response);
            })
            .catch(function (error) {
                console.log(error.response);
            });
        // axios.get('http://api3.greensms.ru/sms/status?user=jsay&pass=jsay2020&id=38e73b15-ca61-407c-b36e-cad936fbb04a')
        //     .then(function (response) {
        //         console.log(response);
        //     })
        //     .catch(function (error) {
        //         console.log(error.response.data);
        //     });
    }

};