// Dev only: point a seeded user at a real Google account so you can test Google sign-in as that user.
// Seeded users have synthetic <username>@example.com addresses, which no Google account owns.
// Run: npm run set-email -w api -- <username> <email>
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { User } = require("../models");

async function main() {
  if (process.env.AUTH_MODE !== "dev") throw new Error("Refusing to run: AUTH_MODE must be 'dev'");
  const [username, rawEmail] = process.argv.slice(2);
  const email = String(rawEmail || "").toLowerCase().trim();
  if (!username || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Usage: npm run set-email -w api -- <username> <email>");

  await connectDb();
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) throw new Error(`No user "${username}"`);
  const taken = await User.findOne({ email, _id: { $ne: user._id } }).lean();
  if (taken) throw new Error(`${email} already belongs to ${taken.username}`);

  user.email = email;
  await user.save();
  console.log(`${user.username} (${user.displayName}) now signs in with Google as ${email}.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
