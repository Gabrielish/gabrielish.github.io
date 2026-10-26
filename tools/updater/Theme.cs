using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace BG3RO {
 // Offline assets from the BG3.RO website; EB Garamond is distributed under the SIL OFL.
 public static class Theme {
  public static float UiScale=1;
  public static readonly Color Background=Color.FromArgb(11,12,15),Panel=Color.FromArgb(17,18,21),Gold=Color.FromArgb(215,188,138),Text=Color.FromArgb(244,236,217),Muted=Color.FromArgb(169,170,169),Line=Color.FromArgb(56,51,44);
  static readonly PrivateFontCollection fonts=new PrivateFontCollection();
  static IntPtr fontData;
  public static readonly Image Brand,Outline,Filled;
  [DllImport("gdi32.dll")] static extern IntPtr AddFontMemResourceEx(IntPtr data,uint size,IntPtr reserved,ref uint count);
  static Theme(){
   var assembly=Assembly.GetExecutingAssembly();byte[] data;
   using(var s=assembly.GetManifestResourceStream("theme.font"))using(var m=new MemoryStream()){s.CopyTo(m);data=m.ToArray();}
   fontData=Marshal.AllocCoTaskMem(data.Length);Marshal.Copy(data,0,fontData,data.Length);fonts.AddMemoryFont(fontData,data.Length);uint count=0;AddFontMemResourceEx(fontData,(uint)data.Length,IntPtr.Zero,ref count);
   Brand=Load("theme.brand");Outline=Load("theme.outline");Filled=Load("theme.filled");
  }
  static Image Load(string name){using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream(name))using(var image=Image.FromStream(s))return new Bitmap(image);}
  public static Font Display(float pixels){return new Font(fonts.Families[0],pixels,FontStyle.Regular,GraphicsUnit.Pixel);}
  public static void SmoothText(Graphics g){g.TextRenderingHint=TextRenderingHint.ClearTypeGridFit;g.TextContrast=4;}
  public static void DrawText(Graphics g,string text,Font font,Rectangle bounds,Color color,StringAlignment alignment){SmoothText(g);using(var brush=new SolidBrush(color))using(var format=new StringFormat{Alignment=alignment,LineAlignment=StringAlignment.Center,FormatFlags=StringFormatFlags.NoWrap,Trimming=StringTrimming.EllipsisCharacter})g.DrawString(text,font,brush,bounds,format);}
  public static Icon AppIcon(int size){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("theme.app-icon"))using(var icon=new Icon(stream,size,size))return (Icon)icon.Clone();}
  public static Color Blend(Color a,Color b,float t){return Color.FromArgb((int)(a.R+(b.R-a.R)*t),(int)(a.G+(b.G-a.G)*t),(int)(a.B+(b.B-a.B)*t));}
  public static GraphicsPath ButtonShape(Rectangle r){var p=new GraphicsPath();p.AddLines(new[]{new PointF(16,8),new PointF(191,8),new PointF(200,2),new PointF(209,8),new PointF(384,8)});p.AddBezier(384,8,386.667f,14,391,18,397,20);p.AddLine(397,20,397,64);p.AddBezier(397,64,391,66,386.667f,70,384,76);p.AddLines(new[]{new PointF(384,76),new PointF(209,76),new PointF(200,82),new PointF(191,76),new PointF(16,76)});p.AddBezier(16,76,13.333f,70,9,66,3,64);p.AddLine(3,64,3,20);p.AddBezier(3,20,9,18,13.333f,14,16,8);p.CloseFigure();using(var m=new Matrix(r.Width/400f,0,0,r.Height/84f,r.X,r.Y))p.Transform(m);return p;}
  public static void DrawWebsiteButton(Graphics g,Rectangle r,GraphicsPath shape,float hover,bool enabled){
   float opacity=enabled?1f:.45f;
   using(var edge=new LinearGradientBrush(r,Color.FromArgb((int)(255*opacity*(1-hover)),243,229,212),Color.FromArgb((int)(255*opacity*(1-hover)),184,153,107),90f))using(var pen=new Pen(edge,1.2f*UiScale))g.DrawPath(pen,shape);
   var state=g.Save();g.TranslateTransform(r.X,r.Y);g.ScaleTransform(r.Width/400f,r.Height/84f);
   using(var brush=new SolidBrush(Color.FromArgb((int)(255*opacity*(1-hover)),215,196,165))){g.FillPolygon(brush,new[]{new PointF(0,42),new PointF(9,36),new PointF(29,42),new PointF(9,48)});g.FillPolygon(brush,new[]{new PointF(400,42),new PointF(391,36),new PointF(371,42),new PointF(391,48)});}
   using(var pen=new Pen(Color.FromArgb((int)(255*opacity*(1-hover)),188,160,122),400f/r.Width)){g.DrawLines(pen,new[]{new PointF(196,8),new PointF(200,11),new PointF(204,8)});g.DrawLines(pen,new[]{new PointF(196,76),new PointF(200,73),new PointF(204,76)});}
   g.Restore(state);
   if(hover>0){using(var fill=new LinearGradientBrush(r,Color.FromArgb((int)(255*hover),238,228,204),Color.FromArgb((int)(255*hover),216,203,174),90f))g.FillPath(fill,shape);state=g.Save();g.TranslateTransform(r.X,r.Y);g.ScaleTransform(r.Width/400f,r.Height/84f);using(var brush=new SolidBrush(Color.FromArgb((int)(255*hover),23,21,19))){g.FillPolygon(brush,new[]{new PointF(195,10),new PointF(200,6),new PointF(205,10),new PointF(200,15)});g.FillPolygon(brush,new[]{new PointF(195,74),new PointF(200,79),new PointF(205,74),new PointF(200,69)});}g.Restore(state);}
  }
  public static void DrawImage(Graphics g,Image image,Rectangle rect,float opacity){using(var attributes=new ImageAttributes()){var matrix=new ColorMatrix();matrix.Matrix33=opacity;attributes.SetColorMatrix(matrix);g.DrawImage(image,rect,0,0,image.Width,image.Height,GraphicsUnit.Pixel,attributes);}}
  public static void Divider(Graphics g,float x,float y,float width){float mid=x+width/2,s=UiScale,baseline=y+.5f*s;using(var gradient=new LinearGradientBrush(new PointF(x,y),new PointF(x+width,y),Color.FromArgb(183,143,109),Color.FromArgb(183,143,109)))using(var path=new GraphicsPath()){
    gradient.InterpolationColors=new ColorBlend{Colors=new[]{Color.FromArgb(183,143,109),Color.FromArgb(221,201,167),Color.FromArgb(183,143,109)},Positions=new[]{0f,.5f,1f}};
    path.AddLines(new[]{new PointF(x,baseline),new PointF(mid-5*s,baseline),new PointF(mid,baseline+4*s),new PointF(mid+3*s,baseline+s)});path.StartFigure();path.AddLines(new[]{new PointF(mid-3*s,baseline-s),new PointF(mid,baseline-4*s),new PointF(mid+5*s,baseline),new PointF(x+width,baseline)});
    using(var pen=new Pen(gradient,s)){pen.LineJoin=LineJoin.Round;pen.StartCap=pen.EndCap=LineCap.Round;g.DrawPath(pen,path);}
   }}
 }
 public class BrandMark:Control {
  public BrandMark(){DoubleBuffered=true;AccessibleName="Sigla BG3.RO";}
  protected override void OnPaint(PaintEventArgs e){e.Graphics.InterpolationMode=InterpolationMode.HighQualityBicubic;e.Graphics.DrawImage(Theme.Brand,ClientRectangle);}
 }
 public class Wordmark:Control {
  public Wordmark(){DoubleBuffered=true;AccessibleName="BG3.RO | UPDATER";Font=Theme.Display(29.33f);}
  protected override void OnPaint(PaintEventArgs e){Theme.SmoothText(e.Graphics);using(var format=(StringFormat)StringFormat.GenericTypographic.Clone())using(var light=new SolidBrush(Theme.Text))using(var gold=new SolidBrush(Theme.Gold)){float y=(Height-Font.GetHeight(e.Graphics))/2,scale=Font.Size/29.33f;float width=e.Graphics.MeasureString("BG3",Font,int.MaxValue,format).Width;e.Graphics.DrawString("BG3",Font,light,new PointF(0,y),format);e.Graphics.DrawString(".RO",Font,gold,new PointF(width,y),format);float end=width+e.Graphics.MeasureString(".RO",Font,int.MaxValue,format).Width,separator=120*scale;using(var pen=new Pen(Color.FromArgb(221,201,167),Math.Max(1,scale)))e.Graphics.DrawLine(pen,separator,Height/2f-10*scale,separator,Height/2f+10*scale);e.Graphics.DrawString("UPDATER",Font,gold,new PointF(separator+14*scale,y),format);}}
 }
 public class SmoothLabel:Label {
  public SmoothLabel(){UseCompatibleTextRendering=true;DoubleBuffered=true;}
  protected override void OnPaint(PaintEventArgs e){Theme.SmoothText(e.Graphics);base.OnPaint(e);}
 }
 public class SmoothLinkLabel:LinkLabel {
  public SmoothLinkLabel(){UseCompatibleTextRendering=true;DoubleBuffered=true;}
  protected override void OnPaint(PaintEventArgs e){Theme.SmoothText(e.Graphics);base.OnPaint(e);}
 }
}
