# Verificare statică BG3.RO Updater — Windows

Data: 28 octombrie 2026. Executabilul suspect nu a fost pornit. Fișierele distribuite nu au fost modificate.

## Fișier verificat

- `assets/downloads/BG3RO-Updater.exe`, 419.328 octeți, .NET x64.
- SHA-256: `24d1d29e3f83c420a81c71879594884277471c24867c49320bb863366553e4b4`.
- Authenticode: `NotSigned`.
- [Raport VirusTotal furnizat pentru acest fișier](https://www.virustotal.com/gui/file/24d1d29e3f83c420a81c71879594884277471c24867c49320bb863366553e4b4?nocache=1).
- Captura proprietarului arată CrowdStrike Falcon `Win/malicious_confidence_60% (D)`, SecureAge `Malicious` și Microsoft `Trojan:Win32/Wacatac.B!ml`. Aceste rezultate provin din captură; raportul dinamic VirusTotal nu a putut fi verificat independent în această sesiune.

## Ce s-a verificat

Au fost inspectate `tools/updater/Program.cs`, `Theme.cs`, manifestul și scriptul de compilare, precum și sursa din proiectul local standalone. Diferența hash-urilor fișierelor sursă Program.cs provine din terminatoarele de linie; comparația textuală nu arată schimbări de cod.

Sursa din repository a fost compilată separat, într-un fișier de diagnostic local, fără publicare și fără execuție. Toate cele **172 de corpuri de metode IL**, heap-ul șirurilor utilizator și heap-ul semnăturilor binare coincid cu executabilul distribuit. Aceasta verifică corespondența codului inspectat, nu reprezintă o certificare antivirus sau o demonstrație formală a identității întregului fișier PE.

Executabilul folosește bibliotecile .NET standard și interfețele native `user32.dll`, `gdi32.dll`, `dwmapi.dll` pentru interfață, fonturi și fereastră. Resursele declarate sunt iconița, trei imagini, fontul și licența fontului. Nu există date suplimentare după ultima secțiune PE. Scriptul de build nu folosește un packer sau obfuscator.

## Comportament observat în sursă

- Citește versiunea și progresul din fluxuri publice Supabase prin HTTPS, cu o cheie publicabilă.
- Acceptă arhive numai de pe `raw.githubusercontent.com/Gabrielish/bg3ro`, din directorul traducerii, la un commit fix de 40 caractere. Redirecturile sunt dezactivate, iar numele și dimensiunea arhivei sunt validate.
- Descarcă într-un director temporar propriu și folosește `tar.exe` din Windows pentru extragerea exclusivă a `English.pak`. Nu descarcă executabile pentru a le rula.
- Verifică formatul LSPK, calculează SHA-256 și înlocuiește pachetul jocului cu backup. Nu există o semnătură independentă a arhivei; SHA-256 local verifică integritatea copiilor, nu identitatea autorului.
- Citește locația Steam din registry; nu scrie chei de pornire automată. Verifică dacă procesul jocului rulează.
- Salvează setările în `%LOCALAPPDATA%/BG3RO-Updater/settings.json`.
- Manifestul cere `asInvoker`; aplicația nu se elevează automat. Scrierea în Program Files poate necesita permisiuni suplimentare.
- Nu au fost identificate în sursa inspectată colectare de parole, exfiltrare, servicii persistente, injecție în procese sau dezactivarea protecțiilor Windows.

## Concluzie și limite

Nu au fost găsite indicii evidente de cod malițios în verificarea statică efectuată. **Nu se poate declara pe această bază că detecțiile sunt false pozitive.** Nu s-a efectuat analiză comportamentală într-un sandbox și nu s-a verificat integral lanțul de aprovizionare al sistemului pe care s-a compilat aplicația.

Descărcarea unei arhive, lansarea unui utilitar fără fereastră și înlocuirea unui fișier sunt operații legitime aici, dar pot influența euristica antivirus. Aceasta este o ipoteză; motivul exact al verdictelor nu este disponibil.

Avertismentul Chrome despre un fișier descărcat rar și detecțiile antivirus sunt lucruri diferite. Eliminarea unuia nu confirmă rezolvarea celuilalt. Nu se recomandă dezactivarea antivirusului sau adăugarea unei excluderi pentru a ocoli rezultatele.

Pasul următor este trimiterea **aceluiași fișier**, cu hash-ul de mai sus, pentru reevaluare la furnizorii care l-au detectat. [Microsoft oferă formular pentru dezvoltatori](https://www.microsoft.com/en-us/wdsi/filesubmission), iar [documentația sa cere așteptarea verdictului final](https://learn.microsoft.com/en-us/defender-xdr/developer-faq). Nicio trimitere externă nu a fost făcută în această verificare.

## Precizare despre raportul macOS

[Raportul macOS furnizat](https://www.virustotal.com/gui/file/952583b60d6d73e7ed968c968d3a19133a68d1425dffbca7a131bf60a3f363a1?nocache=1) are SHA-256 `952583b60d6d73e7ed968c968d3a19133a68d1425dffbca7a131bf60a3f363a1`.

Arhiva distribuită acum are hash-ul `6d0fc70b070e11c0d9192e46de3c69056dd7d474fe51992536deb37053b1e990`, iar executabilul din ea are `56c235e28b76f0a8b338cd55c70a28a6c8c7f4e49755629ac827e24489d38179`. Niciun membru al arhivei nu are hash-ul raportului furnizat. Acel raport nu verifică această descărcare; este necesar un raport pentru fișierul exact distribuit.
