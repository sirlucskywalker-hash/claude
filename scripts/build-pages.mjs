import {cp, mkdir, readdir, rm, stat, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'dist-pages');
const productionUrl='https://oyrtpvtzaoftinqoossn.supabase.co';
const productionKey='sb_publishable_O4RTSpXiy-wpOkpjo8a5tg_pfjw4VBc';
const environment=process.env.PHYSIQUEOS_BUILD_ENV||'production';
const backendUrl=process.env.PHYSIQUEOS_STAGING_SUPABASE_URL;
const publishableKey=process.env.PHYSIQUEOS_STAGING_SUPABASE_KEY;
if(!['production','staging'].includes(environment))throw new Error('Unknown PhysiqueOS build environment');
if(environment==='production'&&(backendUrl||publishableKey))throw new Error('Staging values require an explicit staging build');
if(environment==='staging'){
 if(!/^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(backendUrl||'')||new URL(backendUrl).origin===productionUrl)throw new Error('Staging requires a separate Supabase project');
 if(!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey||'')||publishableKey===productionKey)throw new Error('Staging requires its own browser-safe publishable key');
}
// Explicit public allowlist: never publish the repository root or server files.
const files=['index.html','safety.html','admin.html','coaches.html','coach-workspace.js','styles.css','cloud.css','coaching.css','data.js','app.js','cloud.js','admin.js','account-tools.js','coach-engine.js','coaching.js','assessment-engine.js','assessment.js','assessment-worker.js','manifest.webmanifest','sw.js','_headers','404.html'];
const assets=await readdir(join(root,'assets'),{withFileTypes:true});
for(const asset of assets){
 if(!asset.isFile()||! /\.(png|jpe?g|webp|svg|ico)$/i.test(asset.name)||asset.name.startsWith('.'))throw new Error(`Unexpected public asset: ${asset.name}`);
}
// Validate the complete source set before replacing the generated output.
for(const file of files)if(!(await stat(join(root,file))).isFile())throw new Error(`Missing public file: ${file}`);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of files)await cp(join(root,file),join(output,file));
if(environment==='staging'){
 const origin=new URL(backendUrl).origin;
 // Rewrite the deployment artifact only, including the email-link origin validator.
 for(const file of ['cloud.js','admin.js','coach-workspace.js']){
  const path=join(output,file),source=await readFile(path,'utf8');
  if(!source.includes(productionUrl)||!source.includes(productionKey))throw new Error('Expected backend configuration missing from '+file);
  await writeFile(path,source.replaceAll(productionUrl,origin).replaceAll(productionKey,publishableKey));
 }
 for(const file of ['index.html','admin.html','coaches.html']){
  const path=join(output,file),source=await readFile(path,'utf8');
  await writeFile(path,source.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>').replace('<body>','<body><aside role="status" style="padding:12px;background:#53380b;color:#fff;text-align:center">PhysiqueOS staging · synthetic test data only</aside>'));
 }
 await writeFile(join(output,'_headers'),(await readFile(join(output,'_headers'),'utf8')).trimEnd()+'\n  X-Robots-Tag: noindex, nofollow\n');
}
await mkdir(join(output,'assets'));
for(const asset of assets)await cp(join(root,'assets',asset.name),join(output,'assets',asset.name));
console.log(`Cloudflare Pages output: dist-pages (${files.length+assets.length} files; ${environment})`);
