(() => {
  'use strict';
  const form = document.querySelector('#contact-form');
  const inbox = document.querySelector('#contact-inbox');
  const messagesTab = document.querySelector('#tab-mesaje');
  if (!form && !inbox) return;
  let client = null, owner = false, offset = 0, generation = 0, sending = false;
  let unreadRequest = 0, unreadTimer;
  async function loadUnread(){
    if(!owner||!client||!messagesTab)return;
    const ticket=++unreadRequest;
    try{
      const {count,error}=await client.from('bg3ro_contact_messages').select('id',{count:'exact',head:true}).eq('is_read',false);
      if(ticket!==unreadRequest||!owner||error||!Number.isFinite(count))return;
      messagesTab.textContent=count>0?`Mesaje (${count})`:'Mesaje';
      messagesTab.setAttribute('aria-label',count>0?`Mesaje (${count} necitite)`:'Mesaje');
    }catch(_){/* Keep the last known count on transient network failures. */}
  }
  const pageSize = 20;
  const node = (tag, text, className) => { const el=document.createElement(tag); if(text!==undefined)el.textContent=text; if(className)el.className=className; return el; };
  function status(target,message,error=false){const el=target.querySelector('.form-status');el.textContent=message;el.classList.toggle('error',error);}
  function authChanged(detail){
    generation++; unreadRequest++;clearInterval(unreadTimer);client=detail.client;owner=detail.moderator===true;offset=0;
    if(messagesTab){messagesTab.textContent='Mesaje';messagesTab.setAttribute('aria-label','Mesaje');}
    if(form){
      form.querySelector('[type=submit]').disabled=!client||sending;
      if(!client)status(form,'Formularul este indisponibil momentan. Scrie la gabrielish@proton.me.',true);
      else if(form.querySelector('.form-status').textContent.startsWith('Se pregătește'))status(form,'');
    }
    if(inbox){inbox.hidden=!owner;inbox.querySelector('.contact-messages').replaceChildren();inbox.querySelector('[data-contact-summary]').textContent='';inbox.querySelector('[data-contact-pagination]').hidden=true;status(inbox,'');if(owner){loadInbox();loadUnread();unreadTimer=setInterval(()=>{if(!document.hidden)loadUnread();},60000);}}
  }
  async function loadInbox(){
    if(!client||!owner||!inbox)return;
    const request=++generation, activeClient=client;
    const list=inbox.querySelector('.contact-messages');
    status(inbox,'Se încarcă mesajele…');
    try{
      const {data,error,count}=await activeClient.from('bg3ro_contact_messages').select('id,name,email,subject,body,created_at,is_read',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize-1);
      if(request!==generation||!owner)return;
      if(error)throw error;
      if(offset>0&&offset>=(count||0)){offset=Math.max(0,(Math.ceil((count||0)/pageSize)-1)*pageSize);return loadInbox();}
      list.replaceChildren();
      for(const item of data||[]){
        const card=node('article',undefined,'contact-message');
        card.append(node('h3',(item.is_read?'':'Nou · ')+item.subject),node('p',item.name+' · '+item.email+' · '+new Date(item.created_at).toLocaleString('ro-RO'),'small'),node('p',item.body));
        const actions=node('div',undefined,'contact-actions');
        const reply=node('a','Răspunde prin e-mail','btn secondary');
        reply.href='mailto:'+encodeURIComponent(item.email)+'?subject='+encodeURIComponent('Re: '+item.subject);actions.append(reply);
        const read=node('button',item.is_read?'Marchează necitit':'Marchează citit','btn secondary');read.type='button';
        read.onclick=()=>change(read,()=>activeClient.from('bg3ro_contact_messages').update({is_read:!item.is_read}).eq('id',item.id).select('id'));
        const remove=node('button','Șterge','btn secondary');remove.type='button';
        remove.onclick=()=>{if(confirm('Ștergi definitiv acest mesaj de contact?'))change(remove,()=>activeClient.from('bg3ro_contact_messages').delete().eq('id',item.id).select('id'));};
        actions.append(read,remove);card.append(actions);list.append(card);
      }
      if(!data?.length)list.append(node('p','Nu există mesaje pe această pagină.'));
      inbox.querySelector('[data-contact-prev]').disabled=offset===0;
      inbox.querySelector('[data-contact-next]').disabled=offset+pageSize>=(count||0);
      const total=count||0, pages=Math.max(1,Math.ceil(total/pageSize));
      inbox.querySelector('[data-contact-summary]').textContent=total===0?'Niciun mesaj':total===1?'1 mesaj':total+' mesaje';
      inbox.querySelector('[data-contact-pagination]').hidden=pages<=1;
      inbox.querySelector('[data-contact-page]').textContent=(offset/pageSize+1)+' / '+pages;
      status(inbox,'');
      loadUnread();
    }catch(_){if(request===generation&&owner)status(inbox,'Mesajele nu au putut fi încărcate. Încearcă din nou.',true);}
  }
  async function change(button,action){
    if(!owner||button.disabled)return;button.disabled=true;const request=generation;
    try{const {data,error}=await action();if(error||!data?.length)throw error||new Error('Access denied');if(request!==generation||!owner)return;await loadInbox();}
    catch(_){if(request===generation&&owner)status(inbox,'Modificarea nu a reușit. Verifică sesiunea și încearcă din nou.',true);}
    finally{button.disabled=false;}
  }
  if(inbox){
    inbox.querySelector('[data-contact-refresh]').onclick=()=>loadInbox();
    inbox.querySelector('[data-contact-prev]').onclick=()=>{offset=Math.max(0,offset-pageSize);loadInbox();};
    inbox.querySelector('[data-contact-next]').onclick=()=>{offset+=pageSize;loadInbox();};
  }
  // Reuse the main page client, session and server-verified moderator state.
  addEventListener('bg3ro:auth',event=>authChanged(event.detail));
  addEventListener('bg3ro:tab',event=>{if(owner&&event.detail.id==='mesaje'){loadInbox();loadUnread();}});
  addEventListener('focus',()=>{if(owner)loadUnread();});
  document.addEventListener('visibilitychange',()=>{if(owner&&!document.hidden)loadUnread();});
  if(!form)return;
  const button=form.querySelector('[type=submit]');button.disabled=true;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(button.disabled||!client||!form.reportValidity())return;
    if(form.elements.website.value){status(form,'Trimiterea a fost blocată.',true);return;}
    sending=true;button.disabled=true;status(form,'Se trimite mesajul…');
    try{
      let {data,error}=await client.auth.getSession();if(error)throw error;
      if(!data.session){const result=await client.auth.signInAnonymously();if(result.error||!result.data.session)throw result.error||new Error('Guest unavailable');}
      const values=new FormData(form);
      const result=await client.from('bg3ro_contact_messages').insert(Object.fromEntries(['name','email','subject','body'].map(key=>[key,String(values.get(key)||'').trim()])));
      if(result.error)throw result.error;
      form.reset();status(form,'Mesajul a fost primit în căsuța privată a administratorului. Îți poate răspunde la adresa de e-mail indicată.');
      if(owner)await loadInbox();
    }catch(error){
      const limited=/60 de secunde|zilnic|rate|too many/i.test(error?.message||'');
      status(form,limited?'Ai trimis prea multe solicitări. Așteaptă cel puțin un minut; limita este de 3 mesaje în 24 de ore.':'Mesajul nu a fost trimis. Verifică internetul sau scrie direct la gabrielish@proton.me.',true);
    }finally{sending=false;button.disabled=!client;}
  });
})();
