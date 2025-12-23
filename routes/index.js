var express = require('express');
var router = express.Router();

// Notification route
router.use('/notifications', require('./notification'));
// Sessions route
router.use('/sessions', require('./sessions'));

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
