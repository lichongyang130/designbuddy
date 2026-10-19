import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { sha256 } from './sources';
export const presentationFont = { family: 'Noto Sans SC', sha256: 'eeb06b8a64fd04a2744d95579db1571b51027cda61ed78c62e4b730791525461', boldSHA256: 'a8d8569e6cf8e93e830736e64c69568c5499ff65bf6a8ff860f0cdacc3eab7d0', license: 'SIL Open Font License 1.1', source: 'https://api.github.com/repos/google/fonts/git/blobs/fb0637bafbcd804fe32152370a1225990745b4bc' };
let loaded: { directory: string; font: any; boldFont: any } | undefined;
export function presentationFonts(): { directory: string; font: any; boldFont: any } {
  if (loaded) return loaded;
  const roots = [process.env.DESIGNBUDDY_ASSET_ROOT || process.cwd(), resolve(__dirname, '../../../../..'), resolve(__dirname, '../../..')];
  const root = roots.find(r => existsSync(resolve(r, 'assets/presentation-fonts/NotoSansSC.ttf')));
  if (!root) throw Error('中文演示字体未安装；需随部署保留 assets/presentation-fonts 和 OFL 许可。');
  const directory = resolve(root, 'assets/presentation-fonts'), buffer = readFileSync(resolve(directory, 'NotoSansSC.ttf'));
  if (sha256(buffer) !== presentationFont.sha256 || !existsSync(resolve(directory, 'OFL.txt'))) throw Error('中文字体哈希或许可校验失败。');
  const boldBuffer = readFileSync(resolve(directory, 'NotoSansSC-Bold.ttf'));
  if (sha256(boldBuffer) !== presentationFont.boldSHA256) throw Error('中文粗体字体哈希校验失败。');
  const font = fontkit.create(buffer), boldFont = fontkit.create(boldBuffer);
  loaded = { directory, font, boldFont }; return loaded;
}
export function presentationFontsAvailable(): boolean { try { presentationFonts(); return true; } catch { return false; } }
