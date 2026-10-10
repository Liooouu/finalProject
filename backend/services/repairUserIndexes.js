// One-off repairs for indexes that earlier schema definitions created.
//
// Removing `unique: true` from a schema does NOT drop the index it already
// built, so databases that ran the old code keep failing until it is removed.
// These run at boot so a deploy heals an existing database on its own; on a
// fresh database they are no-ops.
const User = require("../models/User");

// `trustedDeviceSchema.deviceId` used to be `unique: true`. On a subdocument
// path that is a collection-wide unique index, so every user with no trusted
// device indexed as `null` and only the first such user could exist — creating
// any second account (student registration or admin-created organizer) failed
// with E11000. Dropping it is safe: uniqueness within a user is enforced by
// User.trustDevice().
const STALE_INDEXES = ["trustedDevices.deviceId_1"];

async function repairUserIndexes({ log = console.log, error = console.error } = {}) {
  let indexes;
  try {
    indexes = await User.collection.indexes();
  } catch (err) {
    // A brand-new database has no collection yet — nothing to repair.
    return { dropped: [] };
  }

  const dropped = [];
  for (const name of STALE_INDEXES) {
    if (!indexes.some((index) => index.name === name)) continue;
    try {
      await User.collection.dropIndex(name);
      dropped.push(name);
      log(`[migrate] dropped stale index ${name}`);
    } catch (err) {
      // Losing the race with another replica booting at the same time is fine.
      error(`[migrate] could not drop index ${name}: ${err.message}`);
    }
  }

  return { dropped };
}

module.exports = { repairUserIndexes, STALE_INDEXES };
