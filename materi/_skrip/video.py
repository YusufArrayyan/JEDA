# Menyusun video demo: lapisan PNG + rekaman layar + narasi -> materi/video/demo-jeda.mp4 (+ .srt)
#   python -I materi/_skrip/video.py   (jalankan dari akar repo, venv alat)
import json, subprocess, os
from pathlib import Path
import numpy as np
from PIL import Image
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
M = Path("materi")
K = M / "_kerja"
L = K / "lapis"
S = K / "suara"
SEG = K / "segmen"
SEG.mkdir(exist_ok=True)
OUT = M / "video"
OUT.mkdir(exist_ok=True)
DUR = json.load(open(S / "durasi.json"))
KAL = json.load(open(S / "kalimat.json", encoding="utf-8"))
JEDA_SUARA = 0.35
HP_X, HP_Y, JD_X, JD_Y = 1170, 70, 600, 160
BG = "0xf3f1ee"


def ff(*args):
    r = subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", *args])
    if r.returncode:
        raise SystemExit("ffmpeg gagal")


def matte(nama):
    a = np.asarray(Image.open(L / f"{nama}-putih.png").convert("RGBA")).astype(np.float32)
    b = np.asarray(Image.open(L / f"{nama}-hitam.png").convert("RGBA")).astype(np.float32)
    out = a.copy()
    beda = (np.abs(a[..., :3] - b[..., :3]).max(-1) > 2) & (a[..., 3] > 250)
    al = 255 - (a[..., :3] - b[..., :3]).mean(-1)
    al = np.clip(al, 0, 255)
    warna = np.where(al[..., None] > 0, b[..., :3] * 255 / np.maximum(al[..., None], 1), 0)
    out[beda, :3] = np.clip(warna[beda], 0, 255)
    out[beda, 3] = al[beda]
    Image.fromarray(out.astype(np.uint8)).save(L / f"{nama}-bingkai.png")


def daftar_frame(nama):
    w = json.load(open(K / "rekam" / nama / "waktu.json"))
    fr, mulai, akhir = w["frames"], w["mulai"], w["akhir"]
    baris = []
    for i, t in enumerate(fr):
        nxt = fr[i + 1] if i + 1 < len(fr) else akhir
        d = max(nxt - t, 0.001)
        if i == 0:
            d += t - mulai
        baris.append(f"file 'f{i:05d}.jpg'\nduration {d:.4f}")
    baris.append(f"file 'f{len(fr) - 1:05d}.jpg'")
    (K / "rekam" / nama / "daftar.txt").write_text("\n".join(baris))
    return w


def daftar_latar(urut, total, berkas):
    """urut: [(png, mulai_detik)] terurut; tulis daftar concat gambar."""
    baris = []
    for i, (png, t) in enumerate(urut):
        nxt = urut[i + 1][1] if i + 1 < len(urut) else total
        baris.append(f"file '{(L / png).resolve().as_posix()}'\nduration {max(nxt - t, 0.04):.4f}")
    baris.append(f"file '{(L / urut[-1][0]).resolve().as_posix()}'")
    berkas.write_text("\n".join(baris))


def latar_adegan(k, t_adegan):
    """Gambar latar per kalimat untuk adegan k yang mulai di t_adegan (detik relatif segmen)."""
    hasil = []
    for j, kal in enumerate(KAL[k]):
        t = t_adegan if j == 0 else t_adegan + JEDA_SUARA + kal["mulai"]
        hasil.append((f"{k}-{j}.png", t))
    return hasil


srt = []


def tambah_srt(k, t_global):
    for kal in KAL[k]:
        a = t_global + JEDA_SUARA + kal["mulai"]
        srt.append((a, a + kal["durasi"], kal["teks"].replace("jeda titik onrender titik com", "jeda.onrender.com")))


def segmen(nama, latar, total, adegan, video=None):
    """adegan: [(k, t_mulai_relatif)]"""
    daftar_latar(latar, total, SEG / f"{nama}-latar.txt")
    args = ["-f", "concat", "-safe", "0", "-i", str(SEG / f"{nama}-latar.txt")]
    filt = f"[0:v]fps=30,setpts=PTS-STARTPTS,format=yuv420p[bg];"
    n = 1
    if video == "mobile":
        args += ["-f", "concat", "-safe", "0", "-i", str(K / "rekam/mobile/daftar.txt"), "-loop", "1", "-framerate", "30", "-t", f"{total:.3f}", "-i", str(L / "ponsel-bingkai.png")]
        filt += (f"[1:v]fps=30,setpts=PTS-STARTPTS,pad=392:848:1:2:color=white,setsar=1,format=yuv420p[v];[bg][v]overlay={HP_X + 13}:{HP_Y + 13 + 49}:eof_action=repeat[a];"
                 f"[a][2:v]overlay=0:0:shortest=1[c];")
        n = 3
    elif video == "desktop":
        args += ["-f", "concat", "-safe", "0", "-i", str(K / "rekam/desktop/daftar.txt"), "-loop", "1", "-framerate", "30", "-t", f"{total:.3f}", "-i", str(L / "jendela-bingkai.png")]
        filt += (f"[1:v]fps=30,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v];[bg][v]overlay={JD_X}:{JD_Y}[a];"
                 f"[a][2:v]overlay=0:0:shortest=1[c];")
        n = 3
    else:
        filt += "[bg]null[c];"
    filt += f"[c]trim=duration={total:.3f},fade=t=in:st=0:d=0.35:color={BG},fade=t=out:st={total - 0.35:.3f}:d=0.35:color={BG},format=yuv420p[vout];"
    for i, (k, t) in enumerate(adegan):
        args += ["-i", str(S / f"{k}.mp3")]
        ms = int((t + JEDA_SUARA) * 1000)
        filt += f"[{n + i}:a]aresample=48000,adelay={ms}|{ms},apad[a{i}];"
    filt += "".join(f"[a{i}]" for i in range(len(adegan))) + f"amix=inputs={len(adegan)}:normalize=0:duration=longest,atrim=duration={total:.3f},afade=t=out:st={total - 0.3:.3f}:d=0.3[aout]"
    ff(*args, "-filter_complex", filt, "-map", "[vout]", "-map", "[aout]", "-t", f"{total:.3f}",
       "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-r", "30", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", str(SEG / f"{nama}.mp4"))
    print("segmen", nama, round(total, 2))


import sys
HANYA = sys.argv[1:]
_seg = segmen
def segmen(nama, *a, **kw):
    if not HANYA or nama[0] in HANYA: _seg(nama, *a, **kw)
matte("ponsel")
matte("jendela")
wm = daftar_frame("mobile")
wd = daftar_frame("desktop")

t_global = 0.0
# 1. Pembuka
tot = DUR["s01"] + JEDA_SUARA + 1.3
segmen("1-pembuka", latar_adegan("s01", 0), tot, [("s01", 0)])
tambah_srt("s01", t_global); t_global += tot
# 2. Ponsel
tot = wm["akhir"] - wm["mulai"]
adegan = [(k, t - wm["mulai"]) for k, t in wm["marks"]]
latar = [x for k, t in adegan for x in latar_adegan(k, t)]
segmen("2-ponsel", latar, tot, adegan, "mobile")
for k, t in adegan: tambah_srt(k, t_global + t)
t_global += tot
# 3. Laptop
tot = wd["akhir"] - wd["mulai"]
adegan = [(k, t - wd["mulai"]) for k, t in wd["marks"]]
segmen("3-laptop", [x for k, t in adegan for x in latar_adegan(k, t)], tot, adegan, "desktop")
for k, t in adegan: tambah_srt(k, t_global + t)
t_global += tot
# 4. Penutup
tot = DUR["s14"] + JEDA_SUARA + 2.2
segmen("4-penutup", latar_adegan("s14", 0), tot, [("s14", 0)])
tambah_srt("s14", t_global); t_global += tot

(SEG / "gabung.txt").write_text("\n".join(f"file '{(SEG / f).resolve().as_posix()}'" for f in ["1-pembuka.mp4", "2-ponsel.mp4", "3-laptop.mp4", "4-penutup.mp4"]))
ff("-f", "concat", "-safe", "0", "-i", str(SEG / "gabung.txt"), "-c", "copy", str(SEG / "gabung.mp4"))
# Kenyaringan standar daring (-16 LUFS) agar narasi tidak terlalu pelan.
ff("-i", str(SEG / "gabung.mp4"), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(OUT / "demo-jeda.mp4"))


def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s % 1) * 1000)) % 1000:03d}"


(OUT / "demo-jeda.srt").write_text("\n".join(f"{i}\n{ts(a)} --> {ts(b)}\n{t}\n" for i, (a, b, t) in enumerate(srt, 1)), encoding="utf-8")
print("total", round(t_global, 1), "detik")
