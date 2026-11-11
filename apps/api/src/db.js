const mongoose = require("mongoose");

// Cached across invocations so a warm Vercel function reuses one connection.
let connecting = null;

function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!connecting) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");
    connecting = mongoose.connect(uri).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

module.exports = { connectDb };
