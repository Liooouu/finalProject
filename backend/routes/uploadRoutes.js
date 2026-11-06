const router = require("express").Router();
const User = require("../models/User");
const fileStore = require("../services/fileStore");
router.get("/:filename",async(req,res)=>{
  const filename=req.params.filename;
  if(!/^[A-Za-z0-9._-]+$/.test(filename))return res.status(404).end();
  try{
    if(!await User.exists({profilePicture:`/uploads/${filename}`}))return res.status(404).end();
    await fileStore.sendFile(res,`/uploads/${filename}`,{cacheControl:"public, max-age=3600"});
  }catch(err){if(res.headersSent)return res.destroy(err);res.status(err.code==="FILE_NOT_FOUND"?404:503).end();}
});
module.exports=router;
