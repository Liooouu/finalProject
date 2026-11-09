import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canPairFaceScans, faceScanSize } from '../src/utils/faceScanPair.js';
const first={token:'station',state:'open',mode:'time_in',at:1000};
test('slow inference can form a fresh two-frame confirmation',()=>{
 assert.equal(canPairFaceScans(first,{...first,at:5000}),true);
 assert.equal(canPairFaceScans(first,{...first,at:16000}),true);
});
test('expired, repeated, reversed or absent captures cannot form a pair',()=>{
 for(const at of [1000,999,16001])assert.equal(canPairFaceScans(first,{...first,at}),false);
 assert.equal(canPairFaceScans(null,{...first,at:5000}),false);
});
test('a changed station, arrival status or Time Out mode resets confirmation',()=>{
 for(const change of [{token:'other'},{state:'late'},{mode:'time_out'}])assert.equal(canPairFaceScans(first,{...first,at:5000,...change}),false);
});
test('camera inputs are bounded without stretching or upscaling the face',()=>{
 assert.deepEqual(faceScanSize(640,480),{width:640,height:480});
 assert.deepEqual(faceScanSize(1280,720),{width:640,height:360});
 assert.deepEqual(faceScanSize(1080,1920),{width:360,height:640});
 assert.deepEqual(faceScanSize(320,240),{width:320,height:240});
});
