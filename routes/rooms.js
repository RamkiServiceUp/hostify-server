const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { Room, Session } = require('../models/Room');
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const router = express.Router();

// Multer setup for banner image upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// GET /api/rooms/host/:hostId - get all rooms for a host
router.get('/host/:hostId', auth, authorize('host'), async (req, res) => {
	try {
		const { hostId } = req.params;
		const rooms = await Room.find({ hostId });
		res.json({ rooms });
	} catch (err) {
		res.status(500).json({ message: err.message || 'Failed to fetch rooms' });
	}
});

// POST /api/rooms - create a new room with sessions and banner (host only)
const User = require('../models/User');
router.post('/', auth, authorize('host'), upload.single('banner'), async (req, res) => {
	try {
		const { title, description, category, price, seatsAvailable, sessions, startDateTime, endDateTime, hostId, isPrivate } = req.body;
		if (!title || !description || !price || !seatsAvailable || !req.file || !sessions || !hostId) {
			return res.status(400).json({ message: 'Missing required fields' });
		}
		// Fetch hostName from User model
		let hostName = '';
		try {
			const hostUser = await User.findById(hostId).select('name');
			hostName = hostUser ? hostUser.name : '';
		} catch {
			hostName = '';
		}
		// Parse sessions JSON
		let sessionArr = [];
		try {
			sessionArr = JSON.parse(sessions);
		} catch {
			return res.status(400).json({ message: 'Invalid sessions format' });
		}
		// Create Room (banner as Buffer for now)
		const room = new Room({
			title,
			description,
			category,
			price,
			seatsAvailable,
			banner: req.file.buffer,
			hostId,
			hostName,
			startDateTime,
			endDateTime,
			sessions: [],
			isPrivate: isPrivate === 'true' || isPrivate === true,
		});
		await room.save();
		// Create sessions and link to room
		const sessionDocs = await Promise.all(sessionArr.map(async (s) => {
			const session = new Session({
				roomId: room._id,
				name: s.name || room.title,
				description: s.description || room.description,
				startDateTime: new Date(`${s.date}T${s.startTime}`),
				endDateTime: new Date(`${s.date}T${s.endTime}`),
			});
			await session.save();
			return session._id;
		}));
		room.sessions = sessionDocs;
		await room.save();
		res.status(201).json({ room });
	} catch (err) {
		res.status(500).json({ message: err.message || 'Failed to create room' });
	}
});

// GET /api/rooms/active - get all active/live rooms (public)
router.get('/active', async (req, res) => {
  try {
    // Find rooms with status 'live' or 'active'
    const rooms = await Room.find({ status: { $in: ['live', 'active'] } });
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch active rooms' });
  }
});

// GET /api/rooms/:roomId - get a room by its ID
router.get('/:roomId', auth, async (req, res) => {
       try {
	       const room = await Room.findById(req.params.roomId)
		       .populate({
			       path: 'sessions',
			       model: 'Session',
			       populate: { path: 'attendees', model: 'User', select: 'name email' },
		       });
	       if (!room) return res.status(404).json({ message: 'Room not found' });
	       res.json(room);
       } catch (err) {
	       res.status(500).json({ message: err.message || 'Failed to fetch room' });
       }
});

// DELETE /api/rooms/:roomId - delete a room by its ID (host only)
router.delete('/:roomId', auth, authorize('host'), async (req, res) => {
       try {
	       const room = await Room.findByIdAndDelete(req.params.roomId);
	       if (!room) return res.status(404).json({ message: 'Room not found' });
	       // Optionally, delete associated sessions
	       await Session.deleteMany({ roomId: req.params.roomId });
	       res.json({ message: 'Room deleted successfully' });
       } catch (err) {
	       res.status(500).json({ message: err.message || 'Failed to delete room' });
       }
});

// GET /api/rooms/not-enrolled - get all rooms the current user is NOT enrolled in
router.get('/not-enrolled', auth, async (req, res) => {
	try {
		const userId = req.user._id;
		// Find rooms where enrolledUsers does NOT include the current user
		const rooms = await Room.find({
			$or: [
				{ enrolledUsers: { $exists: false } },
				{ enrolledUsers: { $ne: userId } }
			]
		});
		res.json({ rooms });
	} catch (err) {
		res.status(500).json({ message: err.message || 'Failed to fetch not-enrolled rooms' });
	}
});

// GET /api/rooms/active - get all active/live rooms (public)
router.get('/active', async (req, res) => {
  try {
    // Find rooms with status 'live' or 'active'
    const rooms = await Room.find({ status: { $in: ['live', 'active'] } });
    res.json({ rooms });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch active rooms' });
  }
});

router.patch('/:id/go-live', auth, authorize('host'), async (req, res) => {
	try {
		const { id } = req.params;
		const { channelName, hostUid } = req.body;
		const room = await Room.findByIdAndUpdate(
			id,
			{
				status: 'live',
				channelName,
				hostUid
			},
			{ new: true }
		);
		if (!room) return res.status(404).json({ message: 'Room not found' });
		res.json(room);
	} catch (err) {
		res.status(500).json({ message: err.message || 'Failed to go live' });
	}
});

module.exports = router;



