CREATE TABLE assoc_address (
	device_address CHAR(33) NOT NULL PRIMARY KEY,
	address CHAR(32) NULL,
	creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (device_address) REFERENCES correspondent_devices(device_address)
);

CREATE TABLE games (
	id CHAR(40) NOT NULL PRIMARY KEY,
	val CHAR(100) NOT NULL,
	ended INT NOT NULL DEFAULT 0,
	device_address CHAR(33) NULL,
	userNumber INT NULL
);

CREATE TABLE stats (
	 balance INT NOT NULL DEFAULT 0,
	 minus INT NOT NULL DEFAULT 0,
	 plus INT NOT NULL DEFAULT 0,
	 totalMinus INT NOT NULL DEFAULT 0,
	 totalPlus INT NOT NULL DEFAULT 0,
	 totalRef INT NOT NULL DEFAULT 0,
	 jackpot INT NOT NULL DEFAULT 0
);
INSERT INTO stats (balance, minus, plus, totalMinus, totalPlus, totalRef) VALUES(0,0,0,0,0,0);

CREATE TABLE jackpots (
    creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP PRIMARY KEY,
	device_address CHAR(33) NOT NULL,
	jackpot INT NOT NULL
);

CREATE INDEX byDeviceAddress ON users(device_address);
CREATE INDEX byGameId ON games(id);