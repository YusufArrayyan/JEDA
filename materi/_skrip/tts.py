# Narasi per adegan + batas kalimat (untuk teks di layar dan SRT).
import json, asyncio, sys, subprocess
import edge_tts, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
suara = sys.argv[1] if len(sys.argv) > 1 else "id-ID-GadisNeural"
data = json.load(open("_skrip/narasi.json", encoding="utf-8"))

def durasi(f):
    r = subprocess.run([FF, "-i", f, "-f", "null", "-"], capture_output=True, text=True)
    hms = [l for l in r.stderr.splitlines() if "time=" in l][-1].split("time=")[1].split()[0]
    h, m, s = hms.split(":"); return round(int(h)*3600 + int(m)*60 + float(s), 2)

async def satu(k, teks):
    for coba in range(5):
        try:
            audio, kal = bytearray(), []
            async for c in edge_tts.Communicate(teks, suara, rate="-4%").stream():
                if c["type"] == "audio": audio += c["data"]
                elif c["type"] == "SentenceBoundary":
                    kal.append({"teks": c["text"], "mulai": c["offset"]/1e7, "durasi": c["duration"]/1e7})
            if not audio: raise edge_tts.exceptions.NoAudioReceived("kosong")
            open(f"_kerja/suara/{k}.mp3", "wb").write(audio)
            return kal
        except edge_tts.exceptions.NoAudioReceived:
            await asyncio.sleep(3)
    raise SystemExit(f"gagal {k}")

async def main():
    dur, kalimat = {}, {}
    for k, teks in data:
        kalimat[k] = await satu(k, teks)
        dur[k] = durasi(f"_kerja/suara/{k}.mp3")
        print(k, dur[k], len(kalimat[k]))
    json.dump(dur, open("_kerja/suara/durasi.json", "w"), indent=1)
    json.dump(kalimat, open("_kerja/suara/kalimat.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
asyncio.run(main())
