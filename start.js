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
		} else if (lcText === 'referral') {
			let myRefId = await getMyRefId(from_address);
			device.sendMessageToDevice(from_address, 'text', 'Referral program\n' +
				'You have the opportunity to make a profit by attracting new users to ErrorFareAlerts.\n' +
				'To do this, you need to follow very simple steps:\n' +
				'1) Copy the BB link below\n' +
				'2) Share it with your friends or on Reddit/Twitter/FB/Steemit/etc.\n' +
				'3) Get 1% of all used deposits of users who added the bot by your link\n' +
				'Your link:');
			device.sendMessageToDevice(from_address, 'text', my_pairing_code + myRefId);
		} else {
			await welcome(from_address);
		}
	});

});

async function sendNewGame(from_address) {
	const device = require('byteballcore/device.js');
	let userInfo = await getUserInfo(from_address);
	let stats = await getStats();
	if (userInfo.balance < userInfo.rate) {
		await welcome(from_address);
		device.sendMessageToDevice(from_address, 'text', 'Please top up your balance or [change rate](command:change_rate)');
		return;
	}

	let game = await newGame();
	await setGameToUser(from_address, game);
	device.sendMessageToDevice(from_address, 'text', 'Let’s roll the DICE!\nMy hash:\n' + game +
		'\nYour rate: ' + userInfo.rate + 'mb [change](command:change_rate)\n' +
		'Your balance: ' + userInfo.balance.toFixed(2) + 'mb\n' +
		'Jackpot: ' + stats.jackpot.toFixed(2) + 'mb\n' +
		'Please send me your bid 10-90 \n(Example: >90)\n\n' +
		(userInfo.lastBid ? '[Repeat ' + userInfo.lastBid + '](command:' + userInfo.lastBid + ')' : ''));
}

async function welcome(device_address) {
	const device = require('byteballcore/device.js');
	let balance = await getBalance(device_address);
	let stats = await getStats();

	let text = '[About](command:about)\n\n' +
		'Balance: ' + balance.toFixed(2) + 'mb\n\n' +
		'[Deposit](command:deposit)\n' +
		'[Withdraw](command:withdraw)\n' +
		'[Referral program](command:referral)';

	device.sendMessageToDevice(device_address, 'text', text);
}

function newGame() {
	return new Promise(resolve => {
		let text = random() + '/' + Date.now() + '/' + Math.random();
		let hash = crypto.createHash('sha1').update(text).digest('hex');
		db.query(
			'INSERT OR REPLACE INTO games (id, val) VALUES(?,?)',
			[hash, text], () => {
				return resolve(hash);
			}
		);
	});
}

function random() {
	return Math.floor(Math.random() * (101 - 1)) + 1;
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

function setGameToUser(device_address, game) {
	return new Promise(resolve => {
		db.query("UPDATE users SET lastGame = ? WHERE device_address = ?", [game, device_address], () => {
			return resolve();
		});
	});
}

function getLastGame(device_address) {
	return new Promise(resolve => {
		db.query("SELECT lastGame FROM users WHERE device_address = ?", [device_address], rows => {
			if (!rows.length || !rows[0].lastGame) {
				return resolve({val: 0, lastGame: 0});
			} else {
				db.query("SELECT val FROM games WHERE id = ?", [rows[0].lastGame], rows2 => {
					if (!rows2) return resolve(-1);
					return resolve({val: rows2[0].val, lastGame: rows[0].lastGame});
				});
			}
		});
	})
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

function setStep(device_address, step) {
	return new Promise(resolve => {
		db.query("UPDATE users SET step = ? WHERE device_address = ?", [step, device_address], () => {
			return resolve();
		});
	})
}

function setRate(device_address, rate) {
	return new Promise(resolve => {
		db.query("UPDATE users SET rate = ? WHERE device_address = ?", [rate, device_address], () => {
			return resolve();
		});
	})
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

function addMyWin(amount, ref) {
	return new Promise(resolve => {
		if (!ref) ref = 0;
		db.query("UPDATE stats SET balance = balance + ?, plus = plus + 1, totalPlus = totalPlus + ?,  totalRef = totalRef + ?",
			[amount, amount, ref], () => {
				return resolve();
			});
	});
}

function addMyLost(amount) {
	return new Promise(resolve => {
		db.query("UPDATE stats SET balance = balance - ?, minus = minus + 1, totalMinus = totalMinus + ?", [amount, amount], () => {
			return resolve();
		});
	});
}

function setBid(device_address, bid) {
	return new Promise(resolve => {
		db.query("UPDATE users SET lastBid = ? WHERE device_address = ?", [bid, device_address], () => {
			return resolve();
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

function findUserByRefId(refId) {
	return new Promise(resolve => {
		db.query("SELECT device_address FROM users WHERE myRefId = ?", [refId], rows => {
			if (!rows.length) return resolve(null);
			return resolve(rows[0].device_address);
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

function saveLastNumber(device_address, number) {
	return new Promise(resolve => {
		db.query("UPDATE users SET lastNumber = ? WHERE device_address = ?", [number, device_address], () => {
			return resolve();
		});
	});
}

function incJackpot(amount) {
	return new Promise(resolve => {
		db.query("UPDATE stats SET jackpot = jackpot + ?", [amount], () => {
			return resolve();
		});
	});
}

function resetJackpot() {
	return new Promise(resolve => {
		db.query("UPDATE stats SET jackpot = 0", [], () => {
			return resolve();
		});
	});
}

function endingJackpot(device_address, jackpot) {
	return new Promise(resolve => {
		db.query(
			'INSERT INTO jackpots (device_address, jackpot) VALUES(?,?)',
			[device_address, jackpot], () => {
				return resolve(0);
			}
		);
	});
}

function endingGame(device_address, userNumber, id) {
	return new Promise(resolve => {
		db.query("UPDATE games SET ended = 1, device_address = ?, userNumber = ? WHERE id = ?", [device_address, userNumber, id], () => {
			return resolve();
		});
	});
}

process.on('unhandledRejection', up => { throw up; });
