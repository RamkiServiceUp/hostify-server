var calendarRouter = require('./routes/calendar');
// Start room status cron (legacy, can be removed after migration)
require('./utils/roomStatusCron');
// Start Bull-based room status queue for robust scheduling
try {
  require('./utils/roomStatusQueue').scheduleSessionJobs();
} catch (e) {
  console.warn('Bull queue not started:', e.message);
}
require('dotenv').config();
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
var notificationRouter = require('./routes/notification');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var googleRouter = require('./routes/google');
var hostProfileRouter = require('./routes/hostProfile');
var hostDashboardRouter = require('./routes/hostDashboard');
// var enrollRouter = require('./routes/enroll');
var enrollmentsRouter = require('./routes/enrollments');
var publicRoomsRouter = require('./routes/publicRooms');
var paymentsRouter = require('./routes/payments');
var roomsRouter = require('./routes/rooms');
var userDashboardRouter = require('./routes/userDashboard');
var chatroomsRouter = require('./routes/chatrooms');
var agoraRouter = require('./routes/agora');
var reportRouter = require('./routes/report');
var feedbackRouter = require('./routes/feedback');
var sessionsRouter = require('./routes/sessions');
var app = express();

// Enable CORS for frontend (allow both Vite and React dev servers)
app.use(cors({
  origin: [
    'https://hostify-server.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://hostify-client.vercel.app'
  ],
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/api/notifications', notificationRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/google', googleRouter);
app.use('/api/host', hostProfileRouter);
app.use('/api/host', hostDashboardRouter);
// app.use('/api/enroll', enrollRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/public', publicRoomsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/report', reportRouter);
app.use('/api/agora', agoraRouter);

app.use('/api/calendar', calendarRouter);

app.use('/api/chatrooms', chatroomsRouter);

app.use('/api/user', userDashboardRouter);

// MongoDB connection with Mongoose

// Note: agoraSocket (socket.io and token API) is registered in bin/www
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB (Mongoose)'))
  .catch(err => console.error('Failed to connect to MongoDB (Mongoose):', err));

module.exports = app;
