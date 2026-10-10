const { isOwner: checkOwner } = require('../../utils/storage');

function isOwner(channelId, userId) {
    return checkOwner(channelId, userId);
}

module.exports = { isOwner };
