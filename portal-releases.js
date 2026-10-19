(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const fields =
    "id,author_name,author_avatar_url,kind,version,title,file_name,file_bytes,download_url,tags,description,published_at,news_title,news_body,news_badge";
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
    return image;
  }
  function date(value) {
    return new Date(value).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  async function uploadArchive(file, status) {
    if (
      !file ||
      !/\.(zip|7z|rar)$/i.test(file.name) ||
      file.size > 20 * 1048576 ||
      !file.size
    )
      throw Error("Alege o arhivă ZIP, 7z sau RAR de maximum 20 MB.");
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
      ...row.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      date(row.published_at),
    ].forEach((t) => group.append(el("span", "release-tag", t)));
    return group;
  }
  function editor(row) {
    const details = el("details", "release-edit");
    details.append(el("summary", "", "Editează versiunea"));
    const sequence = ++editorSequence,
      form = el("form");
    [
      ["title", "Titlu", 160],
      ["tags", "Taguri (separate prin virgulă)", 240],
      ["description", "Ce este nou în această versiune", 12000],
    ].forEach(([key, label, max]) => {
      const wrap = el("div", "field"),
        id = `release-${sequence}-${row.id}-${key}`,
        l = el("label", "", label),
        input = el(key === "description" ? "textarea" : "input");
      l.htmlFor = id;
      input.id = id;
      input.name = key;
      input.maxLength = max;
      input.required = key !== "tags";
      input.value = row[key];
      wrap.append(l, input);
      form.append(wrap);
    });
    const button = el("button", "btn", "Salvează modificările"),
      status = el("p", "form-status");
    button.type = "submit";
    status.setAttribute("role", "status");
    form.append(button, status);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!client || !moderator || button.disabled) return;
      button.disabled = true;
      status.textContent = "Se salvează…";
      try {
        const values = Object.fromEntries(new FormData(form));
        const result = await client
          .from("bg3ro_releases")
          .update(values)
          .eq("id", row.id)
          .select("id");
        if (result.error || !result.data?.length) throw Error();
        await load();
      } catch (_) {
        status.textContent =
          "Modificările nu au fost salvate. Verifică drepturile și conexiunea.";
      } finally {
        button.disabled = false;
      }
    });
    details.append(form);
    const replacement = el("div", "release-edit"),
      label = el("label", "", "Înlocuiește arhiva acestei versiuni"),
      file = el("input"),
      replace = el(
        "button",
        "btn secondary",
        "Încarcă și înlocuiește fișierul",
      ),
      uploadStatus = el("p", "form-status");
    file.id = `replace-archive-${sequence}`;
    file.type = "file";
    file.accept = ".zip,.7z,.rar";
    label.htmlFor = file.id;
    replace.type = "button";
    uploadStatus.setAttribute("role", "status");
    replacement.append(
      label,
      file,
      el(
        "p",
        "small",
        "Un fișier cu același nume este înlocuit în folderul GitHub. Celelalte versiuni își păstrează descărcările.",
      ),
      replace,
      uploadStatus,
    );
    replace.addEventListener("click", async () => {
      if (!client || !moderator || replace.disabled) return;
      replace.disabled = true;
      try {
        const data = await uploadArchive(file.files[0], uploadStatus);
        const result = await client
          .from("bg3ro_releases")
          .update({
            file_name: data.file_name,
            file_bytes: data.file_bytes,
            download_url: data.download_url,
          })
          .eq("id", row.id)
          .select("id");
        if (result.error || !result.data?.length)
          throw Error(
            "Arhiva este pe GitHub, dar legătura versiunii nu a fost salvată. Reîncearcă înlocuirea.",
          );
        await load();
      } catch (error) {
        uploadStatus.textContent = error.message;
      } finally {
        replace.disabled = false;
      }
    });
    details.append(replacement);
    return window.BG3RO_EDITORS.mount(details, "Editează versiunea");
  }
  function card(row) {
    const article = el("article", "card release-card"),
      head = el("div", "release-head"),
      info = el("div");
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
    if (moderator) actions.append(editor(row));
    head.append(info, actions);
    const notes = el("div", "release-notes"),
      notesHeading = el("h3", "");
    notesHeading.append(outlineIcon(["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M8 13h8m-8 4h8M8 9h2"], 14), el("span", "", "Ce este nou în această versiune"));
    notes.append(
      notesHeading,
      el("h4", "release-notes-title", row.title),
      el("p", "", row.description),
    );
    article.append(head, notes);
    return article;
  }
  function draw() {
    const main = $("#translation-releases"),
      extras = $("#extra-releases"),
      news = el("div");
    main.replaceChildren();
    extras.replaceChildren();
    news.replaceChildren();
    Object.entries(kinds).forEach(([kind, title]) => {
      const row = rows.find((r) => r.kind === kind),
        target = kind === "translation" ? main : extras;
      if (row) target.append(card(row));
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
    const localizationUpdates = rows.filter((row) => row.kind === "translation").sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
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
    });
    $("#release-editor").hidden = !moderator;
    window.BG3RO_NEWS.commit("releases",[...news.children]);
    const latest = rows.find(
      (r) => r.kind === "translation" && archiveURL(r.download_url),
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
        .order("published_at", { ascending: false })
        .limit(100);
      if (ticket !== request) return;
      if (result.error) throw result.error;
      rows = (result.data || []).map(row => {
        const copy={...row};
        for(const field of ['version','title','description','tags','news_title','news_body','news_badge'])copy[field]=window.BG3RO_VERSIONS.text(copy[field]);
        copy.version=window.BG3RO_VERSIONS.version(copy.version);
        return copy;
      });
      draw();
      $("#release-load-status").textContent = "";
      window.dispatchEvent(new CustomEvent("bg3ro:releases-updated", { detail: { versions: rows.filter(row => row.kind === "translation").map(row => row.version) } }));
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
  $("#upload-release-file").addEventListener("click", async () => {
    if (!client || !moderator) return;
    const button = $("#upload-release-file"),
      status = $("#release-upload-status"),
      publish = $("#release-publish-form button[type=submit]");
    if (button.disabled) return;
    button.disabled = true;
    publish.disabled = true;
    try {
      const data = await uploadArchive($("#release-archive").files[0], status);
      $("#release-file-name").value = data.file_name;
      $("#release-file-bytes").value = data.file_bytes;
      $("#release-url").value = data.download_url;
    } catch (error) {
      status.textContent = error.message;
      ["#release-file-name", "#release-file-bytes", "#release-url"].forEach(
        (s) => ($(s).value = ""),
      );
    } finally {
      button.disabled = false;
      publish.disabled = false;
    }
  });
  $("#release-publish-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!client || !moderator) return;
    const form = e.currentTarget,
      button = form.querySelector("button[type=submit]"),
      status = form.querySelector(".form-status");
    if (button.disabled) return;
    const values = Object.fromEntries(new FormData(form));
    if (!archiveURL(values.download_url)) {
      status.textContent =
        "Folosește o arhivă din repository-ul Gabrielish/bg3ro pe GitHub.";
      return;
    }
    values.file_bytes = Number(values.file_bytes);
    button.disabled = true;
    status.textContent = "Se publică…";
    try {
      const result = await client
        .from("bg3ro_releases")
        .insert(values)
        .select("id");
      if (result.error || !result.data?.length) throw Error();
      form.reset();
      await load();
      status.textContent = values.kind === "translation"
        ? "Versiunea și anunțul ei au fost publicate."
        : "Versiunea modului a fost publicată în Descărcări.";
    } catch (_) {
      status.textContent =
        "Publicarea nu a reușit. Verifică drepturile, câmpurile și dacă această versiune există deja.";
    } finally {
      button.disabled = false;
    }
  });
})();
