const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const app = express();

admin.initializeApp(functions.config().firebase);

let db = admin.firestore();

app.use(cors({ origin: true }));

app.get('/hello-world', (req, res) => {
  return res.status(200).send('Hello World!');
}); 

app.post('/contact', (req, res) => {

    let docRef = db.collection('messages').doc();

    let newMessage = docRef.set({
        name: req.query.fullname,
        message: req.query.message,
        email: req.query.email,
        date: new Date()
    });

    return res.status(200).send('Thanks, I will get back to you ASAP')
})

exports.app = functions.https.onRequest(app);

// Original definition for API endpoint
// exports.helloWorld = functions.https.onRequest((request, response) => {
//     response.send("Hello from Firebase!");
//    });