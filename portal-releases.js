(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const fields =
    "id,author_name,author_avatar_url,kind,version,title,file_name,file_bytes,download_url,tags,description,published_at,news_title,news_body,news_badge,platform,is_visible,is_deleted,news_is_visible";
  const kinds = {
    translation: "Traducerea în limba română",
    search: "Căutare fără diacritice",
    item_gender: "Acordul etichetelor obiectelor",
    combat_log: "Jurnalul de luptă",
  };
  let client = null,
    moderator = false,
    rows = [],
    request = 0,
    editorSequence = 0;
  const richEditors=new Map(),platforms={all:'Windows și macOS',windows:'Windows',macos:'macOS'};
  let publishAPI=null;
  const platformOf=row=>row.platform||(/windows/i.test(row.tags||'')&&!/mac\s?os/i.test(row.tags||'')?'windows':/mac\s?os/i.test(row.tags||'')&&!/windows/i.test(row.tags||'')?'macos':'all');
  function disposeEditors(){for(const [form,api]of richEditors){api.destroy();form.remove();}richEditors.clear();}
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function authorAvatar(row) {
    const image = el("img", "post-avatar release-author-avatar");
    const remote = /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\/(avatars\/[0-9]+\/[A-Za-z0-9_]+\.(png|jpg|jpeg|webp|gif)|embed\/avatars\/[0-9]+\.png)(\?size=[0-9]+)?$/.test(row.author_avatar_url || "");
    image.src = remote ? row.author_avatar_url : "./assets/discussion-avatar.svg";
    image.classList.toggle("post-avatar-default", !remote);
    image.alt = ""; image.width = 44; image.height = 44; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
    if (remote) image.addEventListener("error", () => { image.classList.add("post-avatar-default"); image.src = "./assets/discussion-avatar.svg"; }, { once: true });
    return window.BG3RO_AVATAR_BADGE(image,true);
  }
  function date(value) {
    return new Date(value).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  async function uploadArchive(file, status, platform, releaseId=null) {
    if (
      !file ||
      !/\.(zip|7z|rar)$/i.test(file.name) ||
      file.size > 20 * 1048576 ||
      !file.size
    )
      throw Error("Alege o arhivă ZIP, 7z sau RAR de maximum 20 MB.");
    const check=await client.from('bg3ro_releases').select('id,platform,file_name,tags').eq('file_name',file.name).eq('is_deleted',false);
    if(check.error)throw Error('Nu pot verifica arhivele existente. Încearcă din nou.');
    if((check.data||[]).some(row=>row.id!==releaseId&&platformOf(row)!==platform))throw Error('Acest nume este folosit de altă platformă. Folosește un nume diferit pentru arhiva Windows/macOS.');
    status.textContent = "Se încarcă arhiva în GitHub… Nu închide pagina.";
    const result = await client.functions.invoke("bg3ro-upload", {
      body: file,
      headers: {
        "Content-Type": "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
    });
    if (result.error) {
      let message = "Încărcarea nu a reușit. Versiunea nu a fost publicată.";
      try {
        const response = await result.error.context.json();
        if (response.message) message = response.message;
      } catch (_) {}
      throw Error(message);
    }
    const data = result.data;
    if (
      !data ||
      !archiveURL(data.download_url) ||
      data.file_name !== file.name ||
      data.file_bytes !== file.size
    )
      throw Error("Confirmarea încărcării nu este validă.");
    status.textContent = data.message;
    return data;
  }
  function archiveURL(value) {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        ((u.hostname === "github.com" &&
          u.pathname.startsWith("/Gabrielish/bg3ro/releases/download/")) ||
          (u.hostname === "raw.githubusercontent.com" &&
            /^\/Gabrielish\/bg3ro\/(main|[a-f0-9]{40})\/Baldur's%20Gate%203%20Romanian%20Translate\//.test(
              u.pathname,
            )))
      );
    } catch (_) {
      return false;
    }
  }
  function outlineIcon(paths, size = 16) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [key, value] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" })) svg.setAttribute(key, value);
    paths.forEach(d => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d); svg.append(path);
    });
    return svg;
  }
  function download(row, featured = false) {
    if (!archiveURL(row.download_url))
      return el("span", "small", "Fișier indisponibil");
    const a = el("a", featured ? "btn release-download" : "btn");
    if (featured) {
      const format = /\.(zip|rar|7z)$/i.exec(row.file_name)?.[1].toUpperCase();
      a.append(outlineIcon(["M12 3v12m-5-5 5 5 5-5", "M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"]), el("span", "", format ? `Descarcă fișier ${format}` : "Descarcă fișier"));
    } else a.textContent = "Descarcă arhiva";
    a.href = row.download_url;
    a.download = row.file_name;
    a.dataset.releaseId = row.id;
    return a;
  }
  function tags(row) {
    const group = el("div", "release-tags");
    [
      row.version,
      platforms[platformOf(row)],
      ...row.tags
        .split(",")
        .map((t) => t.trim())
        .filter(t=>t&&!/^(windows|mac\s?os)$/i.test(t)),
      date(row.published_at),
    ].forEach((t) => group.append(el("span", "release-tag", t)));
    return group;
  }
  function action(label,path,callback){const button=el('button','btn release-admin-action');button.type='button';button.append(outlineIcon([path]),el('span','',label));button.onclick=callback;return button;}
  function field(parent,name,label,value,max=160,type='text'){
    const wrap=el('div','field'),caption=el('label','',label),input=el(type==='textarea'?'textarea':'input');input.id='release-field-'+(++editorSequence);input.name=name;input.value=value||'';input.maxLength=max;if(type!=='textarea')input.type=type;input.required=name==='title'||name==='description';caption.htmlFor=input.id;wrap.append(caption,input);parent.append(wrap);return input;
  }
  function platformField(parent,value){const wrap=el('div','field'),label=el('label','','Platformă'),select=el('select');select.id='release-platform-'+(++editorSequence);select.name='platform';for(const [key,text]of Object.entries(platforms)){const option=el('option','',text);option.value=key;select.append(option);}select.value=value;label.htmlFor=select.id;wrap.append(label,select);parent.append(wrap);return select;}
  function filePicker(input){input.classList.add('release-archive-input');input.tabIndex=-1;const choose=el('button','btn secondary small-btn','Alege arhiva'),name=el('span','release-selected-file','Niciun fișier ales'),row=el('div','release-file-picker');choose.type='button';choose.setAttribute('aria-controls',input.id);choose.onclick=()=>input.click();input.addEventListener('change',()=>name.textContent=input.files[0]?.name||'Niciun fișier ales');row.append(choose,name);input.after(row);return choose;}
  function editor(row,article,trigger){
    if([...richEditors.keys()].some(form=>form.inert))return;
    if(article.querySelector('.release-inline-editor')){article.querySelector('.release-inline-editor [name=title]').focus();return;}
    if([...richEditors.keys()].some(form=>form.dataset.dirty==='true')&&!confirm('Renunți la modificările nesalvate?'))return;disposeEditors();
    const form=el('form','release-inline-editor'),top=el('div','release-fields-row');form.setAttribute('aria-label','Editează '+row.title);form.append(top);field(top,'title','Titlu',row.title);const platform=platformField(top,platformOf(row));field(form,'tags','Taguri',row.tags,240);const description=field(form,'description',row.kind==='translation'?'Ce este nou în această versiune':'Descriere',row.description,12000,'textarea');
    const end=el('div','form-end'),save=el('button','btn','Salvează'),cancel=el('button','btn release-cancel','Anulează'),status=el('p','form-status');save.type='submit';cancel.type='button';status.setAttribute('role','status');end.append(cancel,save);form.append(end,status);
    const replacement=el('div','release-replacement'),file=el('input'),label=el('label','','Înlocuiește arhiva acestei versiuni'),replace=el('button','btn secondary small-btn','Încarcă și înlocuiește fișierul'),uploadStatus=el('p','form-status');file.id='replace-archive-'+(++editorSequence);file.type='file';file.accept='.zip,.7z,.rar';label.htmlFor=file.id;replace.type='button';uploadStatus.setAttribute('role','status');replacement.append(label,file,el('p','small','Folosește nume diferite pentru arhivele Windows și macOS. Înlocuirea actualizează fișierul, fără să publice o versiune nouă.'),replace,uploadStatus);filePicker(file);form.append(replacement);article.append(form);
    if(!window.BG3RO_MOUNT_CONTENT_EDITOR){form.remove();$('#release-load-status').textContent='Editorul nu s-a încărcat. Reîncarcă pagina.';return;}
    const api=window.BG3RO_MOUNT_CONTENT_EDITOR(form,description,{minimum:1,label:'Descrierea versiunii',placeholder:'Descrie versiunea…'});richEditors.set(form,api);form.addEventListener('input',()=>form.dataset.dirty='true');api.editor.on('update',()=>form.dataset.dirty='true');
    cancel.onclick=()=>{if(save.disabled||replace.disabled)return;api.destroy();richEditors.delete(form);form.remove();trigger.focus({preventScroll:true});};
    form.onsubmit=async event=>{event.preventDefault();if(!client||!moderator||save.disabled)return;const active=client;let values;try{values={title:form.elements.title.value.trim(),tags:form.elements.tags.value.trim(),platform:platform.value,description:api.value()};if(!values.title)throw Error('Completează titlul.');}catch(error){status.classList.add('error');status.textContent=error.message;return;}form.inert=true;save.disabled=cancel.disabled=replace.disabled=true;status.classList.remove('error');status.textContent='Se salvează…';
      try{const result=await active.from('bg3ro_releases').update(values).eq('id',row.id).select('id');if(result.error||!result.data?.length)throw Error();if(client===active&&moderator)await load();}catch{status.classList.add('error');status.textContent='Modificările nu au fost salvate. Textul a fost păstrat; încearcă din nou.';}finally{form.inert=false;save.disabled=cancel.disabled=replace.disabled=false;}};
    replace.onclick=async()=>{if(!client||!moderator||replace.disabled)return;const active=client;form.inert=true;save.disabled=cancel.disabled=replace.disabled=true;uploadStatus.classList.remove('error');try{if(platform.value!==platformOf(row))throw Error('Salvează mai întâi schimbarea platformei, apoi înlocuiește arhiva.');const data=await uploadArchive(file.files[0],uploadStatus,platform.value,row.id);if(client!==active||!moderator)throw Error('Sesiunea s-a schimbat. Reconectează-te pentru a salva legătura arhivei.');const result=await active.from('bg3ro_releases').update({file_name:data.file_name,file_bytes:data.file_bytes,download_url:data.download_url}).eq('id',row.id).select('id');if(result.error||!result.data?.length)throw Error('Arhiva este pe GitHub, dar legătura versiunii nu a fost salvată. Reîncearcă înlocuirea.');Object.assign(row,data);article.querySelector('.release-download')?.replaceWith(download(row,true));article.querySelector('.release-file').textContent=`${row.file_name} · ${new Intl.NumberFormat('ro-RO',{maximumFractionDigits:1}).format(row.file_bytes/1048576)} MB`;if($('#github-quick-download').dataset.releaseId===row.id){$('#github-quick-download').href=row.download_url;$('#github-quick-download').download=row.file_name;}uploadStatus.textContent='Arhiva a fost înlocuită. Textul nesalvat a fost păstrat.';}catch(error){uploadStatus.textContent=error.message;uploadStatus.classList.add('error');}finally{form.inert=false;save.disabled=cancel.disabled=replace.disabled=false;}};
    form.scrollIntoView({block:'nearest',behavior:'instant'});form.elements.title.focus({preventScroll:true});
  }
  function adminTools(row,article){
    const tools=el('div','release-admin-tools'),edit=action('Editează','m16 3 5 5M4 20l4-1L21 6a2.8 2.8 0 0 0-4-4L4 15l-1 6Z',()=>editor(row,article,edit));edit.setAttribute('aria-label','Editează '+row.title);
    async function change(values,button){if(!client||!moderator||button.disabled||[...richEditors.keys()].some(form=>form.inert))return;if([...richEditors.keys()].some(form=>form.dataset.dirty==='true')&&!confirm('Renunți la modificările nesalvate?'))return;if(values.is_deleted&&!confirm('Ștergi această versiune din site? Arhiva din GitHub și statisticile nu vor fi șterse.'))return;const active=client;for(const b of tools.querySelectorAll('button'))b.disabled=true;try{const result=await active.from('bg3ro_releases').update(values).eq('id',row.id).select('id');if(result.error||!result.data?.length)throw Error();if(client===active&&moderator)await load();}catch{$('#release-load-status').textContent='Modificarea nu a fost salvată. Încearcă din nou.';}finally{for(const b of tools.querySelectorAll('button'))b.disabled=false;}}
    const visibility=action(row.is_visible?'Ascunde':'Afișează',row.is_visible?'M3 3l18 18M7 7a18 18 0 0 0-6 5c3 5 8 8 13 6M10 5c5-1 9 3 11 7l-4 5':'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',()=>change({is_visible:!row.is_visible},visibility)),remove=action('Șterge','M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',()=>change({is_deleted:true},remove));visibility.setAttribute('aria-label',(row.is_visible?'Ascunde ':'Afișează ')+row.title);remove.setAttribute('aria-label','Șterge '+row.title);tools.append(edit,visibility,remove);article.append(tools);
  }
  function card(row) {
    const article = el("article", "card release-card"),
      head = el("div", "release-head"),
      info = el("div");
    article.dataset.release=row.id;article.dataset.platform=platformOf(row);
    if(!row.is_visible)article.classList.add('release-is-hidden','is-content-hidden');
    info.append(
      el("h2", "", row.title),
      el(
        "p",
        "release-file",
        `${row.file_name} · ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(row.file_bytes / 1048576)} MB`,
      ),
      tags(row),
    );
    const actions = el("div", "release-actions");
    actions.append(download(row, true));
    head.append(info, actions);
    if (row.kind !== "translation") {
      article.classList.add("release-card-mod");
      const description=el('div','release-description');description.append(window.BG3RO_CONTENT.render(row.description));article.append(head,description);
      if(moderator)adminTools(row,article);
      return article;
    }
    const notes = el("div", "release-notes"),
      notesHeading = el("h3", "");
    notesHeading.append(outlineIcon(["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M8 13h8m-8 4h8M8 9h2"], 14), el("span", "", "Ce este nou în această versiune"));
    notes.append(
      notesHeading,
      el("h4", "release-notes-title", row.title),
      window.BG3RO_CONTENT.render(row.description),
    );
    article.append(head, notes);
    if(moderator)adminTools(row,article);
    return article;
  }
  function draw() {
    disposeEditors();
    const main = $("#translation-releases"),
      extras = $("#extra-releases"),
      news = el("div");
    main.replaceChildren();
    extras.replaceChildren();
    news.replaceChildren();
    Object.entries(kinds).forEach(([kind, title]) => {
      const matches=rows.filter(r=>r.kind===kind&&!r.is_deleted&&(moderator||r.is_visible)),seen=new Set(),display=moderator?matches:matches.filter(row=>{const platform=platformOf(row);if(seen.has(platform))return false;seen.add(platform);return true;}),target = kind === "translation" ? main : extras;
      if (display.length) display.forEach(row=>target.append(card(row)));
      else {
        if (kind === "translation") return;
        const placeholder = el("article", "card release-placeholder");
        placeholder.append(
          el("h3", "", title),
          el(
            "p",
            "",
            "Nu este încă publicat un fișier pentru acest mod în site.",
          ),
        );
        target.append(placeholder);
      }
    });
    const localizationUpdates = rows.filter((row) => row.kind === "translation"&&row.is_visible&&!row.is_deleted&&(moderator||row.news_is_visible!==false)).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
    localizationUpdates.forEach((row,index) => {
      const article = el("article", "card release-news"),
        layout = el("div", "post"), content = el("div", "post-content"),
        meta = el("div", "post-meta release-meta"),
        time = el("time", "", new Intl.DateTimeFormat("ro-RO", {dateStyle:"medium"}).format(new Date(row.published_at)));
      article.dataset.newsDate=row.published_at;article.dataset.newsId=row.id;article.dataset.newsPinned=String(index===0);
      time.dateTime = row.published_at;
      const versionBadge = el("span", "release-version-badge"),
        uploadIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
        uploadPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      uploadIcon.setAttribute("viewBox", "0 0 24 24");
      uploadIcon.setAttribute("width", "12");
      uploadIcon.setAttribute("height", "12");
      uploadIcon.setAttribute("fill", "none");
      uploadIcon.setAttribute("stroke", "currentColor");
      uploadIcon.setAttribute("stroke-width", "2");
      uploadIcon.setAttribute("stroke-linecap", "round");
      uploadIcon.setAttribute("stroke-linejoin", "round");
      uploadIcon.setAttribute("aria-hidden", "true");
      uploadIcon.setAttribute("focusable", "false");
      uploadPath.setAttribute("d", "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12");
      uploadIcon.append(uploadPath);
      versionBadge.append(uploadIcon, el("span", "", row.news_badge ?? `Versiunea ${row.version}`));
      meta.append(
        el("strong", "", row.author_name),
        time,
        versionBadge,
      );
      versionBadge.hidden = row.news_badge === "";
      const title = el("h3", "post-title", row.news_title ?? row.title),
        link = el("a", "release-news-link");
      const linkIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      for (const [name,value] of Object.entries({viewBox:"0 0 24 24",width:"18",height:"18",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true",focusable:"false"})) linkIcon.setAttribute(name,value);
      const linkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      linkPath.setAttribute("d", "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71");
      linkIcon.append(linkPath); link.append(linkIcon,el("span","","Descărcări"));
      link.href = "#descarcari";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        $("#tab-descarcari").click();
        $(".tab-list").scrollIntoView({ block: "start" });
      });
      const separator = el("span", "release-news-separator", "·"); separator.setAttribute("aria-hidden","true");
      meta.insertBefore(separator, versionBadge); meta.insertBefore(link, versionBadge);
      content.append(meta, title, window.BG3RO_CONTENT.render(row.news_body ?? row.description));
      layout.append(authorAvatar(row), content); article.append(layout);
      news.append(article);
      if(moderator && index>0)window.BG3RO_NEWS.releaseEditor(article,row,client,load);
      if(moderator)window.BG3RO_NEWS.releaseVisibility(article,row,client,load);
    });
    $("#release-editor").hidden = !moderator;
    window.BG3RO_NEWS.commit("releases",[...news.children]);
    const latest = rows.find(
      (r) => r.kind === "translation" &&r.is_visible&&!r.is_deleted&&archiveURL(r.download_url),
    );
    $("#github-quick-download").hidden = !latest;
    if (latest) {
      $("#github-quick-download").href = latest.download_url;
      $("#github-quick-download").download = latest.file_name;
      $("#github-quick-download").dataset.releaseId = latest.id;
    }
  }
  async function load() {
    const ticket = ++request;
    if (!client) return;
    try {
      const result = await client
        .from("bg3ro_releases")
        .select(fields)
        .eq('is_deleted',false)
        .order("published_at", { ascending: false })
        .limit(100);
      if (ticket !== request) return;
      if (result.error) throw result.error;
      rows = (result.data || []).map(row => {
        const copy={...row,platform:platformOf(row),is_visible:row.is_visible!==false,is_deleted:row.is_deleted===true};
        for(const field of ['version','title','description','tags','news_title','news_body','news_badge'])copy[field]=window.BG3RO_VERSIONS.text(copy[field]);
        copy.version=window.BG3RO_VERSIONS.version(copy.version);
        return copy;
      });
      draw();
      $("#release-load-status").textContent = "";
      window.dispatchEvent(new CustomEvent("bg3ro:releases-updated", { detail: { versions: rows.filter(row => row.kind === "translation"&&row.is_visible&&!row.is_deleted).map(row => row.version) } }));
    } catch (_) {
      if (ticket !== request) return;
      window.dispatchEvent(new CustomEvent("bg3ro:releases-unavailable"));
      $("#release-load-status").textContent =
        "Lista versiunilor nu a putut fi încărcată. Poți folosi pagina Nexus Mods.";
    }
  }
  window.addEventListener("bg3ro:auth", (e) => {
    client = e.detail.client;
    moderator = e.detail.moderator === true;
    $("#release-editor").hidden = !moderator;
    if (!moderator) $("#release-publish-form").reset();
    if (rows.length) draw();
    load();
  });
  const publishDetails=$('#release-editor>details'),publishToggle=publishDetails.querySelector('summary'),publishPlus=outlineIcon(['M12 5v14M5 12h14']);publishPlus.setAttribute('stroke-width','1.7');publishToggle.prepend(publishPlus);publishToggle.setAttribute('role','button');publishToggle.setAttribute('aria-expanded',String(publishDetails.open));publishDetails.addEventListener('toggle',()=>publishToggle.setAttribute('aria-expanded',String(publishDetails.open)));
  const publishing=$('#release-publish-form'),publishingPlatform=platformField($('#release-kind').closest('.form-grid'),'all');publishingPlatform.id='release-platform';publishingPlatform.previousElementSibling.htmlFor=publishingPlatform.id;$('#release-kind').closest('.form-grid').classList.add('release-publish-platform-row');
  $('#release-kind').closest('.form-grid').insertBefore(publishingPlatform.closest('.field'),$('#release-version').closest('.field'));
  const archiveChoose=filePicker($('#release-archive'));$('#upload-release-file').classList.add('secondary','small-btn');
  const publishEnd=el('div','form-end'),publishCancel=el('button','btn release-cancel','Anulează'),publishButton=publishing.querySelector('[type=submit]');publishCancel.type='button';publishButton.textContent='Publică';publishEnd.append(publishCancel,publishButton);publishing.querySelector('.form-status').before(publishEnd);
  function clearUpload(){for(const selector of ['#release-url','#release-file-name','#release-file-bytes'])$(selector).value='';}
  publishingPlatform.addEventListener('change',()=>{clearUpload();$('#release-upload-status').textContent='Platforma s-a schimbat. Încarcă arhiva pentru platforma aleasă.';});
  $('#release-kind').addEventListener('change',()=>{clearUpload();if($('#release-kind').value!=='translation'&&publishingPlatform.value==='all')publishingPlatform.value='windows';});
  publishCancel.onclick=()=>{if(publishButton.disabled)return;publishing.reset();publishAPI?.reset();$('#release-archive').value='';$('#release-archive').dispatchEvent(new Event('change'));$('#release-upload-status').textContent='';const details=publishing.closest('details');details.open=false;details.querySelector('summary').focus({preventScroll:true});};
  document.addEventListener('DOMContentLoaded',()=>{if(window.BG3RO_MOUNT_CONTENT_EDITOR)publishAPI=window.BG3RO_MOUNT_CONTENT_EDITOR(publishing,$('#release-description'),{minimum:1,label:'Descrierea versiunii',placeholder:'Descrie versiunea…'});},{once:true});
  $("#upload-release-file").addEventListener("click", async () => {
    if (!client || !moderator) return;
    const button = $("#upload-release-file"),
      status = $("#release-upload-status"),
      publish = $("#release-publish-form button[type=submit]");
    if (button.disabled) return;
    const active=client,controls=[publish,publishCancel,archiveChoose,$('#release-archive'),$('#release-kind'),publishingPlatform];button.disabled = true;
    controls.forEach(control=>control.disabled=true);status.classList.remove('error');
    try {
      const data = await uploadArchive($("#release-archive").files[0], status,$('#release-platform').value);
      if(client!==active||!moderator)throw Error('Sesiunea s-a schimbat. Reconectează-te și încarcă din nou arhiva.');
      $("#release-file-name").value = data.file_name;
      $("#release-file-bytes").value = data.file_bytes;
      $("#release-url").value = data.download_url;
    } catch (error) {
      status.textContent = error.message;
      status.classList.add('error');
      ["#release-file-name", "#release-file-bytes", "#release-url"].forEach(
        (s) => ($(s).value = ""),
      );
    } finally {
      button.disabled = false;
      controls.forEach(control=>control.disabled=false);
    }
  });
  $("#release-publish-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!client || !moderator) return;
    const form = e.currentTarget,
      button = form.querySelector("button[type=submit]"),
      status = form.querySelector(".form-status");
    if (button.disabled) return;
    const active=client;
    const values = Object.fromEntries(new FormData(form));
    try{if(!publishAPI)throw Error('Editorul nu s-a încărcat. Reîncarcă pagina pentru a păstra formatarea.');values.description=publishAPI.value();}catch(error){status.classList.add('error');status.textContent=error.message;return;}
    if (!archiveURL(values.download_url)) {
      status.textContent =
        "Folosește o arhivă din repository-ul Gabrielish/bg3ro pe GitHub.";
      return;
    }
    values.file_bytes = Number(values.file_bytes);
    button.disabled = true;
    publishCancel.disabled=true;$('#upload-release-file').disabled=true;form.inert=true;status.classList.remove('error');
    status.textContent = "Se publică…";
    try {
      const result = await client
        .from("bg3ro_releases")
        .insert(values)
        .select("id");
      if (result.error || !result.data?.length) throw Error();
      if(client!==active||!moderator)return;
      form.reset();
      publishAPI.reset();$('#release-archive').value='';$('#release-archive').dispatchEvent(new Event('change'));
      await load();
      status.textContent = values.kind === "translation"
        ? "Versiunea și anunțul ei au fost publicate."
        : "Versiunea modului a fost publicată în Descărcări.";
    } catch (_) {
      status.textContent =
        "Publicarea nu a reușit. Verifică drepturile, câmpurile și dacă această versiune există deja.";
    } finally {
      button.disabled = false;
      publishCancel.disabled=false;$('#upload-release-file').disabled=false;form.inert=false;
    }
  });
})();
