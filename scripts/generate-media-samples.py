"""Rebuild the original local media samples. Requires Pillow and imageio-ffmpeg.
No remote downloads. Uses the repository's AI concept images, not real hotel footage.
Run: python scripts/generate-media-samples.py
"""
from pathlib import Path
import math, struct, wave, subprocess
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/src/assets/media'
OUT.mkdir(parents=True, exist_ok=True)
font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font = ImageFont.truetype(font_path, 34) if Path(font_path).exists() else ImageFont.load_default(size=34)
small = ImageFont.truetype(font_path, 16) if Path(font_path).exists() else ImageFont.load_default(size=16)
shots = [('hotel', 'A QUIET WEEKEND', '01 / ARRIVE'), ('suite', 'ROOM TO BREATHE', '02 / STAY'), ('interior', 'LIGHT, SPACE, TIME', '03 / SLOW DOWN')]
images = [Image.open(ROOT / f'apps/web/src/assets/scenes/{name}.webp').convert('RGB') for name, _, _ in shots]
w, h, fps = 960, 540, 24
command = [imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-f', 'rawvideo', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(OUT/'lakeside-film.mp4')]
process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
for i in range(18*fps):
    t = i/fps
    index = min(2, int(t/6))
    local = t-index*6
    source = images[index]
    scale = max(w/source.width, h/source.height)*(1.02+local/6*.09)
    resized = source.resize((round(source.width*scale), round(source.height*scale)), Image.Resampling.LANCZOS)
    left = (resized.width-w)//2
    top = (resized.height-h)//2
    frame = resized.crop((left,top,left+w,top+h))
    fade = max(0, min(1, local/.45, (6-local)/.45))
    frame = Image.blend(Image.new('RGB',(w,h),'#101917'), frame, fade)
    shade = Image.new('RGBA',(w,h))
    draw = ImageDraw.Draw(shade)
    for y in range(h):
        alpha = int(120*max(0,(y-h*.45)/(h*.55)))
        draw.line((0,y,w,y),fill=(8,18,14,alpha))
    frame = Image.alpha_composite(frame.convert('RGBA'),shade)
    draw = ImageDraw.Draw(frame)
    draw.text((42,35),'LAKESIDE / VISUAL ESSAY',font=small,fill='#f1e9d8')
    draw.text((42,h-122),shots[index][1],font=font,fill='#f1e9d8')
    draw.text((44,h-68),shots[index][2]+'   /   CONCEPT PHOTOGRAPHY',font=small,fill='#e0dece')
    draw.line((42,h-30,42+int((w-84)*t/18),h-30),fill='#d3dcbf',width=2)
    if i == 48: frame.convert('RGB').save(OUT/'lakeside-poster.webp',quality=88)
    process.stdin.write(frame.convert('RGB').tobytes())
process.stdin.close()
error = process.stderr.read().decode()
if process.wait(): raise RuntimeError(error)
# Original 8-second procedural sound logo. Same formula as the client editor.
sr, duration, tempo, tone, gain = 22050, 8, 72, .45, .65
notes = [261.6256,329.6276,391.9954,523.2511,391.9954,329.6276,293.6648,261.6256]
with wave.open(str(OUT/'soft-signals.wav'),'wb') as output:
    output.setnchannels(1);output.setsampwidth(2);output.setframerate(sr)
    pcm = bytearray()
    for i in range(sr*duration):
        t=i/sr
        value=0
        for n,freq in enumerate(notes):
            dt=t-n*60/tempo
            if 0<=dt<2.5:
                env=(1-math.exp(-dt*55))*math.exp(-dt*2.5)
                value+=env*(math.sin(2*math.pi*freq*dt)+tone*.3*math.sin(2*math.pi*freq*2*dt))*.26
        value*=min(1,t/.06,(duration-t)/.2)*gain
        pcm.extend(struct.pack('<h',round(max(-1,min(1,value))*32767)))
    output.writeframes(pcm)
print('Generated', OUT/'lakeside-film.mp4', OUT/'soft-signals.wav')
