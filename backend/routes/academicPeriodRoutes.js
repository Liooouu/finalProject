const router=require("express").Router();
const {protect,authorize}=require("../middleware/authMiddleware");
const periods=require("../services/academicPeriods");
router.use(protect);
const handle=action=>async(req,res)=>{try{res.set("Cache-Control","no-store");res.json(await action(req));}catch(e){res.status(e.status||503).json({message:e.status?e.message:"Could not load or save school terms. Please try again."});}};
router.get("/",handle(()=>periods.read()));
router.post("/years",authorize("admin"),handle(req=>periods.addYear(req.body.startYear,req.user._id)));
router.put("/current",authorize("admin"),handle(req=>periods.setCurrent(req.body,req.user._id)));
module.exports=router;
