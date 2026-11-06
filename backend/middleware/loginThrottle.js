const buckets = new Map();
const WINDOW = 15 * 60 * 1000;
function loginThrottle(req,res,next) {
  const key = `${req.ip || "local"}:${String(req.body?.email || "").trim().toLowerCase()}`;
  const now = Date.now();
  if(buckets.size>=5000)for(const [id,times]of buckets)if(now-times.at(-1)>WINDOW)buckets.delete(id);
  if(buckets.size>=10000&&!buckets.has(key))return res.status(429).json({message:"Sign-in is busy. Please try again shortly."});
  const attempts = (buckets.get(key)||[]).filter(time => now-time<WINDOW);
  if (attempts.length >= 10) { res.set("Retry-After",String(Math.ceil((WINDOW-(now-attempts[0]))/1000))); return res.status(429).json({message:"Too many sign-in attempts. Wait a few minutes or use Forgot Password."}); }
  attempts.push(now);buckets.set(key,attempts);
  req.clearLoginAttempts=()=>buckets.delete(key);
  next();
}
module.exports={loginThrottle};
