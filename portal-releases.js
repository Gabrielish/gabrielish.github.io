(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const fields =
    "id,author_name,kind,version,title,file_name,file_bytes,download_url,tags,description,published_at";
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
      a.append(outlineIcon(["M12 3v12m-5-5 5 5 5-5", "M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4"]), el("span", "", format ? `Descărcați fișierul ${format}` : "Descărcați fișierul"));
    } else a.textContent = "Descarcă arhiva";
    a.href = row.download_url;
    a.download = row.file_name;
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
    return details;
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
    head.append(info, download(row, true));
    const notes = el("div", "release-notes"),
      notesHeading = el("h3", "");
    notesHeading.append(outlineIcon(["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M8 13h8m-8 4h8M8 9h2"], 14), el("span", "", "Ce este nou în această versiune"));
    notes.append(
      notesHeading,
      el("h4", "release-notes-title", `Noua versiune ${row.version}`),
      el("p", "", row.description),
    );
    article.append(head, notes);
    if (moderator) article.append(editor(row));
    return article;
  }
  function draw() {
    const main = $("#translation-releases"),
      extras = $("#extra-releases"),
      news = $("#release-updates");
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
            "Nu este încă publicat un fișier pentru acest modul în site.",
          ),
        );
        target.append(placeholder);
      }
    });
    rows.forEach((row) => {
      const article = el("article", "card release-news"),
        meta = el("div", "release-meta"),
        time = el("time", "", date(row.published_at));
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
      versionBadge.append(uploadIcon, el("span", "", `Versiunea ${row.version}`));
      meta.append(
        el("strong", "", row.author_name),
        time,
        versionBadge,
      );
      const title = el("h3", "", `Noua versiune ${row.version}`),
        link = el("a", "", "Toate descărcările →");
      link.href = "#descarcari";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        $("#tab-descarcari").click();
        $(".tab-list").scrollIntoView({ block: "start" });
      });
      article.append(
        meta,
        title,
        el("p", "small", row.title),
        el("p", "", row.description),
        link,
      );
      const direct = download(row);
      direct.className = "btn secondary small-btn";
      article.append(el("p", "", ""), direct);
      if (moderator) article.append(editor(row));
      news.append(article);
    });
    $("#release-editor").hidden = !moderator;
    $("#release-updates").hidden = !rows.length;
    syncNewsEmpty();
    const latest = rows.find(
      (r) => r.kind === "translation" && archiveURL(r.download_url),
    );
    document.querySelectorAll("[data-primary-download]").forEach((a) => {
      if (latest) {
        a.href = latest.download_url;
        a.download = latest.file_name;
        a.removeAttribute("target");
        a.removeAttribute("data-go-tab");
      }
    });
    $("#github-quick-download").hidden = !latest;
    if (latest) {
      $("#github-quick-download").href = latest.download_url;
      $("#github-quick-download").download = latest.file_name;
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
      rows = result.data || [];
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
  function syncNewsEmpty() {
    const list = $("#updates-list");
    const empty = list.querySelector(".release-empty-news");
    if (empty) empty.hidden = rows.length > 0;
    list.closest(".card").hidden = rows.length > 0 && !!empty && list.children.length === 1;
  }
  window.addEventListener("bg3ro:updates-loaded", syncNewsEmpty);
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
      status.textContent = "Versiunea și anunțul ei au fost publicate.";
    } catch (_) {
      status.textContent =
        "Publicarea nu a reușit. Verifică drepturile, câmpurile și dacă această versiune există deja.";
    } finally {
      button.disabled = false;
    }
  });
})();
