import { useId } from "react";
import { naturePhotos } from "./shared";
export const natureBoards = [
  ["野生来信主海报", 1200, 1600, "野生来信\nLETTERS FROM NATURE", 0],
  ["野花观察卡", 1000, 1400, "低头看见，\n另一片春天。", 1],
  ["热带花叶书封", 1200, 1600, "一页花开", 2],
  ["绿色生长横幅", 1800, 800, "让绿色，慢慢发生。", 3],
  ["冬日庭院摄影页", 1200, 1600, "安静，也在生长。", 4],
  ["植物档案封面", 1400, 1000, "一株植物的日常", 3],
  ["春日摄影明信片", 1600, 1000, "把花开寄给你。", 0],
  ["紫花社交方图", 1080, 1080, "春天很小，\n也很具体。", 1],
  ["花叶阅读书签", 600, 1800, "在书页之间，\n留下绿色。", 2],
  ["季节观察折页", 1800, 1000, "从花开，到落雪。", 4],
  ["自然留白海报", 1200, 1600, "不急着命名。", 0],
  ["叶片局部封面", 1400, 1000, "近一点，看见纹理。", 3],
  ["花序摄影展签", 1000, 1400, "把细节放大。", 0],
  ["紫花图文笔记", 1200, 1600, "沿着一朵花的方向。", 1],
  ["季节色彩档案", 1600, 1000, "从自然借来的颜色", 2],
  ["冬日长卷", 2000, 800, "等下一次，春天。", 4],
  ["自然观察邀请", 1200, 1600, "一起，慢慢看。", 2],
  ["庭院日历页", 1200, 1400, "这一页，留给生长。", 3],
  ["花叶双面小刊", 1600, 1200, "生活之外，\n还有一座小小花园。", 1],
  ["来信收束画板", 1200, 1200, "谢谢你，\n为自然留下一点时间。", 0],
].map(([title, w, h, copy, photo], index) => ({
  title: String(title),
  w: Number(w),
  h: Number(h),
  copy: String(copy),
  photo: Number(photo),
  index,
}));
export function NatureArtwork({
  index = 0,
  accent = "#285C99",
  caption,
}: {
  index?: number;
  accent?: string;
  caption?: string;
}) {
  const b = natureBoards[index],
    id = useId().replace(/:/g, ""),
    ink = "#182A37",
    white = "#FAF8F0",
    orange = "#D98A59",
    copy = caption ?? b.copy;
  const txt = (
    value: string,
    x: number,
    y: number,
    size = 50,
    color = ink,
    w = b.w - x - 55,
    space = 240,
  ) => {
    const lines = value.split("\n");
    const units = Math.max(
      1,
      ...lines.map((l) =>
        Array.from(l).reduce(
          (n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : 0.62),
          0,
        ),
      ),
    );
    const font = Math.min(
      size,
      w / units,
      lines.length > 1 ? space / (1.3 * (lines.length - 1)) : Infinity,
    );
    return (
      <text
        data-caption={value === copy ? "true" : undefined}
        x={x}
        y={y}
        fill={color}
        fontFamily="Arial, Noto Sans SC, sans-serif"
        fontSize={font}
        fontWeight={value === copy ? 600 : 400}
      >
        {lines.map((l, i) => (
          <tspan key={i} x={x} dy={i ? font * 1.3 : 0}>
            {l}
          </tspan>
        ))}
      </text>
    );
  };
  const img = (
    p: number,
    x: number,
    y: number,
    w: number,
    h: number,
    round = false,
  ) => (
    <g>
      <defs>
        <clipPath id={`${id}-${p}-${x}-${y}`}>
          {round ? (
            <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
          ) : (
            <rect x={x} y={y} width={w} height={h} />
          )}
        </clipPath>
      </defs>
      <image
        href={naturePhotos[p].url}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${id}-${p}-${x}-${y})`}
      />
    </g>
  );
  const rule = (y: number) => (
    <path d={`M55 ${y}H${b.w - 55}`} stroke={accent} strokeWidth="2" />
  );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="brand-artwork nature-artwork"
      data-artboard={index + 1}
      width={b.w}
      height={b.h}
      viewBox={`0 0 ${b.w} ${b.h}`}
      role="img"
      aria-label={`画板${index + 1} ${b.title}`}
    >
      <rect width={b.w} height={b.h} fill={white} />
      {index === 0 && (
        <>
          {img(0, 0, 0, b.w, 1100)}
          <rect x="45" y="810" width="1110" height="680" fill={accent} />
          {txt(copy, 100, 980, 125, white, 980, 270)}
          {txt("A SMALL ARCHIVE OF GROWING THINGS", 100, 1390, 24, white)}
          {rule(1520)}
        </>
      )}
      {index === 1 && (
        <>
          {txt("01", 55, 300, 240, accent)}
          {img(1, 320, 150, 620, 750)}
          {txt(copy, 55, 1030, 95, ink, 880, 165)}
          {txt("观察地点：________   日期：________", 55, 1290, 24)}
          {rule(1320)}
        </>
      )}
      {index === 2 && (
        <>
          <rect width="320" height="1600" fill={accent} />
          {img(2, 350, 90, 790, 1250)}
          {txt(copy, 370, 1460, 120)}
          {txt("FIELD NOTES / VOL. 02", 370, 1540, 23)}
          <text
            x="120"
            y="280"
            writingMode="vertical-rl"
            fill={white}
            fontSize="95"
            fontFamily="Arial, Noto Sans SC, sans-serif"
          >
            野生来信
          </text>
        </>
      )}
      {index === 3 && (
        <>
          <rect width="1800" height="800" fill={accent} />
          {img(3, 1080, 40, 660, 720)}
          {txt(copy, 80, 350, 99, white, 930, 190)}
          {txt("GROW AT YOUR OWN PACE.", 85, 675, 30, white)}
        </>
      )}
      {index === 4 && (
        <>
          {txt(copy, 60, 250, 92, accent)}
          {img(4, 60, 390, 1080, 950)}
          {txt("WINTER / 冬日庭院摄影", 60, 1440, 30)}
          {rule(1500)}
        </>
      )}
      {index === 5 && (
        <>
          {img(3, 80, 80, 650, 760)}
          <rect x="800" y="80" width="500" height="110" fill={accent} />
          {txt("ARCHIVE / 003", 835, 153, 36, white)}
          {txt(copy, 800, 370, 83, ink, 510, 180)}
          {[590, 680, 770].map((y) => (
            <path key={y} d={`M800 ${y}H1300`} stroke={accent} />
          ))}
          {txt("一份关于观察的空白档案", 805, 900, 25)}
        </>
      )}
      {index === 6 && (
        <>
          {img(0, 0, 0, 940, 1000)}
          {txt(copy, 1000, 240, 80, accent, 550, 220)}
          {[440, 545, 650, 755].map((y) => (
            <path key={y} d={`M1000 ${y}H1540`} stroke={ink} />
          ))}
          <rect
            x="1410"
            y="80"
            width="120"
            height="120"
            fill="none"
            stroke={accent}
            strokeDasharray="8 5"
          />
          {txt("TO /", 1000, 875, 24)}
        </>
      )}
      {index === 7 && (
        <>
          <rect width="1080" height="1080" fill="#E4DEF0" />
          {img(1, 130, 70, 820, 820, true)}
          <rect x="55" y="705" width="970" height="290" fill={accent} />
          {txt(copy, 95, 805, 76, white, 875, 120)}
        </>
      )}
      {index === 8 && (
        <>
          {img(2, 55, 65, 490, 1030)}
          {txt(copy, 55, 1230, 65, ink, 490, 210)}
          <circle cx="300" cy="1610" r="48" fill={accent} />
          {txt("READ SLOWLY", 80, 1740, 28)}
        </>
      )}
      {index === 9 && (
        <>
          {img(0, 0, 0, 580, 780)}
          {img(3, 610, 0, 580, 780)}
          {img(4, 1220, 0, 580, 780)}
          {txt(copy, 55, 910, 82, accent)}
          {[600, 1200].map((x) => (
            <path
              key={x}
              d={`M${x} 15V780`}
              stroke={ink}
              strokeDasharray="6 8"
            />
          ))}
        </>
      )}
      {index === 10 && (
        <>
          {txt(copy, 80, 270, 92, accent)}
          {img(0, 280, 530, 650, 700)}
          {txt("LEAVE SOME ROOM\nFOR THE UNNAMED.", 80, 1410, 28)}
          <rect x="80" y="410" width="70" height="8" fill={orange} />
        </>
      )}
      {index === 11 && (
        <>
          {img(3, 0, 0, 1400, 1000)}
          <rect x="80" y="590" width="1240" height="300" fill={white} />
          {txt(copy, 125, 730, 94, accent, 1150, 70)}
          {txt("TEXTURE STUDY / 004", 125, 836, 26)}
        </>
      )}
      {index === 12 && (
        <>
          {img(0, 70, 130, 860, 650)}
          {rule(845)}
          {txt(copy, 70, 1000, 85, accent, 860, 170)}
          {txt(
            "摄影排版练习 / 非植物鉴定资料\n观察提示：方向、层次、重复与光线",
            70,
            1170,
            28,
            ink,
            860,
            100,
          )}
        </>
      )}
      {index === 13 && (
        <>
          {txt(copy, 55, 245, 86, accent)}
          {img(1, 55, 380, 690, 870)}
          {[490, 630, 770, 910, 1050, 1190].map((y) => (
            <path key={y} d={`M815 ${y}H1140`} stroke="#ABB1B5" />
          ))}
          {txt("用自己的语言写下观察，不急于作出分类。", 55, 1430, 30)}
        </>
      )}
      {index === 14 && (
        <>
          {txt(copy, 55, 180, 85, accent)}
          {img(2, 55, 300, 600, 600)}
          {[accent, "#D8B6C5", "#819565", orange].map((c, i) => (
            <g key={c}>
              <rect
                x={720 + (i % 2) * 420}
                y={300 + Math.floor(i / 2) * 310}
                width="370"
                height="230"
                fill={c}
              />
              {txt(
                c,
                720 + (i % 2) * 420,
                570 + Math.floor(i / 2) * 310,
                24,
                ink,
                370,
              )}
            </g>
          ))}
        </>
      )}
      {index === 15 && (
        <>
          {img(4, 750, 0, 1250, 800)}
          <rect width="750" height="800" fill={accent} />
          {txt(copy, 65, 305, 105, white, 630, 240)}
          {txt("WAIT FOR THE NEXT SEASON.", 65, 690, 25, white, 630)}
        </>
      )}
      {index === 16 && (
        <>
          {txt(copy, 55, 300, 135, accent)}
          {img(2, 310, 520, 820, 740)}
          <circle cx="180" cy="650" r="110" fill={orange} />
          {txt("看", 125, 690, 110, white, 130)}
          {txt(
            "自然观察 / 概念活动视觉\n地点与时间由组织者核验后填写",
            55,
            1400,
            30,
            ink,
            1080,
            85,
          )}
        </>
      )}
      {index === 17 && (
        <>
          {img(3, 0, 0, 1200, 630)}
          {txt(copy, 55, 760, 76, accent)}
          {["日", "一", "二", "三", "四", "五", "六"].map((v, i) => (
            <g key={v}>
              {txt(v, 68 + i * 160, 905, 30, accent, 140)}
              {[0, 1, 2].map((j) => (
                <rect
                  key={j}
                  x={55 + i * 160}
                  y={955 + j * 105}
                  width="145"
                  height="85"
                  fill="none"
                  stroke="#C2CCD2"
                />
              ))}
            </g>
          ))}
        </>
      )}
      {index === 18 && (
        <>
          {img(1, 60, 95, 680, 910)}
          {txt(copy, 830, 340, 85, accent, 700, 230)}
          {txt("FIELD LETTERS\n花、叶与日常观察", 830, 850, 38, ink, 700, 140)}
          <path d="M790 80V1090" stroke={accent} />
        </>
      )}
      {index === 19 && (
        <>
          <rect width="1200" height="1200" fill={accent} />
          {img(0, 340, 110, 540, 540, true)}
          {txt(copy, 85, 790, 92, white, 1030, 190)}
          {txt("KEEP LOOKING / KEEP CARING", 90, 1080, 27, white)}
        </>
      )}
      <text
        x="35"
        y={b.h - 18}
        fill={index === 19 || index === 3 ? white : ink}
        fontSize="13"
        fontFamily="Arial, Noto Sans SC, sans-serif"
      >
        FIELD LETTERS / 摄影视觉练习 · CC BY-SA 4.0 图片改编 · 署名随导出保留
      </text>
    </svg>
  );
}
