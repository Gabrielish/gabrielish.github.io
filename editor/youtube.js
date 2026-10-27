import {Node} from '@tiptap/core';
const valid=id=>/^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
export function youtubeID(value){
 if(valid(value))return value;
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
  if(host==='youtu.be')return parts.length===1?valid(parts[0]):null;
  if(!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))return null;
  if(['embed','shorts','live'].includes(parts[0])&&parts.length===2)return valid(parts[1]);
  return url.pathname==='/watch'?valid(url.searchParams.get('v')):null;
 }catch{return null;}
}
export function youtubeHTML(id){
 id=valid(id);if(!id)return ['div',{'class':'discussion-video-invalid'}];
 return ['div',{'class':'discussion-video','data-youtube-id':id},['iframe',{
  src:'https://www.youtube-nocookie.com/embed/'+id+'?rel=0',title:'Videoclip YouTube',loading:'lazy',
  allow:'encrypted-media; picture-in-picture; fullscreen',allowfullscreen:'',referrerpolicy:'strict-origin-when-cross-origin'
 }]];
}
export function youtubeElement(id){const spec=youtubeHTML(id),wrap=document.createElement('div');if(!valid(id))return wrap;wrap.className='discussion-video';wrap.dataset.youtubeId=id;const frame=document.createElement('iframe');for(const[key,value]of Object.entries(spec[2][1]))frame.setAttribute(key,value);wrap.append(frame);return wrap;}
export const YouTube=Node.create({name:'youtube',group:'block',atom:true,draggable:true,
 addAttributes(){return{videoId:{default:null}};},
 parseHTML(){return[{tag:'div[data-youtube-id]',getAttrs:el=>valid(el.dataset.youtubeId)?{videoId:el.dataset.youtubeId}:false},{tag:'iframe[src]',getAttrs:el=>{const videoId=youtubeID(el.getAttribute('src'));return videoId?{videoId}:false;}}];},
 renderHTML({node}){return youtubeHTML(node.attrs.videoId);}
});
