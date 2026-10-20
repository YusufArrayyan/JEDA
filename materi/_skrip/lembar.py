import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
w = int(sys.argv[3]) if len(sys.argv)>3 else 260
ims = [Image.open(f).convert("RGB") for f in files]
th = [im.resize((w, int(im.height*w/im.width))) for im in ims]
cols = int(sys.argv[4]) if len(sys.argv)>4 else 7
h = max(t.height for t in th)+24
rows = (len(th)+cols-1)//cols
sheet = Image.new("RGB", (cols*(w+10), rows*h), "white")
d = ImageDraw.Draw(sheet)
for i,(t,f) in enumerate(zip(th,files)):
    x=(i%cols)*(w+10); y=(i//cols)*h
    sheet.paste(t,(x,y+20)); d.text((x+2,y+4),os.path.basename(f),fill="black")
sheet.save(sys.argv[2])
