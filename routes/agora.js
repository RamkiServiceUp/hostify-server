const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
require('dotenv').config();

const router = express.Router();

const config = require('../config/default');
const AGORA_APP_ID = config.agora.appId;
const AGORA_APP_CERTIFICATE = config.agora.certificate;

// POST /api/agora/token
router.post('/token', (req, res) => {
  const { channelName, uid, role = 'audience' } = req.body;
  if (!channelName || !uid) {
    return res.status(400).json({ error: 'channelName and uid are required' });
  }
  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    return res.status(500).json({ error: 'Agora appId or certificate not set in server config' });
  }
  const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireTimeSeconds = 3600; // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = currentTimestamp + expireTimeSeconds;
  const numericUid = Number(uid);
  if (isNaN(numericUid)) {
    return res.status(400).json({ error: 'UID must be a number' });
  }
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    numericUid,
    agoraRole,
    privilegeExpireTs
  );
  res.json({ token });
});

module.exports = router;
