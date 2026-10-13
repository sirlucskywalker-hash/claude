/* Lazy on-device model. Raw frames are never sent to a network endpoint. */
let detector;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   const {FilesetResolver,PoseLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
   detector=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:.7,minPosePresenceConfidence:.7,outputSegmentationMasks:false});
   self.postMessage({id:data.id,ready:true});
  }else if(data.type==='frame'){
   if(!detector)throw Error('Model not ready');
   try{const result=detector.detect(data.bitmap);self.postMessage({id:data.id,landmarks:result.landmarks});}finally{data.bitmap.close();}
  }
 }catch{self.postMessage({id:data.id,error:'The AI model could not process this clip on this device. Your written assessment remains available.'});}
};
