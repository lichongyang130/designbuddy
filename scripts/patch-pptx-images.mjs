import fs from 'fs';
const file = 'apps/web/src/inspiration/samples/GenericSlide.tsx';
let content = fs.readFileSync(file, 'utf-8');

const exportRegex = /const exportPPTX = async \(\) => \{[\s\S]*?msg\("PPTX 导出失败，请检查网络。"\);\n    \}\n  \};/;

const newExportLogic = `const exportPPTX = async () => {
    msg("正在打包并生成带有高清配图的完整 PPTX，请稍候...");
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pres = new PptxGenJS();
      pres.layout = "LAYOUT_16x9";
      
      // Default 16:9 in pptxgenjs is 10 x 5.625 inches
      const currentSlides = s.slides || initialSlides;
      for (const sl of currentSlides) {
        const slide = pres.addSlide();
        
        const fetchImageBase64 = async (url: string) => {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        };

        if (sl.layout === 'cover') {
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) slide.addImage({ data: b64, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover', w: 10, h: 5.625 } });
          slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "0F111A", transparency: 30 } });
          slide.addText(sl.title, { x: 1, y: 1.5, w: 8, h: 2, fontSize: 44, bold: true, color: "FFFFFF", breakLine: true });
          slide.addText(sl.subtitle, { x: 1, y: 4, w: 8, h: 1, fontSize: 18, color: "9CA3AF" });
        } else if (sl.layout === 'split') {
          slide.background = { color: "FFFFFF" };
          slide.addText(sl.title, { x: 0.5, y: 0.5, w: 4.5, h: 1, fontSize: 28, bold: true, color: "111827" });
          const bullets = sl.subtitle.split('\\n').map((b: string) => ({ text: b, options: { bullet: true } }));
          slide.addText(bullets, { x: 0.5, y: 2, w: 4.5, h: 3, fontSize: 18, color: "4B5563" });
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) {
            slide.addImage({ data: b64, x: 5, y: 0, w: 5, h: 5.625, sizing: { type: 'cover', w: 5, h: 5.625 } });
          } else {
            slide.addText("[ Image Placeholder ]", { x: 5, y: 0, w: 5, h: 5.625, fill: { color: "F3F4F6" }, align: 'center', color: "9CA3AF" });
          }
        } else if (sl.layout === 'full') {
          const b64 = await fetchImageBase64(sl.photoUrl);
          if (b64) slide.addImage({ data: b64, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover', w: 10, h: 5.625 } });
          slide.addShape(pres.ShapeType.rect, { x: 0, y: 4.625, w: 10, h: 1, fill: { color: "000000", transparency: 20 } });
          slide.addText(sl.title, { x: 0.5, y: 4.625, w: 9, h: 1, fontSize: 20, bold: true, color: "FFFFFF", align: 'left' });
        } else {
          // statement
          slide.background = { color: "F9FAFB" };
          slide.addText(sl.title, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 36, bold: true, color: "111827", align: 'center' });
          slide.addShape(pres.ShapeType.rect, { x: 4.5, y: 4, w: 1, h: 0.1, fill: { color: "4F46E5" } });
        }
      }
      pres.writeFile({ fileName: \`\${sample.id}-presentation.pptx\` });
      msg("PPTX 导出成功！文件包含高清图片与完整排版结构。");
    } catch (e) {
      console.error(e);
      msg("PPTX 导出失败，请检查网络。");
    }
  };`;

content = content.replace(exportRegex, newExportLogic);
fs.writeFileSync(file, content, 'utf-8');
