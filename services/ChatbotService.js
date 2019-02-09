'use strict';

const db = require('byteballcore/db');
const device = require('byteballcore/device.js');

const obyteService = require('./ObyteService');

module.exports = {

  sendMessageToSubscribedUsers: () => {
    db.query('SELECT device_address FROM users', rows => {
      rows.forEach(element => {

      });
    });
  },
  textHandler: (from_address, text) => {
    const _text = text.trim().toLocaleLowerCase();
    const isValidAddress = validationUtils.isValidAddress(text);

    if(isValidAddress){
      return obyteService.saveDeviceAddress(from_address);
    }

    
    switch (_text) {
      case 'about':
        device.sendMessageToDevice(from_address, 'text', 'Welcome to the ErrorFareAlerts Premium Bot.\n\nHere you can get deals faster than all other subscribers. Also you will get exclusive deals, only subscribers of this bot will get.\n\nIn order to get this premium notifications you need to deposit bytes. Every time this bot sends you a link to a deal, your byte balance will reduce by 1 MB, which is about 0,03 EUR.\n\n[Back](command:menu)');
        break;
      case 'deposit':
        break;
      case 'withdraw':
        let userInfo = '';
        if(!userInfo.user_address){
          const noAddressText = 'Send me your byteball address and try again. (click ... and Insert my address)';
          return device.sendMessageToDevice(from_address, 'text', noAddressText);
        }

        let text = 'Your balance: ' + userInfo.balance + 'mb\n';

        if (userInfo.balance >= 1) {
          text += 'Are you sure that you want to withdraw money?\n[Yes](command:withdraw_yes)\t[No](command:withdraw_no)';
        } else {
          text += 'Minimum balance for withdraw 1mb';
        }

        device.sendMessageToDevice(from_address, 'text', text);

        break;
      case 'terms':
        device.sendMessageToDevice(from_address, 'text', 'This chat bot is provided “as is,” with all faults, and MyActivities GmbH expresses no representations or warranties, of any kind related to this chat bot or the materials and services provided with this chat bot. In no event shall MyActivities GmbH, nor any of its authors, developers and employees, shall be held liable for anything arising out of or in any way connected with your use of this chat bot whether such liability is under contract. MyActivities GmbH, including its authors, developers and employees shall not be held liable for any direct, indirect, consequential or special liability arising out of or in any way related to your use of this chat bot. This also includes loss of funds of any kind, including software or hardware failures, malicious attacks, connection, protocol or wallet failures. Minors or people below 18 years old are not allowed to use this chat bot. If any provision of these Terms is found to be invalid under any applicable law, such provisions shall be deleted without affecting the remaining provisions herein. If you disagree with these terms you must not use this chat bot. This Bot is experimental and an early Alpha version.\n\n[Back](command:menu)');
        break;
      case 'howtobuy':
        device.sendMessageToDevice(from_address, 'text', 'There are 3 ways to buy or earn some Bytes, the currency you need for this premium service:\n\n1)  Buying Bytes via a credit card: https://medium.com/byteball/buying-bytes-with-visa-or-mastercard-d8ee2d1a2b07\n2) Buying Bytes from a Cryptocurrency Exchange: https://wiki.byteball.org/Trading#Buying_GB_on_exchanges\n3) Earning Bytes e.g. from Byteball Cashback merchants: https://wiki.byteball.org/Cashback#Merchants\n\n[Back](command:menu)');
        break;
      case 'withdraw_no':
        device.sendMessageToDevice(from_address, 'text', 'ok');
        break;
      case 'withdraw_yes':
        // ToDo: not finished yet
        let userInfo_ = '';
        if (userInfo.balance < 1) return;
        let unit = await new Promise(resolve => {
          headlessWallet.issueChangeAddressAndSendPayment(null, parseInt(userInfo.balance * MEGA), userInfo.user_address, from_address, (err, unit) => {
            if (err) {
              console.error('sendPayment ERR: ', err);
              return resolve(-1);
            } else {
              return resolve(unit);
            }
          });
        break;
    }
    
  }

};