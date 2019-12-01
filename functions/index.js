const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: true }));

app.get('/hello-world', (req, res) => {
  return res.status(200).send('Hello World!');
}); 

app.post('/contact', (req, res) => {
    console.log("Fullname: " + req.query.fullname);
    console.log("Email: " + req.query.email);
    console.log("Message: " + req.query.message);
    return res.status(200).send('Thanks, I will get back to you ASAP')
})

exports.app = functions.https.onRequest(app);

// Original definition for API endpoint
// exports.helloWorld = functions.https.onRequest((request, response) => {
//     response.send("Hello from Firebase!");
//    });