/*jslint node: true */
'use strict';
const constants = require('byteballcore/constants.js');
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');
const eventBus = require('byteballcore/event_bus');
const validationUtils = require('byteballcore/validation_utils');
const headlessWallet = require('headless-byteball');
const crypto = require('crypto');

// const MEGA = 1;
const my_pairing_code = 'A0BAwtrdy0EmpliXdoUTO4awF51F+yCZjdK7zbX4CNMi@byteball.org/bb#*';
const MEGA = 1000000;

eventBus.once('headless_wallet_ready', () => {
	headlessWallet.setupChatEventHandlers();

	eventBus.on('paired', async (from_address, pairing_secret) => {
		await welcome(from_address);
		if (pairing_secret.length === 40) {
			await setRegRefId(from_address, pairing_secret);
		}
	});

	eventBus.on('text', async (from_address, text) => {
		text = text.trim();
		let ucText = text.toUpperCase();
		let lcText = text.toLowerCase();

		let matchBid = lcText.match(/(>|<|\(|\))([0-9]{1,2})/);
		let matchBalance = lcText.match(/([0-9]+)(\s|)mb/);

		let userInfo = await getUserInfo(from_address);
		let stats = await getStats();

		const device = require('byteballcore/device.js');
		if (validationUtils.isValidAddress(ucText)) {
			await setAddress(from_address, ucText);
			device.sendMessageToDevice(from_address, 'text', 'Thank you! I saved your address.');
		} else if (lcText === 'about') {
			device.sendMessageToDevice(from_address, 'text', 'Welcome to the ErrorFareAlerts Premium Bot.\n\nHere you can get deals faster than all other subscribers. Also you will get exclusive deals, only subscribers of this bot will get.\n\nIn order to get this premium notifications you need to deposit bytes. Every time this bot sends you a link to a deal, your byte balance will reduce by 1 MB, which is about 0,03 EUR.\n\n[Back](command:menu)');
		} else if (matchBalance) {
			let address = await getAssocAddress(from_address);
			let amount = parseInt(matchBalance[1]);
			device.sendMessageToDevice(from_address, 'text', '[balance](byteball:' + address + '?amount=' + (amount * MEGA) + ')');
		} else if (text === 'deposit') {
			device.sendMessageToDevice(from_address, 'text',
				'[Top up on 1mb](command:1mb)\n' +
				'[Top up on 15mb](command:15mb)\n' +
				'[Top up on 30mb](command:30mb)\n' +
				'[Top up on 75mb](command:75mb)\n' +
				'[Top up on 100mb](command:100mb)\n' +
				'[Top up on 500mb](command:500mb)\n' +
				'[Top up on 1000mb](command:1000mb)\n' +
				'or send amount, for example "66mb"')
		} else if (lcText === 'withdraw') {
			let text = 'Your balance: ' + userInfo.balance + 'mb\n';
			if (!userInfo.user_address) {
				text = 'Send me your byteball address and try again. (click ... and Insert my address)';
			} else if (userInfo.balance >= 1) {
				text += 'Are you sure that you want to withdraw money?\n[Yes](command:withdraw_yes)\t[No](command:withdraw_no)';
			} else {
				text += 'Minimum balance for withdraw 1mb';
			}
			device.sendMessageToDevice(from_address, 'text', text);
		} else if (lcText === 'withdraw_yes') {
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
			});
			if (unit === -1) {
				device.sendMessageToDevice(from_address, 'text', 'Sorry there was an error, please try a little later.');
			} else {
				device.sendMessageToDevice(from_address, 'text', 'I sent you money');
				await decBalance(userInfo.balance, from_address);
			}
		} else if (lcText === 'withdraw_no') {
			device.sendMessageToDevice(from_address, 'text', 'ok');
			await welcome(from_address);
		} else if (lcText === 'terms') {
			device.sendMessageToDevice(from_address, 'text', 'Coming soon\n\n[Back](command:menu)');
		} else if (lcText === 'howtobuy') {
			device.sendMessageToDevice(from_address, 'text', 'There are 3 ways to buy or earn some Bytes, the currency you need for this premium service:\n\n1)  Buying Bytes via a credit card: https://medium.com/byteball/buying-bytes-with-visa-or-mastercard-d8ee2d1a2b07</a>\n2) Buying Bytes from a Cryptocurrency Exchange: https://wiki.byteball.org/Trading#Buying_GB_on_exchanges\n3) Earning Bytes e.g. from Byteball Cashback merchants: https://wiki.byteball.org/Cashback#Merchants\n\n[Back](command:menu)');
		} 
		else if (lcText === 'referral') {
			let myRefId = await getMyRefId(from_address);
			device.sendMessageToDevice(from_address, 'text', 'Referral program\n' +
				'You have the opportunity to make a profit by attracting new users to ErrorFareAlerts.\n' +
				'To do this, you need to follow very simple steps:\n' +
				'1) Copy the Byteball link below\n' +
				'2) Share it with your friends or on Reddit/Twitter/Facebook/Steemit/etc.\n' +
				'3) Get 20% of all used deposits of users who added the bot by your link\n' +
				'Your link:');
			device.sendMessageToDevice(from_address, 'text', my_pairing_code + myRefId);
		} else {
			await welcome(from_address);
		}
	});

});


async function welcome(device_address) {
	const device = require('byteballcore/device.js');
	let balance = await getBalance(device_address);
	let stats = await getStats();

	let text = '[About](command:about)\n\n' +
		'Balance: ' + balance.toFixed(2) + 'mb\n' +
		'[How to buy Bytes](command:howtobuy)\n' +
		'[Deposit](command:deposit)\n' +
		'[Withdraw](command:withdraw)\n\n' +
		'[Referral program](command:referral)\n' +
		'[Terms of Use](command:terms)\n' ;

	device.sendMessageToDevice(device_address, 'text', text);
}

eventBus.on('new_my_transactions', (arrUnits) => {
	let device = require('byteballcore/device.js');
	db.query(
		"SELECT outputs.amount, outputs.asset AS received_asset, device_address \n\
		FROM outputs JOIN assoc_address ON outputs.address=assoc_address.address \n\
		WHERE unit IN(?) AND NOT EXISTS (SELECT 1 FROM unit_authors CROSS JOIN my_addresses USING(address) WHERE unit_authors.unit=outputs.unit)",
		[arrUnits],
		rows => {
			rows.forEach(row => {
				if (row.received_asset !== null)
					return device.sendMessageToDevice(row.device_address, 'text', "Received payment in wrong asset");

				return device.sendMessageToDevice(row.device_address, 'text', "I have received payment. Now let's wait until he's stable, i will write you.\n" +
					"You sent " + (row.amount/MEGA).toFixed(2) + " mb");
			});
		}
	);
});

eventBus.on('my_transactions_became_stable', (arrUnits) => {
	let device = require('byteballcore/device.js');
	db.query(
		"SELECT outputs.amount, outputs.asset AS received_asset, device_address \n\
		FROM outputs JOIN assoc_address ON outputs.address=assoc_address.address \n\
		WHERE unit IN(?) AND asset IS NULL\n\
		AND NOT EXISTS (SELECT 1 FROM unit_authors CROSS JOIN my_addresses USING(address) WHERE unit_authors.unit=outputs.unit)",
		[arrUnits],
		rows => {
			rows.forEach(async (row) => {
				await incBalance(parseFloat((row.amount/MEGA).toFixed(2)), row.device_address);
				return device.sendMessageToDevice(row.device_address, 'text', 'Payment stabled, you have received ' + (row.amount / MEGA) + ' MB' +
					'\n\n[Play](command:play)');
			});
		}
	);
});

function getAssocAddress(device_address) {
	return new Promise(resolve => {
		db.query("SELECT address FROM assoc_address WHERE device_address = ?", [device_address], rows => {
			if (rows.length) {
				return resolve(rows[0].address);
			} else {
				headlessWallet.issueNextMainAddress(receiving_address => {
					db.query(
						"INSERT INTO assoc_address (address, device_address) VALUES(?,?)",
						[receiving_address, device_address],
						() => {
							return resolve(receiving_address);
						}
					);
				});
			}
		});
	});
}

function getBalance(device_address) {
	return new Promise(resolve => {
		db.query("SELECT balance FROM users WHERE device_address = ?", [device_address], rows => {
			if (rows.length) {
				return resolve(rows[0].balance);
			} else {
				db.query(
					'INSERT OR REPLACE INTO users (device_address, balance) VALUES(?,0)',
					[device_address], () => {
						return resolve(0);
					}
				);
			}
		});
	});
}

function incBalance(amount, device_address) {
	return new Promise(resolve => {
		db.query("UPDATE users SET balance = balance + ? WHERE device_address = ?",
			[amount, device_address], () => {
				return resolve();
			});
	});
}

function decBalance(amount, device_address) {
	return new Promise(resolve => {
		db.query("UPDATE users SET balance = balance - ? WHERE device_address = ?", [amount, device_address], () => {
			return resolve();
		});
	});
}

function setAddress(device_address, user_address) {
	return new Promise(resolve => {
		db.query("UPDATE users SET user_address = ? WHERE device_address = ?", [user_address, device_address], () => {
			return resolve();
		});
	})
}

function getUserInfo(device_address) {
	return new Promise(resolve => {
		db.query("SELECT * FROM users WHERE device_address = ?", [device_address], rows => {
			if (!rows.length) return resolve(false);
			return resolve(rows[0]);
		});
	});
}

function getMyRefId(device_address) {
	return new Promise(resolve => {
		db.query("SELECT myRefId FROM users WHERE device_address = ?", [device_address], rows => {
			if (rows.length && rows[0].myRefId) {
				return resolve(rows[0].myRefId);
			} else {
				let hash = crypto.createHash('sha1').update(device_address).digest('hex');
				db.query("UPDATE users SET myRefId = ? WHERE device_address = ?", [hash, device_address], () => {
					return resolve(hash);
				});
			}
		});
	});
}

function setRegRefId(device_address, refId) {
	return new Promise(resolve => {
		db.query("UPDATE users SET regRefId = ? WHERE device_address = ?", [refId, device_address], () => {
			return resolve();
		});
	});
}

function getStats() {
	return new Promise(resolve => {
		db.query("SELECT * FROM stats", [], rows => {
			return resolve(rows[0]);
		});
	});
}

process.on('unhandledRejection', up => { throw up; });
