using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("BG3.RO Updater")]
[assembly: AssemblyDescription("Actualizator portabil pentru traducerea română Baldur's Gate 3")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyProduct("BG3.RO Updater")]

namespace BG3RO {
 public class Release {
  public string id, version, title, download_url, file_name, published_at, platform;
  public long file_bytes;
 }
 public class Receipt {
  public string Version, Hash, Url, Published;
 }
 public class ProjectProgress { public int? translation_percent; }
 public class Settings {
  public string Folder;
  public Dictionary<string,Receipt> Installs = new Dictionary<string,Receipt>(StringComparer.OrdinalIgnoreCase);
 }
 public static class Engine {
  public const string Feed="https://gatkiwcyjgbgjwfgvplm.supabase.co/rest/v1/bg3ro_releases?select=id,version,title,download_url,file_name,file_bytes,published_at,platform&kind=eq.translation&is_visible=eq.true&is_deleted=eq.false&platform=in.(windows,all)&order=published_at.desc,id.desc&limit=1";
  const string Key="sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd";
  public const string ProgressFeed="https://gatkiwcyjgbgjwfgvplm.supabase.co/rest/v1/bg3ro_about_sections?select=translation_percent&id=eq.progress&kind=eq.progress&is_visible=eq.true&limit=1";
  public static async Task<int?> TranslationProgress(CancellationToken token) {
   using(var c=Http()) {c.Timeout=TimeSpan.FromSeconds(8);c.DefaultRequestHeaders.Add("apikey",Key);
    using(var response=await c.GetAsync(ProgressFeed,token)){response.EnsureSuccessStatusCode();var text=await response.Content.ReadAsStringAsync();if(text.Length>10000)throw new InvalidDataException("Răspuns prea mare.");
     var rows=new JavaScriptSerializer().Deserialize<ProjectProgress[]>(text);var value=rows!=null&&rows.Length==1?rows[0].translation_percent:null;return value.HasValue&&value.Value>=0&&value.Value<=100?value:null;}
   }
  }
  public const string KnownHash="6e874063de11043f5fa28a6f90ab9d5747c59bda80efa5539ffa421c27d0798c";
  public const string KnownVersion="v0.7.9";
  public static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
  public static string SettingsPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"BG3RO-Updater","settings.json");
  public static HttpClient Http() {
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
   var h=new HttpClientHandler{AllowAutoRedirect=false};
   var c=new HttpClient(h);c.Timeout=TimeSpan.FromSeconds(25);c.DefaultRequestHeaders.UserAgent.ParseAdd("BG3RO-Updater/1.0");return c;
  }
  public static async Task<Release> Latest(CancellationToken token) {
   using(var c=Http()) {c.DefaultRequestHeaders.Add("apikey",Key);
    using(var response=await c.GetAsync(Feed,token)) {response.EnsureSuccessStatusCode();var text=await response.Content.ReadAsStringAsync();if(text.Length>100000)throw new InvalidDataException("Răspunsul serverului este prea mare.");
     var rows=Json.Deserialize<Release[]>(text);if(rows==null||rows.Length==0)throw new InvalidDataException("Nu există o versiune Windows publicată.");Validate(rows[0]);return rows[0];}
   }
  }
  public static void Validate(Release r) {
   Uri u;if(r==null||string.IsNullOrWhiteSpace(r.version)||r.version.Length>80||!Uri.TryCreate(r.download_url,UriKind.Absolute,out u)||u.Scheme!="https"||u.Host!="raw.githubusercontent.com"||u.Port!=443||u.UserInfo!=""||u.Query!=""||u.Fragment!="")throw new InvalidDataException("Legătura versiunii nu este validă.");
   string path=Uri.UnescapeDataString(u.AbsolutePath);
   if(!Regex.IsMatch(path,@"^/Gabrielish/bg3ro/[a-fA-F0-9]{40}/Baldur's Gate 3 Romanian Translate/[^/\\]+\.(rar|zip|7z)$",RegexOptions.IgnoreCase)||!string.Equals(Path.GetFileName(path),r.file_name,StringComparison.Ordinal)||r.file_bytes<1||r.file_bytes>100*1024*1024||!(r.platform=="windows"||r.platform=="all"))throw new InvalidDataException("Arhiva nu corespunde sursei oficiale BG3.RO.");
  }
  public static async Task Download(Release release,string file,IProgress<int> progress,CancellationToken token) {
   Validate(release);using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token))using(var c=Http()) {deadline.CancelAfter(TimeSpan.FromMinutes(5));token=deadline.Token;c.Timeout=TimeSpan.FromMinutes(5);
    using(var response=await c.GetAsync(release.download_url,HttpCompletionOption.ResponseHeadersRead,token)) {response.EnsureSuccessStatusCode();
     if(response.Content.Headers.ContentLength.HasValue&&response.Content.Headers.ContentLength.Value!=release.file_bytes)throw new InvalidDataException("Dimensiunea arhivei diferă de cea publicată.");
     using(var source=await response.Content.ReadAsStreamAsync())using(var target=new FileStream(file,FileMode.CreateNew,FileAccess.Write,FileShare.None,65536,true)) {
      long total=0;var buffer=new byte[65536];int read;while((read=await source.ReadAsync(buffer,0,buffer.Length,token))!=0) {total+=read;if(total>release.file_bytes)throw new InvalidDataException("Arhiva depășește dimensiunea publicată.");await target.WriteAsync(buffer,0,read,token);if(progress!=null)progress.Report((int)(total*100/release.file_bytes));}
      if(total!=release.file_bytes)throw new InvalidDataException("Descărcarea este incompletă.");
     }
    }
   }
  }
  public static string Hash(string path) {using(var sha=SHA256.Create())using(var file=File.OpenRead(path))return BitConverter.ToString(sha.ComputeHash(file)).Replace("-","").ToLowerInvariant();}
  public static string Target(string root) {return Path.Combine(root,"Data","Localization","English.pak");}
  public static string DisplayPath(string path){
   string full=Path.GetFullPath(path),prefix=Path.GetPathRoot(full);if(prefix.Length>=2&&prefix[1]==':')prefix=char.ToUpperInvariant(prefix[0])+prefix.Substring(1);string current=prefix;
   foreach(string part in full.Substring(Path.GetPathRoot(full).Length).Split(new[]{Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar},StringSplitOptions.RemoveEmptyEntries)){
    string actual=null;try{actual=Directory.EnumerateDirectories(current).FirstOrDefault(folder=>string.Equals(Path.GetFileName(folder),part,StringComparison.OrdinalIgnoreCase));}catch(IOException){}catch(UnauthorizedAccessException){}
    current=actual??Path.Combine(current,part);
   }return current;
  }
  public static void NoLinks(string path) {
   for(var item=new DirectoryInfo(Path.GetDirectoryName(Path.GetFullPath(path)));item!=null;item=item.Parent)
    if(item.Exists&&(item.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("Alege locația reală a jocului, nu o scurtătură sau un folder redirecționat.");
   if(File.Exists(path)&&(File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new IOException("English.pak nu poate fi o legătură către alt fișier.");
  }
  public static string ResolveRoot(string folder) {
   string full=Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar);
   if(File.Exists(Path.Combine(full,"English.pak"))&&string.Equals(new DirectoryInfo(full).Name,"Localization",StringComparison.OrdinalIgnoreCase))full=Path.GetFullPath(Path.Combine(full,"..",".."));
   if(!File.Exists(Target(full))||!(File.Exists(Path.Combine(full,"bin","bg3.exe"))||File.Exists(Path.Combine(full,"bin","bg3_dx11.exe"))))throw new IOException("Alege folderul Baldurs Gate 3 care conține bin și Data. English.pak trebuie să existe deja în Data\\Localization.");
   NoLinks(Target(full));return full;
  }
  public static bool GameRunning() {var processes=Process.GetProcessesByName("bg3").Concat(Process.GetProcessesByName("bg3_dx11")).ToArray();foreach(var p in processes)p.Dispose();return processes.Length>0;}
  public static void DeleteWork(string path){string full=Path.GetFullPath(path),temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);if(!string.Equals(Path.GetDirectoryName(full),temp,StringComparison.OrdinalIgnoreCase)||!Regex.IsMatch(Path.GetFileName(full),@"^BG3RO-(Updater|Test)-[a-f0-9]{32}$"))throw new IOException("Folder temporar invalid.");if(Directory.Exists(full)){NoLinks(Path.Combine(full,"check"));Directory.Delete(full,true);}}
  static string Tar {get {string path=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"tar.exe");if(!File.Exists(path))throw new IOException("Această versiune de Windows nu include tar.exe. Este necesar Windows 10 actualizat sau Windows 11.");return path;}}
  static ProcessStartInfo TarCommand(string args) {return new ProcessStartInfo(Tar,args){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8};}
  static string Quote(string text) {if(text.IndexOf('"')>=0||text.IndexOf('\r')>=0||text.IndexOf('\n')>=0)throw new InvalidDataException("Nume de fișier invalid.");return "\""+text+"\"";}
  public static string Extract(string archive,string destination,CancellationToken token) {
   string entry=null;using(var p=Process.Start(TarCommand("-tf "+Quote(archive)))) {
    var error=p.StandardError.ReadToEndAsync();var output=p.StandardOutput.ReadToEndAsync();if(!p.WaitForExit(30000)){p.Kill();throw new IOException("Arhiva nu poate fi citită.");}
    string listing=output.GetAwaiter().GetResult();if(p.ExitCode!=0||listing.Length>100000)throw new InvalidDataException("Arhiva este invalidă sau formatul nu este acceptat.");
    var entries=listing.Split(new[]{'\r','\n'},StringSplitOptions.RemoveEmptyEntries).Where(x=>string.Equals(x,"English.pak",StringComparison.Ordinal)||string.Equals(x,"./English.pak",StringComparison.Ordinal)).ToArray();
    if(entries.Length!=1)throw new InvalidDataException("Arhiva trebuie să conțină un singur English.pak la rădăcină.");entry=entries[0];
   }
   token.ThrowIfCancellationRequested();
   using(var p=Process.Start(TarCommand("-xOf "+Quote(archive)+" -- "+Quote(entry))))using(var target=new FileStream(destination,FileMode.CreateNew,FileAccess.Write)) {
    var errors=p.StandardError.ReadToEndAsync();try {var buffer=new byte[65536];long total=0;int read;while((read=p.StandardOutput.BaseStream.Read(buffer,0,buffer.Length))>0){token.ThrowIfCancellationRequested();total+=read;if(total>512L*1024*1024)throw new InvalidDataException("Fișierul extras depășește limita permisă.");target.Write(buffer,0,read);}if(!p.WaitForExit(30000)||p.ExitCode!=0)throw new InvalidDataException("English.pak nu a putut fi extras.");}
    finally {if(!p.HasExited)p.Kill();}
   }
   using(var f=File.OpenRead(destination)){byte[] magic=new byte[4];if(f.Length<16||f.Read(magic,0,4)!=4||Encoding.ASCII.GetString(magic)!="LSPK")throw new InvalidDataException("Fișierul extras nu este un pachet valid Baldur's Gate 3.");}
   return Hash(destination);
  }
  public static string Install(string root,string source,string expectedHash,Action beforeReplace) {
   root=ResolveRoot(root);if(GameRunning())throw new IOException("Închide Baldur's Gate 3 înainte de actualizare.");
   if(Hash(source)!=expectedHash)throw new InvalidDataException("Fișierul pregătit s-a modificat. Reia actualizarea.");
   string target=Target(root),directory=Path.GetDirectoryName(target),staged=Path.Combine(directory,".bg3ro-"+Guid.NewGuid().ToString("N")+".tmp"),backupDir=Path.Combine(directory,"BG3RO-Backups");
   NoLinks(Path.Combine(backupDir,"backup.pak"));Directory.CreateDirectory(backupDir);
   string backup=Path.Combine(backupDir,"English-"+DateTime.Now.ToString("yyyyMMdd-HHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,6)+".pak");
   try {File.Copy(source,staged,false);if(Hash(staged)!=expectedHash)throw new IOException("Verificarea copiei pregătite a eșuat.");
    if(GameRunning())throw new IOException("Jocul a fost pornit. Închide-l și reia actualizarea.");NoLinks(target);if(beforeReplace!=null)beforeReplace();File.Replace(staged,target,backup,false);return backup;
   }finally {if(File.Exists(staged))File.Delete(staged);}
  }
  public static Settings LoadSettings() {try{var result=Json.Deserialize<Settings>(File.ReadAllText(SettingsPath));if(result!=null){if(result.Installs==null)result.Installs=new Dictionary<string,Receipt>();return result;}}catch{}return new Settings();}
  public static void SaveSettings(Settings settings) {
   Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath));string temp=SettingsPath+"."+Guid.NewGuid().ToString("N")+".tmp";
   try {File.WriteAllText(temp,Json.Serialize(settings),new UTF8Encoding(false));if(File.Exists(SettingsPath))File.Replace(temp,SettingsPath,null);else File.Move(temp,SettingsPath);}finally{if(File.Exists(temp))File.Delete(temp);}
  }
  public static Receipt Local(string root,Settings settings) {
   if(string.IsNullOrEmpty(root))return null;string hash=Hash(Target(root));Receipt previous;
   if(settings.Installs.TryGetValue(root,out previous)&&previous.Hash==hash)return previous;
   if(hash==KnownHash)return new Receipt{Version=KnownVersion,Hash=hash,Published="2026-10-20T01:07:12.206087+03:00",Url="https://raw.githubusercontent.com/Gabrielish/bg3ro/7c6044094b37ef8c6dd3f69e6016fa2584b60213/Baldur's%20Gate%203%20Romanian%20Translate/Baldurs_Gate_3_RO_20.10.2026_7933.rar"};
   return new Receipt{Hash=hash};
  }
  public static bool Current(Receipt installed,Release latest) {return installed!=null&&latest!=null&&installed.Url==latest.download_url;}
  public static string Detect() {
   var steam=new List<string>();try {foreach(string key in new[]{@"HKEY_CURRENT_USER\Software\Valve\Steam",@"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam"}) {object v=Registry.GetValue(key,"SteamPath",null)??Registry.GetValue(key,"InstallPath",null);if(v!=null)steam.Add(v.ToString());}}catch{}
   steam.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Steam"));var libraries=new List<string>(steam);
   foreach(var s in steam)try {string config=File.ReadAllText(Path.Combine(s,"steamapps","libraryfolders.vdf"));foreach(Match m in Regex.Matches(config,"\\\"path\\\"\\s+\\\"([^\\\"]+)\\\""))libraries.Add(m.Groups[1].Value.Replace("\\\\","\\"));}catch{}
   foreach(var folder in libraries.Distinct(StringComparer.OrdinalIgnoreCase))try{return ResolveRoot(Path.Combine(folder,"steamapps","common","Baldurs Gate 3"));}catch{}
   return null;
  }
 }

 public class SoftButton:Control,IButtonControl {
  public DialogResult DialogResult{get;set;}
  protected override AccessibleObject CreateAccessibilityInstance(){return new SoftButtonAccessibleObject(this);}
  class SoftButtonAccessibleObject:ControlAccessibleObject {
   readonly SoftButton button;
   public SoftButtonAccessibleObject(SoftButton owner):base(owner){button=owner;}
   public override string DefaultAction{get{return "Apasă";}}
   public override void DoDefaultAction(){button.PerformClick();}
  }
  public void NotifyDefault(bool value){Invalidate();}
  public void PerformClick(){if(Enabled&&Visible)OnClick(EventArgs.Empty);}
  protected override bool IsInputKey(Keys key){return key==Keys.Space||key==Keys.Enter||base.IsInputKey(key);}
  protected override void OnKeyDown(KeyEventArgs e){base.OnKeyDown(e);if(e.KeyCode==Keys.Space){pressed=true;Invalidate();e.Handled=true;e.SuppressKeyPress=true;}else if(e.KeyCode==Keys.Enter){PerformClick();e.Handled=true;e.SuppressKeyPress=true;}}
  protected override void OnKeyUp(KeyEventArgs e){base.OnKeyUp(e);if(e.KeyCode==Keys.Space){bool click=pressed;pressed=false;Invalidate();if(click)PerformClick();e.Handled=true;}}
  public string WindowSymbol;
  public bool Primary;bool hover,pressed;float illumination;readonly System.Windows.Forms.Timer animation=new System.Windows.Forms.Timer{Interval=16};
  public SoftButton(){Cursor=Cursors.Hand;SetStyle(ControlStyles.StandardClick|ControlStyles.Selectable|ControlStyles.SupportsTransparentBackColor|ControlStyles.UserPaint|ControlStyles.AllPaintingInWmPaint|ControlStyles.OptimizedDoubleBuffer,true);BackColor=Color.Transparent;TabStop=false;AccessibleRole=AccessibleRole.PushButton;Font=new Font("Segoe UI",12.67f,FontStyle.Regular,GraphicsUnit.Pixel);
   MouseEnter+=(s,e)=>{hover=true;animation.Start();};MouseLeave+=(s,e)=>{hover=false;pressed=false;animation.Start();};GotFocus+=(s,e)=>animation.Start();LostFocus+=(s,e)=>{pressed=false;animation.Start();};MouseDown+=(s,e)=>{if(e.Button==MouseButtons.Left){Focus();pressed=true;}Invalidate();};MouseUp+=(s,e)=>{pressed=false;Invalidate();};EnabledChanged+=(s,e)=>{pressed=false;animation.Start();};
   animation.Tick+=(s,e)=>{float target=Enabled&&hover?1:0;illumination+=Math.Sign(target-illumination)*.09f;if(Math.Abs(target-illumination)<.1f){illumination=target;animation.Stop();}Invalidate();};}
  protected override void Dispose(bool disposing){if(disposing)animation.Dispose();base.Dispose(disposing);}
  public static GraphicsPath Round(Rectangle rect,int radius){var p=new GraphicsPath();int d=radius*2;p.AddArc(rect.X,rect.Y,d,d,180,90);p.AddArc(rect.Right-d,rect.Y,d,d,270,90);p.AddArc(rect.Right-d,rect.Bottom-d,d,d,0,90);p.AddArc(rect.X,rect.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
  protected override void OnPaintBackground(PaintEventArgs e){using(var brush=new SolidBrush(Parent==null?Theme.Background:Parent.BackColor))e.Graphics.FillRectangle(brush,ClientRectangle);}
  void DrawSecondaryContent(Graphics g,Rectangle rect){
   if(WindowSymbol==null){Theme.DrawText(g,Text,Font,rect,!Enabled?Theme.Muted:Theme.Text,StringAlignment.Center);return;}
   float cx=rect.Left+rect.Width/2f,cy=rect.Top+rect.Height/2f,scale=Math.Min(Width,Height)/28f;
   using(var pen=new Pen(Enabled?Theme.Text:Theme.Muted,Math.Max(1,scale))){pen.StartCap=pen.EndCap=LineCap.Round;if(WindowSymbol=="minimize")g.DrawLine(pen,cx-4*scale,cy,cx+4*scale,cy);else{g.DrawLine(pen,cx-3*scale,cy-3*scale,cx+3*scale,cy+3*scale);g.DrawLine(pen,cx-3*scale,cy+3*scale,cx+3*scale,cy-3*scale);}}
  }
  protected override void OnPaint(PaintEventArgs e){e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;e.Graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;float glow=Enabled?illumination:0;var rect=new Rectangle(0,pressed?1:0,Width-1,Height-2);
   if(Primary){using(var shape=Theme.ButtonShape(rect)){
     using(var surface=new LinearGradientBrush(rect,Color.FromArgb(35,34,30),Theme.Panel,90f))e.Graphics.FillPath(surface,shape);
     Theme.DrawWebsiteButton(e.Graphics,rect,shape,glow,Enabled);

    }
    Theme.DrawText(e.Graphics,Text.ToUpperInvariant(),Font,new Rectangle(rect.X,rect.Y-1,rect.Width,rect.Height),!Enabled?Theme.Muted:Theme.Blend(Theme.Text,Color.FromArgb(23,21,19),glow),StringAlignment.Center);}
   else{using(var path=Round(rect,Math.Max(5,Height/5)))using(var bg=new LinearGradientBrush(rect,Theme.Blend(Color.FromArgb(35,34,30),Color.FromArgb(66,57,39),glow),Color.FromArgb(18,19,19),90f))using(var pen=new Pen(Theme.Blend(Theme.Line,Theme.Gold,glow))){e.Graphics.FillPath(bg,path);e.Graphics.DrawPath(pen,path);}DrawSecondaryContent(e.Graphics,rect);}}
 }
 public class ThinProgress:Control {
  int value;bool showPercentage;
  public bool ShowPercentage{get{return showPercentage;}set{showPercentage=value;Invalidate();}}
  public int Value {get{return value;}set{this.value=Math.Max(0,Math.Min(100,value));AccessibleDescription=showPercentage?this.value+"%":"Actualizare";Invalidate();}}
  public ThinProgress(){DoubleBuffered=true;AccessibleName="Progresul actualizării";AccessibleRole=AccessibleRole.ProgressBar;}
  static GraphicsPath Pill(RectangleF rectangle){var path=new GraphicsPath();float d=Math.Min(rectangle.Height,rectangle.Width);path.AddArc(rectangle.X,rectangle.Y,d,d,180,90);path.AddArc(rectangle.Right-d,rectangle.Y,d,d,270,90);path.AddArc(rectangle.Right-d,rectangle.Bottom-d,d,d,0,90);path.AddArc(rectangle.X,rectangle.Bottom-d,d,d,90,90);path.CloseFigure();return path;}
  protected override void OnPaint(PaintEventArgs e){e.Graphics.Clear(Parent==null?Theme.Background:Parent.BackColor);e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;float h=8*Theme.UiScale;var track=new RectangleF(.5f,Height-h-.5f,Width-1,h);using(var path=Pill(track))using(var brush=new SolidBrush(Color.FromArgb(41,40,38)))e.Graphics.FillPath(brush,path);
   if(value>0){var fill=new RectangleF(track.X,track.Y,track.Width*value/100f,track.Height);using(var path=Pill(fill))using(var brush=new LinearGradientBrush(track,Color.FromArgb(183,143,109),Color.FromArgb(221,201,167),0f))e.Graphics.FillPath(brush,path);}
   var header=new Rectangle(0,0,Width,(int)(16*Theme.UiScale));Theme.DrawText(e.Graphics,"Actualizare",Font,header,Theme.Muted,StringAlignment.Near);if(showPercentage)using(var bold=new Font(Font,FontStyle.Bold))Theme.DrawText(e.Graphics,value+"%",bold,header,Theme.Text,StringAlignment.Far);
  }
 }
 public class Card:Panel {
  public Card(){DoubleBuffered=true;BackColor=Theme.Panel;}
  protected override void OnPaintBackground(PaintEventArgs e){e.Graphics.Clear(Parent==null?Theme.Background:Parent.BackColor);e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;using(var path=SoftButton.Round(new Rectangle(0,0,Width-1,Height-1),(int)(12*Theme.UiScale)))using(var brush=new SolidBrush(BackColor))e.Graphics.FillPath(brush,path);}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;using(var path=SoftButton.Round(new Rectangle(0,0,Width-1,Height-1),(int)(12*Theme.UiScale)))using(var pen=new Pen(Theme.Line)){e.Graphics.DrawPath(pen,path);}}
 }
 public class MainWindow:Form {
  const int DesignWidth=680,DesignHeight=472;
  class DesignItem{public Control Control;public Rectangle Bounds;public FontFamily Family;public float FontSize;public FontStyle Style;}
  readonly List<DesignItem> designLayout=new List<DesignItem>();bool layoutReady,scaling;
  [StructLayout(LayoutKind.Sequential)]struct DpiRectangle{public int Left,Top,Right,Bottom;}
  [DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr window);
  Icon smallWindowIcon,largeWindowIcon;
  public string TestReport;
  readonly Color muted=Theme.Muted;Label localVersion,remoteVersion,pathLabel,status,subtitle;LinkLabel remoteDetail;SoftButton choose,check,update;ThinProgress progress;Settings settings;Receipt installed;Release latest;string root;bool busy,applying;CancellationTokenSource cancellation;
  [DllImport("user32.dll")]static extern bool ReleaseCapture();[DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr hwnd,int msg,int w,IntPtr l);
  public MainWindow(string capture){Text="BG3.RO Updater";Name="BG3RO-Updater";largeWindowIcon=Theme.AppIcon(64);Icon=largeWindowIcon;Size=new Size(DesignWidth,DesignHeight);StartPosition=FormStartPosition.CenterScreen;FormBorderStyle=FormBorderStyle.None;BackColor=Theme.Background;ForeColor=Theme.Text;Font=new Font("Segoe UI",12.67f,FontStyle.Regular,GraphicsUnit.Pixel);AutoScaleMode=AutoScaleMode.None;DoubleBuffered=true;
   var brand=new BrandMark{Bounds=new Rectangle(176,10,32,32)};Controls.Add(brand);var title=new Wordmark{Bounds=new Rectangle(220,7,360,40)};Controls.Add(title);title.MouseDown+=(s,e)=>{if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0xA1,2,IntPtr.Zero);}};
   var minimize=ButtonAt(this,"−",594,12,28,28,false,(s,e)=>WindowState=FormWindowState.Minimized);minimize.WindowSymbol="minimize";minimize.AccessibleName="Minimizează";
   var close=ButtonAt(this,"×",630,12,28,28,false,(s,e)=>Close());close.WindowSymbol="close";close.AccessibleName="Închide";
   LabelAt(this,"Traducerea în română",24,68,500,40,24,FontStyle.Bold,ForeColor);
   subtitle=LabelAt(this,"Baldur’s Gate 3 · Early Access · Progres traducere: …",24,110,500,22,9.5f,FontStyle.Regular,muted);
   SourceLink("Website ↗","https://gabrielish.github.io/",542,76);
   SourceLink("Nexus Mods ↗","https://www.nexusmods.com/baldursgate3/mods/24379",542,106);
   var left=MakeCard(24,146,310,92);var right=MakeCard(346,146,310,92);
   LabelAt(left,"VERSIUNEA INSTALATĂ",16,10,278,18,8,FontStyle.Regular,muted);localVersion=LabelAt(left,"Alege folderul jocului",16,32,278,30,17,FontStyle.Bold,ForeColor);LabelAt(left,"Verificată din fișierul English.pak",16,65,278,16,8,FontStyle.Regular,muted);
   LabelAt(right,"VERSIUNEA DISPONIBILĂ",16,10,278,18,8,FontStyle.Regular,muted);remoteVersion=LabelAt(right,"Se verifică…",16,32,278,30,17,FontStyle.Bold,Theme.Gold);
   remoteDetail=new SmoothLinkLabel{Text="Sursa oficială BG3.RO",Bounds=new Rectangle(16,65,278,16),Font=new Font("Segoe UI",10.67f,FontStyle.Regular,GraphicsUnit.Pixel),BackColor=Theme.Panel,ForeColor=muted,LinkColor=muted,VisitedLinkColor=muted,ActiveLinkColor=Theme.Gold,LinkBehavior=LinkBehavior.NeverUnderline,LinkArea=new LinkArea(0,0),AccessibleName="Detaliile versiunii și Ce este nou?",TabStop=false};remoteDetail.LinkClicked+=(s,e)=>{try{Process.Start(new ProcessStartInfo("https://gabrielish.github.io/#actualizari"){UseShellExecute=true});}catch{MessageBox.Show(this,"Nu am putut deschide browserul. Adresa este: https://gabrielish.github.io/#actualizari","BG3.RO",MessageBoxButtons.OK,MessageBoxIcon.Information);}};remoteDetail.MouseMove+=(s,e)=>{remoteDetail.LinkColor=Theme.Gold;};remoteDetail.MouseLeave+=(s,e)=>{remoteDetail.LinkColor=muted;};right.Controls.Add(remoteDetail);
   var location=MakeCard(24,250,632,64);LabelAt(location,"Folderul jocului",15,14,458,16,8,FontStyle.Regular,muted);pathLabel=LabelAt(location,"Selectează folderul Baldurs Gate 3",15,34,458,16,8.5f,FontStyle.Regular,muted);pathLabel.AutoEllipsis=true;choose=ButtonAt(location,"Alege folderul",509,15,108,34,false,Choose);
   progress=new ThinProgress{Bounds=new Rectangle(24,324,632,30)};Controls.Add(progress);
   status=LabelAt(this,"Se caută versiunea disponibilă…",24,362,632,30,9.5f,FontStyle.Regular,ForeColor);status.AccessibleRole=AccessibleRole.StaticText;
   check=ButtonAt(this,"Verifică din nou",24,410,154,36,false,async(s,e)=>await Check());
   update=ButtonAt(this,"Actualizează",380,398,276,58,true,async(s,e)=>await ApplyUpdate());update.Font=Theme.Display(21);update.Enabled=false;
   settings=Engine.LoadSettings();root=settings.Folder;try{if(!string.IsNullOrEmpty(root))root=Engine.ResolveRoot(root);}catch{root=null;}if(root==null)root=Engine.Detect();ShowPath();
   RememberLayout(this);float initialScale;try{initialScale=GetDpiForWindow(Handle)/96f;}catch(EntryPointNotFoundException){using(var screen=CreateGraphics())initialScale=screen.DpiX/96f;}ApplyDpi(initialScale);layoutReady=true;
Shown+=async(s,e)=>{await Check();if(TestReport!=null){await ApplyUpdate();bool passed=Engine.Current(installed,latest)&&Engine.Hash(Engine.Target(root))==installed.Hash&&Directory.GetFiles(Path.Combine(root,"Data","Localization","BG3RO-Backups")).Length==1;File.WriteAllText(TestReport,(passed?"PASS":"FAIL")+": real feed + download + RAR extraction + complete UI update pipeline in temporary game fixture. "+status.Text);}if(capture!=null){using(var bmp=new Bitmap(Width,Height)){DrawToBitmap(bmp,ClientRectangle);SaveRoundedCapture(bmp,capture);}}if(capture!=null||TestReport!=null)Close();};FormClosing+=(s,e)=>{if(busy){e.Cancel=true;if(!applying&&MessageBox.Show(this,"Anulezi operația în curs?","BG3.RO",MessageBoxButtons.YesNo,MessageBoxIcon.Question)==DialogResult.Yes)cancellation.Cancel();}};
  }
  void ApplyWindowIcons(){var oldSmall=smallWindowIcon;var oldLarge=largeWindowIcon;smallWindowIcon=Theme.AppIcon((int)(16*Theme.UiScale));largeWindowIcon=Theme.AppIcon((int)(32*Theme.UiScale));Icon=largeWindowIcon;SendMessage(Handle,0x80,0,smallWindowIcon.Handle);SendMessage(Handle,0x80,1,largeWindowIcon.Handle);if(oldSmall!=null)oldSmall.Dispose();if(oldLarge!=null)oldLarge.Dispose();}
  protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);ApplyWindowIcons();}
  protected override void Dispose(bool disposing){base.Dispose(disposing);if(disposing){if(smallWindowIcon!=null)smallWindowIcon.Dispose();if(largeWindowIcon!=null)largeWindowIcon.Dispose();}}
  void SaveRoundedCapture(Bitmap rendered,string file){using(var png=new Bitmap(rendered.Width,rendered.Height,System.Drawing.Imaging.PixelFormat.Format32bppArgb))using(var g=Graphics.FromImage(png))using(var texture=new TextureBrush(rendered))using(var shape=SoftButton.Round(new Rectangle(0,0,rendered.Width-1,rendered.Height-1),(int)(20*rendered.Width/(float)DesignWidth))){g.Clear(Color.Transparent);g.SmoothingMode=SmoothingMode.AntiAlias;g.FillPath(texture,shape);png.Save(file,System.Drawing.Imaging.ImageFormat.Png);}}
  void RoundWindow(){if(ClientSize.Width<40||ClientSize.Height<40)return;float scale=ClientSize.Width/(float)DesignWidth;using(var path=SoftButton.Round(new Rectangle(0,0,Width,Height),(int)(20*scale))){var old=Region;Region=new Region(path);if(old!=null)old.Dispose();}}
  protected override void OnSizeChanged(EventArgs e){base.OnSizeChanged(e);RoundWindow();}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;float scale=ClientSize.Width/(float)DesignWidth;Theme.Divider(e.Graphics,24*scale,56*scale,632*scale);using(var pen=new Pen(Theme.Line))using(var path=SoftButton.Round(new Rectangle(0,0,ClientSize.Width-1,ClientSize.Height-1),(int)(20*scale)))e.Graphics.DrawPath(pen,path);}
  void SourceLink(string text,string url,int x,int y){var link=new SmoothLinkLabel{Text=text,Bounds=new Rectangle(x,y,114,22),TextAlign=ContentAlignment.MiddleRight,BackColor=Theme.Background,LinkColor=Theme.Gold,ActiveLinkColor=Theme.Text,VisitedLinkColor=Theme.Gold,LinkBehavior=LinkBehavior.NeverUnderline,Font=new Font("Segoe UI",12.67f,FontStyle.Regular,GraphicsUnit.Pixel),AccessibleName=text,TabStop=false};link.LinkClicked+=(s,e)=>{try{Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}catch{MessageBox.Show(this,"Nu am putut deschide browserul. Adresa este: "+url,"BG3.RO",MessageBoxButtons.OK,MessageBoxIcon.Information);}};link.MouseEnter+=(s,e)=>{link.LinkColor=Theme.Text;};link.MouseLeave+=(s,e)=>{link.LinkColor=Theme.Gold;};Controls.Add(link);}
  Card MakeCard(int x,int y,int w,int h){var c=new Card{Bounds=new Rectangle(x,y,w,h)};Controls.Add(c);return c;}
  void RememberLayout(Control parent){foreach(Control c in parent.Controls){designLayout.Add(new DesignItem{Control=c,Bounds=c.Bounds,Family=c.Font.FontFamily,FontSize=c.Font.Size,Style=c.Font.Style});RememberLayout(c);}}
  void ApplyDpi(float scale){if(scale<.75f||scale>5f||scaling)return;scaling=true;SuspendLayout();try{Theme.UiScale=scale;foreach(var item in designLayout){var r=item.Bounds;item.Control.Bounds=new Rectangle((int)Math.Round(r.X*scale),(int)Math.Round(r.Y*scale),(int)Math.Round(r.Width*scale),(int)Math.Round(r.Height*scale));item.Control.Font=new Font(item.Family,item.FontSize*scale,item.Style,GraphicsUnit.Pixel);}ClientSize=new Size((int)Math.Round(DesignWidth*scale),(int)Math.Round(DesignHeight*scale));RoundWindow();if(IsHandleCreated)ApplyWindowIcons();Invalidate(true);}finally{ResumeLayout(false);scaling=false;}}
  protected override bool ProcessDialogKey(Keys keyData){if((keyData & Keys.KeyCode)==Keys.Tab)return true;return base.ProcessDialogKey(keyData);}
  protected override void WndProc(ref Message message){if(message.Msg==0x02E0&&layoutReady&&!scaling){float scale=(message.WParam.ToInt64()&0xffff)/96f;var suggested=(DpiRectangle)Marshal.PtrToStructure(message.LParam,typeof(DpiRectangle));ApplyDpi(scale);Location=new Point(suggested.Left,suggested.Top);message.Result=IntPtr.Zero;return;}base.WndProc(ref message);}
  static Label LabelAt(Control parent,string text,int x,int y,int w,int h,float size,FontStyle style,Color color){var l=new SmoothLabel{Text=text,Bounds=new Rectangle(x,y,w,h),Font=style==FontStyle.Bold?Theme.Display(size*96f/72f):new Font("Segoe UI",size*96f/72f,style,GraphicsUnit.Pixel),ForeColor=color,BackColor=Color.Transparent,UseMnemonic=false};parent.Controls.Add(l);return l;}
  static SoftButton ButtonAt(Control parent,string text,int x,int y,int w,int h,bool primary,EventHandler action){var b=new SoftButton{Text=text,Bounds=new Rectangle(x,y,w,h),Primary=primary};b.Click+=action;parent.Controls.Add(b);return b;}
  void ShowPath(){pathLabel.Text=root==null?"Selectează folderul Baldurs Gate 3":Engine.DisplayPath(root);choose.Text=root==null?"Alege folderul":"Schimbă";}
  void SetBusy(bool value){busy=value;choose.Enabled=check.Enabled=!value;update.Enabled=!value&&root!=null&&latest!=null;if(!value){applying=false;cancellation.Dispose();cancellation=null;}}
  async void Choose(object sender,EventArgs args){using(var dialog=new FolderBrowserDialog{Description="Alege folderul Baldurs Gate 3 (conține bin și Data).",ShowNewFolderButton=false,SelectedPath=root??""}){if(dialog.ShowDialog(this)!=DialogResult.OK)return;try{root=Engine.ResolveRoot(dialog.SelectedPath);settings.Folder=root;Engine.SaveSettings(settings);ShowPath();await Check();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Folderul jocului",MessageBoxButtons.OK,MessageBoxIcon.Information);}}}
  async Task RefreshProjectProgress(CancellationToken token){subtitle.Text="Baldur’s Gate 3 · Early Access · Progres traducere: …";int? value=null;try{value=await Engine.TranslationProgress(token);}catch{}subtitle.Text="Baldur’s Gate 3 · Early Access · Progres traducere: "+(value.HasValue?value.Value+"%":"—");}
  async Task Check(){if(busy)return;cancellation=new CancellationTokenSource();SetBusy(true);var projectTask=RefreshProjectProgress(cancellation.Token);latest=null;progress.ShowPercentage=false;progress.Value=0;remoteVersion.Text="Se verifică…";remoteDetail.Links.Clear();remoteDetail.Text="Verific versiunea publicată…";status.Text="Verific versiunea publicată pe BG3.RO…";
   try{installed=await Task.Run(()=>Engine.Local(root,settings));localVersion.Text=root==null?"Alege folderul jocului":installed!=null&&!string.IsNullOrEmpty(installed.Version)?installed.Version:"Necunoscută";latest=await Engine.Latest(cancellation.Token);remoteVersion.Text=latest.version;DateTimeOffset when;remoteDetail.Text=(DateTimeOffset.TryParse(latest.published_at,out when)?TimeZoneInfo.ConvertTime(when,TimeZoneInfo.FindSystemTimeZoneById("GTB Standard Time")).ToString("dd.MM.yyyy")+" · ":"")+(latest.file_bytes/1048576.0).ToString("0.0")+" MB · Ce este nou?";remoteDetail.Links.Add(remoteDetail.Text.IndexOf("Ce este nou?",StringComparison.Ordinal),"Ce este nou?".Length);
    status.Text=root==null?"Am găsit ultima versiune. Alege folderul jocului pentru actualizare.":Engine.Current(installed,latest)?"Ești la zi. Ai instalată ultima versiune a traducerii.":installed!=null&&string.IsNullOrEmpty(installed.Version)?"Versiunea existentă nu poate fi identificată. Poți instala versiunea disponibilă; fișierul actual va fi păstrat în backup.":"Este disponibilă o actualizare a traducerii.";
    update.Text=Engine.Current(installed,latest)?"Ești la zi":"Actualizează";
   }catch(OperationCanceledException){latest=null;remoteVersion.Text="—";status.Text="Verificarea a fost anulată sau a expirat. Poți încerca din nou.";}catch(Exception){latest=null;remoteVersion.Text="Indisponibilă";status.Text="Nu pot verifica versiunea. Verifică internetul și apasă «Verifică din nou».";}
   await projectTask;if(latest==null)remoteDetail.Text="Detalii indisponibile";SetBusy(false);
  }
  async Task ApplyUpdate(){if(busy||latest==null||root==null)return;if(Engine.Current(installed,latest)){await Check();return;}if(Engine.GameRunning()){status.Text="Închide Baldur’s Gate 3 înainte de actualizare.";return;}
   var release=latest;string folder=root,work=Path.Combine(Path.GetTempPath(),"BG3RO-Updater-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(work);cancellation=new CancellationTokenSource();SetBusy(true);progress.ShowPercentage=true;progress.Value=0;update.Text="Se actualizează…";
   try{status.Text="Descarc traducerea de pe GitHub…";string archive=Path.Combine(work,"translation.archive"),pak=Path.Combine(work,"English.pak");await Engine.Download(release,archive,new Progress<int>(v=>progress.Value=Math.Min(88,v*88/100)),cancellation.Token);
    status.Text="Verific și pregătesc English.pak…";string hash=await Task.Run(()=>Engine.Extract(archive,pak,cancellation.Token));cancellation.Token.ThrowIfCancellationRequested();progress.Value=92;
    // Metadata is written first; a failed install cannot be misreported because Local verifies the actual file hash.
    var receipt=new Receipt{Version=release.version,Hash=hash,Url=release.download_url,Published=release.published_at};settings.Installs[folder]=receipt;Engine.SaveSettings(settings);
    applying=true;status.Text="Instalez traducerea și păstrez copia de siguranță…";string backup=await Task.Run(()=>Engine.Install(folder,pak,hash,()=>cancellation.Token.ThrowIfCancellationRequested()));installed=receipt;localVersion.Text=receipt.Version;progress.Value=100;status.Text="Actualizare finalizată. Poți porni jocul.";
   }catch(OperationCanceledException){status.Text="Operația a fost anulată. Traducerea instalată nu a fost înlocuită.";}catch(UnauthorizedAccessException){status.Text="Nu am permisiune de scriere în folderul jocului. Închide aplicația și pornește-o ca administrator pentru actualizare.";}catch(Exception ex){status.Text="Actualizarea nu a reușit. "+ex.Message;}finally{try{Engine.DeleteWork(work);}catch{}update.Text=Engine.Current(installed,latest)?"Ești la zi":"Actualizează";SetBusy(false);}
  }
 }
 public static class Program {
  [STAThread]public static int Main(string[] args){try{if(args.Length>1&&args[0]=="--test-rendering"){SelfTest.Rendering(args[1]);return 0;}if(args.Length>0&&args[0]=="--self-test"){SelfTest.Run(args.Length>1?args[1]:null,args.Length>2?args[2]:null);return 0;}if(args.Length>1&&args[0]=="--test-ui"){SelfTest.UI(args[1],args.Length>2?args[2]:null);return 0;}if(args.Length>0&&args[0]=="--verify-feed"){var r=Engine.Latest(CancellationToken.None).GetAwaiter().GetResult();File.WriteAllText(args.Length>1?args[1]:"feed-result.json",Engine.Json.Serialize(r));return 0;}
   if(args.Length>1&&args[0]=="--capture"){Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new MainWindow(args[1]));return 0;}
   bool first;using(var single=new Mutex(true,@"Local\BG3RO-Updater",out first)){if(!first){MessageBox.Show("BG3.RO Updater este deja deschis.","BG3.RO");return 0;}Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new MainWindow(null));}return 0;
  }catch(Exception ex){if(args.Length>0){File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"test-error.txt"),ex.ToString());return 1;}MessageBox.Show("Aplicația nu a putut porni. "+ex.Message,"BG3.RO Updater");return 1;}}
 }
 public static class SelfTest {
  [DllImport("user32.dll")]static extern IntPtr GetThreadDpiAwarenessContext();
  [DllImport("user32.dll")]static extern bool AreDpiAwarenessContextsEqual(IntPtr first,IntPtr second);
  public static void Rendering(string report){Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Assert(AreDpiAwarenessContextsEqual(GetThreadDpiAwarenessContext(),new IntPtr(-4)),"PerMonitorV2 awareness is not active");using(var form=new MainWindow(null)){var resize=typeof(MainWindow).GetMethod("ApplyDpi",BindingFlags.Instance|BindingFlags.NonPublic);var title=form.Controls.OfType<Wordmark>().Single();foreach(float scale in new[]{1f,1.25f,1.5f,1.75f,2f,1f,1.75f}){resize.Invoke(form,new object[]{scale});Assert(form.ClientSize.Width==Math.Min((int)Math.Round(680*scale),SystemInformation.MaxWindowTrackSize.Width)&&form.ClientSize.Height==Math.Min((int)Math.Round(472*scale),SystemInformation.MaxWindowTrackSize.Height),"DPI dimensions mismatch at "+scale+": actual="+form.ClientSize+", expected="+Math.Round(680*scale)+"x"+Math.Round(472*scale));Assert(Math.Abs(title.Font.Size-29.33f*scale)<.01,"Font scaling drift at "+scale);Assert(!form.Region.IsVisible(0,0),"Rounded corner lost after DPI change");}Assert(form.Controls.OfType<SmoothLabel>().Any(),"Smooth labels missing");}using(var bitmap=new Bitmap(100,40))using(var g=Graphics.FromImage(bitmap)){Theme.SmoothText(g);Assert(g.TextRenderingHint==System.Drawing.Text.TextRenderingHint.ClearTypeGridFit,"ClearType not enabled");}File.WriteAllText(report,"PASS: PerMonitorV2 active; layout/fonts at 100/125/150/175/200%, respecting OS maximum window bounds; repeated scale changes without rounding drift; rounded corners retained; ClearType configured.");}
  public static void UI(string report,string screenshot){string work=Path.Combine(Path.GetTempPath(),"BG3RO-Test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(Path.Combine(work,"bin"));Directory.CreateDirectory(Path.Combine(work,"Data","Localization"));File.WriteAllText(Path.Combine(work,"bin","bg3.exe"),"fixture only");File.WriteAllText(Engine.Target(work),"LSPKoriginal test fixture");string previous=Engine.SettingsPath;try{Engine.SettingsPath=Path.Combine(work,"settings.json");Engine.SaveSettings(new Settings{Folder=work});Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);var form=new MainWindow(screenshot);form.TestReport=report;Application.Run(form);}finally{Engine.SettingsPath=previous;Engine.DeleteWork(work);}}
  static void Assert(bool value,string message){if(!value)throw new Exception(message);}
  public static void Run(string report,string realArchive){string work=Path.Combine(Path.GetTempPath(),"BG3RO-Test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(work);
   try{var r=new Release{version="v1",platform="windows",file_name="release.rar",file_bytes=20,download_url="https://raw.githubusercontent.com/Gabrielish/bg3ro/0123456789012345678901234567890123456789/Baldur's%20Gate%203%20Romanian%20Translate/release.rar"};Engine.Validate(r);
    string valid=r.download_url;foreach(string bad in new[]{valid.Replace("https:","http:"),valid.Replace("Gabrielish/bg3ro","stranger/repo"),valid.Replace("0123456789012345678901234567890123456789","main"),valid+"?token=x"}){r.download_url=bad;bool rejected=false;try{Engine.Validate(r);}catch(InvalidDataException){rejected=true;}Assert(rejected,"Untrusted archive accepted");}r.download_url=valid;
    var root=Path.Combine(work,"game");Directory.CreateDirectory(Path.Combine(root,"bin"));Directory.CreateDirectory(Path.Combine(root,"Data","Localization"));File.WriteAllText(Path.Combine(root,"bin","bg3.exe"),"test fixture only");var target=Engine.Target(root);File.WriteAllText(target,"original fixture");Assert(Engine.ResolveRoot(root)==root,"Root resolution");Assert(Engine.ResolveRoot(Path.GetDirectoryName(target))==root,"Localization folder resolution");
    string pak=Path.Combine(work,"prepared.pak");File.WriteAllText(pak,"LSPKtranslation fixture");string hash=Engine.Hash(pak);string backup=Engine.Install(root,pak,hash,null);Assert(File.ReadAllText(target)=="LSPKtranslation fixture","Replacement");Assert(File.ReadAllText(backup)=="original fixture","Backup original");
    File.WriteAllText(pak,"LSPKanother fixture");bool failed=false;try{Engine.Install(root,pak,hash,null);}catch(InvalidDataException){failed=true;}Assert(failed,"Tampered prepared file accepted");Assert(File.ReadAllText(target)=="LSPKtranslation fixture","Failure changed target");
    failed=false;try{Engine.Install(root,pak,Engine.Hash(pak),()=>{throw new OperationCanceledException();});}catch(OperationCanceledException){failed=true;}Assert(failed&&File.ReadAllText(target)=="LSPKtranslation fixture","Cancellation changed target");
    var settings=new Settings();settings.Installs[root]=new Receipt{Version="v1",Hash=hash,Url=valid};Assert(Engine.Local(root,settings).Version=="v1","Receipt recognition");File.WriteAllText(target,"modified outside app");Assert(Engine.Local(root,settings).Version==null,"Stale receipt trusted");
    string oldPath=Engine.SettingsPath;Engine.SettingsPath=Path.Combine(work,"config","settings.json");settings.Folder=root;Engine.SaveSettings(settings);Engine.SaveSettings(settings);Assert(Engine.LoadSettings().Folder==root,"Atomic settings persistence");Engine.SettingsPath=oldPath;
    if(realArchive!=null){string extracted=Path.Combine(work,"extracted.pak");Assert(Engine.Extract(realArchive,extracted,CancellationToken.None)==Engine.KnownHash,"Published archive extraction/hash mismatch");string back=Engine.Install(root,extracted,Engine.KnownHash,null);Assert(Engine.Hash(target)==Engine.KnownHash&&File.ReadAllText(back)=="modified outside app","Published package installation in fixture failed");}
    if(report!=null)File.WriteAllText(report,"PASS: URL allowlist, immutable commits, folder validation, atomic replacement, backup, tampering rejection, cancellation, stale receipts, settings persistence and published RAR extraction/install. Only temporary fixtures modified.");
   }finally{Engine.DeleteWork(work);}
  }
 }
}
