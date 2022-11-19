const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('colors');
require('dotenv').config();
const app = express();

const port = process.env.PORT || 5000;

//* Middleware
app.use(cors());
app.use(express.json());

// verify jwt token
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const user = jwt.verify(token, process.env.ACCESS_TOKEN);
    // console.log(user);

    req.user = user;

    // IMP: Must call the next() function
    next();
  } catch (error) {
    res.status(403).send({ message: 'Forbidden Access' });
  }
};

app.get('/', (req, res) => {
  res.send('doctors portal server is running');
});

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
const usersCollection = client.db('doctorsPortal').collection('users');

/**
//* API Naming Convention
 * bookings
 * app.get('/bookings')
 * app.get('/bookings/:id')
 * app.post('/bookings')
 * app.patch('/bookings/:id)
 * app.delete('/bookings/:id')
 */

// Use Aggregate to query multiple collection and then merge data

//* GET (READ) {load available options from database}
app.get('/appointmentOptions', async (req, res) => {
  try {
    const date = req.query.date;
    // console.log(date);

    const query = {};
    const appointmentOptions = await appointmentOptionsCollection
      .find(query)
      .toArray();

    //*  IMP: get the bookings of the provided (Date)
    const bookingQuery = { appointmentDate: date };
    const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
    // console.log(alreadyBooked);

    // INFO: code carefully
    appointmentOptions.forEach((option) => {
      const optionBooked = alreadyBooked.filter(
        (book) => book.treatmentName === option.name
      );
      // console.log('optionBooked:', optionBooked);

      const bookedSlots = optionBooked.map((book) => book.selectedSlot);
      // console.log(date, option.name, 'bookedSlots:', bookedSlots);

      const remainingSlots = option.slots.filter(
        (slot) => !bookedSlots.includes(slot)
      );

      option.slots = remainingSlots;
      // console.log(date, option.name, 'remainingSlots:', remainingSlots.length);
    });

    res.send(appointmentOptions);
  } catch (error) {
    console.log(error.message);
  }
});

//* GET (READ) {get all bookings of a specific user using Email}
app.get('/bookings', verifyJWT, async (req, res) => {
  try {
    const email = req.query.email; // query kore pathano email
    const userEmail = req.user.email; // verified user email (jwt)

    if (email !== userEmail) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }

    const query = {
      email: email,
    };
    const bookings = await bookingsCollection.find(query).toArray();
    // console.log(bookings);
    res.send(bookings);
  } catch (error) {
    console.log(error.message);
  }
});

//* JWT Token {create JWT Token}
app.get('/jwt', async (req, res) => {
  const email = req.query.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);

  // if user is found in database than {create/assign a JWT token}.
  if (user) {
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
    return res.send({ accessToken: token });
  }

  res.status(403).send({ accessToken: '' });
});

//* GET (READ) {get all users for dashboard page}
app.get('/users', async (req, res) => {
  try {
    const query = {};
    const users = await usersCollection.find(query).toArray();
    res.send(users);
  } catch (error) {
    console.log(error.message.bold);
  }
});

//* GET (READ) {check if a specific user is an Admin or Not?}
// dynamic email
app.get('/users/admin/:email', async (req, res) => {
  const email = req.params.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  res.send({ isAdmin: user?.role === 'admin' });
});

//* POST (CREATE) {upload booking data }
app.post('/bookings', async (req, res) => {
  try {
    const booking = req.body;
    // console.log(booking);

    //* IMP: Limit one booking per user per treatment per day
    const query = {
      appointmentDate: booking.appointmentDate,
      email: booking.email,
      treatmentName: booking.treatmentName,
    };

    const alreadyBooked = await bookingsCollection.find(query).toArray();

    if (alreadyBooked.length) {
      const message = `You already have a booking on ${booking.appointmentDate}, on ${booking.treatmentName}.`;
      return res.send({
        acknowledged: false,
        message: message,
      });
    }

    const result = await bookingsCollection.insertOne(booking);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

//* POST (CREATE) {Save registered user information in the database}
app.post('/users', async (req, res) => {
  try {
    const user = req.body;
    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

//* PATCH (UPDATE) {update a specific user information. Give him an Admin role}
// dynamic id
app.put('/users/admin/:id', verifyJWT, async (req, res) => {
  const userEmail = req.user.email; // verified user email (jwt)
  const query = { email: userEmail };
  const user = await usersCollection.findOne(query);
  console.log(userEmail, user);

  // Checking if the user is an admin or not. If not, it will return a forbidden access message.
  if (user?.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden Access' });
  }

  // get id sent from client side
  const id = req.params.id;
  const filter = { _id: ObjectId(id) };
  const options = { upsert: true };
  const updatedUser = {
    $set: {
      role: 'admin',
    },
  };
  const result = await usersCollection.updateOne(filter, updatedUser, options);
  res.send(result);
});

app.listen(port, () => {
  console.log('Server up and running'.cyan.bold);
});
