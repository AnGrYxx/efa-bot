'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('*',(req, res) => {
  res.status(401).send('Unauthorized');
});

app.post('/',(req, res) => {

  const data = req.body;

  if(!data || data.type !== 'Notification'){
    req.status(400).send('Bad Request');
  }


});

app.listen(port, ()=>{
  console.log('Server listening on port: ' + port);
});