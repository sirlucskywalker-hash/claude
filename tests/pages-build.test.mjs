import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,cp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),root=new URL('../',import.meta.url);
test('Pages build stages a working public app without repository, server or secret files',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'physiqueos-pages-'));
 try{
  const files=['index.html','admin.html','styles.css','cloud.css','coaching.css','data.js','app.js','cloud.js','admin.js','account-tools.js','coach-engine.js','coaching.js','manifest.webmanifest','sw.js','_headers','404.html'];
  await mkdir(join(temp,'scripts'));await mkdir(join(temp,'supabase'));
  await cp(new URL('scripts/build-pages.mjs',root),join(temp,'scripts/build-pages.mjs'));
  for(const file of files)await cp(new URL(file,root),join(temp,file));
  await cp(new URL('assets/',root),join(temp,'assets'),{recursive:true});
  await writeFile(join(temp,'.env'),'SECRET_SENTINEL=do-not-publish');await writeFile(join(temp,'supabase','private.sql'),'PRIVATE');
  await run(process.execPath,[join(temp,'scripts/build-pages.mjs')]);
  const out=join(temp,'dist-pages'),staged=await readdir(out);
  assert.equal(staged.includes('.env'),false);assert.equal(staged.includes('supabase'),false);assert.equal(staged.includes('scripts'),false);
  const index=await readFile(join(out,'index.html'),'utf8');
  for(const match of index.matchAll(/(?:src|href)="([^"#]+)"/g)){
   const path=match[1].split('?')[0];if(path.includes(':')||path.startsWith('/'))continue;
   await readFile(join(out,path));
  }
  const manifest=JSON.parse(await readFile(join(out,'manifest.webmanifest'),'utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
  for(const icon of manifest.icons)await readFile(join(out,icon.src));
  await writeFile(join(temp,'assets','unexpected.env'),'SECRET');
  await assert.rejects(()=>run(process.execPath,[join(temp,'scripts/build-pages.mjs')]),/Unexpected public asset/);
  assert.equal(await readFile(join(out,'admin.js'),'utf8'),await readFile(new URL('admin.js',root),'utf8'));
 }finally{await rm(temp,{recursive:true,force:true});}
});
