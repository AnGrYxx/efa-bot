'use strict';

const db = require('byteballcore/db');

module.exports = {
  getBalanceByDeviceAddress: (device_address) => {
    return new Promise(resolve => {
      db.query('SELECT balance FROM users WHERE device_address = ?', [device_address], rows => {
        if (rows.length > 1) {
          return resolve(rows[0].balance);
        }
      });
    });
  },
  increaseUserBalance: (device_address, amount) => {
    return new Promise(resolve => {
      db.query('UPDATE users SET balance = balance + ? WHERE device_address = ?', [amount, device_address], () => {
          return resolve('ok');
        });
    });
  },
  decreaseUserBalance: (device_address, amount) => {
    return new Promise(resolve => {
      db.query('UPDATE users SET balance = balance - ? WHERE device_address = ?', [amount, device_address], () => {
        return resolve('ok');
      });
    });
  },
  saveDeviceAddress: () => {
    return new Promise();
  }
 };