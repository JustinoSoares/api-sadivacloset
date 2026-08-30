module.exports.v4 = () => 'test-uuid-' + Math.random().toString(36).substring(2, 10);
module.exports.default = { v4: module.exports.v4 };
