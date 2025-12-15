// Start room status cron
require('./utils/roomStatusCron');
require('dotenv').config();
var express = require('express');
var cors = require('cors');
const mongoose = require('mongoose');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var googleRouter = require('./routes/google');
var hostProfileRouter = require('./routes/hostProfile');
var hostDashboardRouter = require('./routes/hostDashboard');
var enrollRouter = require('./routes/enroll');
var publicRoomsRouter = require('./routes/publicRooms');
var paymentsRouter = require('./routes/payments');
var roomsRouter = require('./routes/rooms');

var app = express();

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/google', googleRouter);
app.use('/api/host', hostProfileRouter);
app.use('/api/host', hostDashboardRouter);
app.use('/api/enroll', enrollRouter);
app.use('/api/public', publicRoomsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/rooms', roomsRouter);

// MongoDB connection with Mongoose
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB (Mongoose)'))
  .catch(err => console.error('Failed to connect to MongoDB (Mongoose):', err));

module.exports = app;
