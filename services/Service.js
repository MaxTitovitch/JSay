const nodemailer = require('nodemailer');

module.exports = class Service {
  static getUser() {
    return {
      name: '',
      phone: '',
      code: null,
      date_of_preregistration_end: '',
      photo: null,
      token: null,
      fcmtoken: null,
      sound: false,
      notification: false,
      notification_time: null,
      date_of_next_send: null,
    }
  }

  static createCode () {
    let min = 100000;
    let max = 999999;
    return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
  }

  static createToken () {
    return Service.createShortToken() + Service.createShortToken() + Service.createShortToken() + Service.createShortToken();
  }
  
  static createShortToken() {
    return Math.random().toString(36).substr(2, 8);
  }

  static sendEmail(message, email) {
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'sportcompanyminsk@gmail.com',
        pass: 'awesomemax1998'
      }
    });
    
    return transporter.sendMail({
      from: '"JSay" <admin@jsay.com>',
      to: "j@jsay.group",
      subject: "New request to Support",
      html: `<p><strong>From:</strong> ${email ? email : '-'}</p><p><strong>Message:</strong> ${message}</p>`
    });

  }
  
};