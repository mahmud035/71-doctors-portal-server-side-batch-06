const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('colors');
require('dotenv').config();
const app = express();

const port = process.env.PORT || 5000;

//* Middleware
app.use(cors());
app.use(express.json());

//* Mongodb Atlas
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yeflywl.mongodb.net/?retryWrites=true&w=majority`;

// console.log(uri);

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const dbConnect = async () => {
  try {
    await client.connect();
    console.log('Database connected'.yellow.italic);
  } catch (error) {
    console.log(error.name.bgRed, error.message.bold);
  }
};

dbConnect();

//* Collection
const appointmentOptionsCollection = client
  .db('doctorsPortal')
  .collection('appointmentOptions');
const bookingsCollection = client.db('doctorsPortal').collection('bookings');

/**
//* API Naming Convention
 * bookings
 * app.get('/bookings')
 * app.get('/bookings/:id')
 * app.post('/bookings')
 * app.patch('/bookings/:id)
 * app.delete('/bookings/:id')
 */

//* GET (READ) {load available options from database}
app.get('/appointmentOptions', async (req, res) => {
  try {
    const query = {};
    const cursor = appointmentOptionsCollection.find(query);
    const appointmentOptions = await cursor.toArray();
    res.send(appointmentOptions);
  } catch (error) {
    console.log(error.message);
  }
});

//* POST (CREATE) {upload booking data }
app.post('/bookings', async (req, res) => {
  try {
    const booking = req.body;
    const result = await bookingsCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

app.get('/', (req, res) => {
  res.send('doctors portal server is running');
});

app.listen(port, () => {
  console.log('Server up and running'.cyan.bold);
});
