import fs from 'node:fs';
import path from 'node:path';

const pages=path.resolve(import.meta.dirname,'../pages');
const catalog=JSON.parse(fs.readFileSync(path.join(pages,'catalog.json'),'utf8'));
const file=path.join(pages,'audio-sites.json');
const sites=JSON.parse(fs.readFileSync(file,'utf8'));
const shards={
  main_0:'vot-audio-20190430',
  main_1:'vot-audio-20190430',
  main_2:'vot-audio-20190430',
  main_3:'vot-audio-20190430',
  main_4:'vot-audio-20190430',
  main_5:'vot-audio-20190709',
  main_6:'vot-audio-20191224',
  main_7:'vot-audio-20200501',
  main_8:'vot-audio-20201101',
};

for(const [groupId,shard] of Object.entries(shards)){
  const group=catalog.find(item=>item.id===groupId);
  if(!group?.chapters.length)throw Error(`Missing ${groupId}`);
  const url=`https://luoul-123.github.io/${shard}/`;
  for(const chapter of group.chapters){
    if(sites.chapters[chapter.id]&&sites.chapters[chapter.id]!==url)
      throw Error(`Conflicting audio site for ${chapter.id}`);
    sites.chapters[chapter.id]=url;
  }
}
fs.writeFileSync(file,JSON.stringify(sites,null,2)+'\n');
console.log(`Configured ${Object.keys(sites.chapters).length} chapter mappings for main 0–8`);
