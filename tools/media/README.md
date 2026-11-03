# 案例媒体（mp3 / mp4）

`apps/web/public/cases/` 下有两套案例带真媒体，都是这个目录里的脚本生成的，可以重跑：

| 文件 | 用途 | 生成方式 |
| --- | --- | --- |
| `cases/fogsignal/01.mp3` | 音频套的曲子（48.0 s） | `node tools/media/synth.mjs fog out.wav` → `ffmpeg -i out.wav -codec:a libmp3lame -b:a 160k 01.mp3` |
| `cases/poolside/film.mp4` | 视频套的片子（24.0 s） | 四张静帧逐张 zoompan 成 6 s 片段 + 淡入淡出，concat 后混入 `synth.mjs bed` 的底噪 |

沙箱里没有系统 ffmpeg，也没有外网下 `ffmpeg-static`（它要从 release-assets.githubusercontent.com 拉二进制）。
能用的那份是 npm 包 `@ffmpeg-installer/ffmpeg`（二进制在 tarball 里，走 registry）：

```sh
npm i @ffmpeg-installer/ffmpeg
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"   # 2018 年版，带 libx264 / libmp3lame
```

那版 ffmpeg 没有 `xfade`（4.3 才有），所以转场用「每段首尾 `fade` + concat」实现：

```sh
ffmpeg -loop 1 -i 01.jpg -t 6 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,\
zoompan=z='1+0.00055*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1280x720:fps=25,setsar=1" \
  -c:v libx264 -crf 20 -pix_fmt yuv420p c1.mp4
# 四段同样处理后：
ffmpeg -i c1.mp4 -vf "fade=t=in:st=0:d=0.7,fade=t=out:st=5.3:d=0.7" -c:v libx264 -crf 20 f1.mp4   # ×4
ffmpeg -f concat -safe 0 -i list.txt -c copy silent.mp4
ffmpeg -i silent.mp4 -i bed.wav -filter_complex \
  "[1:a]atrim=0:24,afade=t=in:st=0:d=1.8,afade=t=out:st=20.6:d=3.4,volume=0.85[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -movflags +faststart film.mp4
```

两个文件都做成了 `+faststart`（moov 前置），浏览器里点开就能流式播放；
`<video preload="none">` / `<audio preload="metadata">`，缩略图不会预取整条片子。
