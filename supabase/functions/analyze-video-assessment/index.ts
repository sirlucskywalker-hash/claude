import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import '../../../assessment-engine.js';
import {createVideoAssessmentHandler} from '../_shared/video-assessment-handler.mjs';
Deno.serve(createVideoAssessmentHandler({env:(key:string)=>Deno.env.get(key),createClient,engine:(globalThis as any).PhysiqueAssessment}));
