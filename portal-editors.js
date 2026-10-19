(() => {
  'use strict';
  let client, moderator = false, sequence = 0;
  const dialogs = new Set();
  function pencil(title) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'edit-pencil';
    button.setAttribute('aria-label', title); button.title = title;
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg>';
    return button;
  }
  function mount(source, title, heading) {
    for (const dialog of dialogs) if (!dialog.isConnected) dialogs.delete(dialog);
    const wrap = document.createElement('div');
    wrap.className = 'edit-control'; wrap.id = source.id; wrap.hidden = source.hidden;
    const button = pencil(title), dialog = document.createElement('dialog');
    dialog.className = 'edit-dialog'; dialog.id = `edit-dialog-${++sequence}`;
    const header = document.createElement('div'); header.className = 'dialog-title';
    const label = document.createElement('h2'); label.id = `${dialog.id}-title`; label.textContent = title;
    dialog.setAttribute('aria-labelledby', label.id);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'dialog-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Închide editarea');
    header.append(label, close); dialog.append(header);
    [...source.children].filter(node => node.tagName !== 'SUMMARY').forEach(node => dialog.append(node));
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', dialog.id);
    button.addEventListener('click', () => { if (moderator) dialog.showModal(); });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { if (button.isConnected && !wrap.hidden) button.focus({preventScroll:true}); });
    wrap.append(button, dialog); source.replaceWith(wrap); dialogs.add(dialog);
    if (heading) {
      const row = heading.parentElement.classList.contains('card-header') ? heading.parentElement : document.createElement('div');
      if (!row.classList.contains('card-header')) { row.className = 'card-header'; heading.before(row); row.append(heading); }
      row.classList.add('editable-header');
      row.append(wrap);
    }
    return wrap;
  }
  window.BG3RO_EDITORS = { mount };
  const progress = mount(document.querySelector('#progress-form').closest('details'), 'Editează progresul traducerii', document.querySelector('.progress-card h2'));
  progress.id = 'progress-editor'; progress.hidden = true;
  mount(document.querySelector('#work-editor'), 'Editează secțiunea', document.querySelector('#current-work-title'));
  document.querySelectorAll('#admin-tools > details').forEach(source => {
    const title = source.querySelector('summary').textContent;
    const control = mount(source, title);
    const button = control.querySelector('button');
    button.className = 'btn'; button.replaceChildren(document.createTextNode(title));
  });

  const about = document.querySelector('.about-copy'), heading = about.querySelector('h2'), paragraphs = [...about.querySelectorAll('p:not(.note)')], note = about.querySelector('.note');
  const body = document.createElement('div'); body.id = 'about-project-body'; paragraphs[0].before(body); paragraphs.forEach(p => body.append(p));
  const source = document.createElement('div'); source.hidden = true; source.id = 'about-editor';
  const form = document.createElement('form'); form.id = 'about-form';
  const fields = [ ['about_title','Titlu',120,heading.textContent], ['about_body','Despre proiect',12000,paragraphs.map(p=>p.textContent).join('\n\n')], ['about_note','Notă (opțională)',2000,note.textContent] ];
  fields.forEach(([name,title,max,value]) => {
    const field = document.createElement('div'); field.className = 'field';
    const label = document.createElement('label'); label.htmlFor = name; label.textContent = title;
    const input = document.createElement(name === 'about_title' ? 'input' : 'textarea'); input.id = name; input.name = name; input.maxLength = max; input.required = name !== 'about_note'; input.value = value;
    field.append(label,input); form.append(field);
  });
  const save = document.createElement('button'); save.type = 'submit'; save.className = 'btn'; save.textContent = 'Salvează modificările';
  const status = document.createElement('p'); status.className = 'form-status'; status.setAttribute('role','status'); form.append(save,status); source.append(form); about.append(source);
  const aboutEditor = mount(source,'Editează Despre proiect',heading);
  let dirty = false, revision = 0;
  form.addEventListener('input',()=>dirty=true);
  function render(data) {
    if (typeof data.about_title === 'string') heading.textContent = data.about_title;
    if (typeof data.about_body === 'string') {
      body.replaceChildren(...data.about_body.split(/\n\s*\n/).map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
    }
    if (typeof data.about_note === 'string') {note.textContent=data.about_note;note.hidden=!data.about_note.trim();}
    if (!dirty) fields.forEach(([name])=>{if(typeof data[name]==='string')form.elements[name].value=data[name];});
  }
  async function loadAbout() {
    const ticket=++revision;
    const {data,error}=await client.from('bg3ro_project_status').select('about_title,about_body,about_note').eq('id',1).maybeSingle();
    if(ticket===revision&&!error&&data)render(data);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!client||!moderator||save.disabled)return;
    save.disabled=true;status.textContent='Se salvează…';
    try {
      const values=Object.fromEntries([...new FormData(form)].map(([k,v])=>[k,v.trim()]));
      const {data,error}=await client.from('bg3ro_project_status').update(values).eq('id',1).select('about_title,about_body,about_note').maybeSingle();
      if(error||!data)throw error||new Error('Not saved');
      dirty=false;render(data);status.textContent='Modificările au fost salvate.';
    }catch(_){status.textContent='Modificările nu au fost salvate. Verifică legătura și reîncearcă.';}
    finally{save.disabled=false;}
  });
  window.addEventListener('bg3ro:auth',event=>{
    client=event.detail.client;moderator=event.detail.moderator===true;
    progress.hidden=aboutEditor.hidden=!moderator;
    document.querySelector('#work-editor').hidden=!moderator;
    if(!moderator){dirty=false;for(const dialog of dialogs){if(dialog.open)dialog.close();if(!dialog.isConnected)dialogs.delete(dialog);}}
    if(client)loadAbout();
  });
})();
