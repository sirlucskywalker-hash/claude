import {cp, mkdir, readdir, rm, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'dist-pages');
// Explicit public allowlist: never publish the repository root or server files.
const files=['index.html','admin.html','styles.css','cloud.css','coaching.css','data.js','app.js','cloud.js','admin.js','account-tools.js','coach-engine.js','coaching.js','manifest.webmanifest','sw.js','_headers','404.html'];
const assets=await readdir(join(root,'assets'),{withFileTypes:true});
for(const asset of assets){
 if(!asset.isFile()||! /\.(png|jpe?g|webp|svg|ico)$/i.test(asset.name)||asset.name.startsWith('.'))throw new Error(`Unexpected public asset: ${asset.name}`);
}
// Validate the complete source set before replacing the generated output.
for(const file of files)if(!(await stat(join(root,file))).isFile())throw new Error(`Missing public file: ${file}`);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of files)await cp(join(root,file),join(output,file));
await mkdir(join(output,'assets'));
for(const asset of assets)await cp(join(root,'assets',asset.name),join(output,'assets',asset.name));
console.log(`Cloudflare Pages output: dist-pages (${files.length+assets.length} files)`);
