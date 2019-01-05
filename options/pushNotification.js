const request = require('request-promise-native');
const env = require('../config/env');

module.exports =(items) => {

  let title;
  let body;
  if (items.length === 0) {
    return Promise.resolve([]);
  }

  if(items.length === 1){
    title = 'Neuer ErrorFare!';
    body= items[0].title;
  } else {
    title = items.length + ' neue ErrorFares!';
    body= 'Jetzt schnell anschauen!';
  }

  let payload = {
    to: '/topics/' + env.fcm.topic,
    priority: 'high',
    notification:{
      title: title,
      body: body,
      sound: 'default',
      icon: 'errorfarealerts'
    }
  };


  return request({
    url: env.fcm.server,
    method: 'POST',
    headers: {
      authorization: env.fcm.token,
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });


};