
const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-token');



router.get('/token', (req, res) => {
  try {
    const { channelName, role, uid } = req.query;
    if (!channelName || !role || !uid) {
      return res.status(400).json({ message: 'Missing parameters' });
    }
    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    let token;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        channelName,
        Number(uid),
        rtcRole,
        privilegeExpiredTs
      );
    } catch (tokenError) {
      console.error('Error generating token:', tokenError);
      return res.status(500).json({ message: 'Failed to generate token', error: String(tokenError) });
    }
    res.json({ token });
  } catch (error) {
    console.error('Token route error:', error);
    res.status(500).json({ message: 'Failed to generate token', error: String(error) });
  }
});

module.exports = router;
