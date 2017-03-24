/*
 - [ ] button to move next user in queue
 - [ ] Set custom queues for channel and update
 - [ ] Show Users blacklist
 - [ ] Blacklist a user
 - [ ] Remove user from blacklist
 - [ ] Custom announce message
*/

module.exports = {
  wesoClient: [
    'start',
    'stop',
    'next',
    'ban', // (userId, reasonStr)
    //'uploadAnnounceMessage' // blob
    //'setLiveChannel', // channelId
    //'setQueueChannel', // channelId
  ],
  wesoServer: [
    'register',
    'leave',
    'join',
  ],
}