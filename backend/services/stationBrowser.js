const crypto = require("crypto");
const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const cookieName = tokenHash => `tracked_station_${tokenHash.slice(0,16)}`;
function setBrowserCookie(res, tokenHash, expiresAt) {
  const secret = crypto.randomBytes(32).toString("base64url");
  res.cookie(cookieName(tokenHash), secret, { httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/checkin", expires: expiresAt });
  return hash(secret);
}
function browserMatches(req, session) {
  if (!session.browserSecretHash) return false;
  const name = cookieName(session.tokenHash);
  const value = String(req.headers?.cookie || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length+1);
  if (!value) return false;
  const expected = Buffer.from(session.browserSecretHash, "hex"), actual = Buffer.from(hash(value), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
module.exports = { setBrowserCookie, browserMatches };
