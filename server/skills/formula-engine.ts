import Decimal from 'decimal.js';
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Scalar = number | string | boolean | Date | null | Decimal;
export type Reference = { sheet: string; address: string; end?: string };
type Node =
  | { type: 'number'; value: string }
  | { type: 'text'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'ref'; ref: Reference }
  | { type: 'unary'; op: string; child: Node }
  | { type: 'binary'; op: string; left: Node; right: Node }
  | { type: 'compare'; op: string; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };
/** Closed function whitelist. No eval, no Function, no JavaScript, no URLs, no Excel macros. */
const functions = new Set([
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS', 'MOD', 'POWER', 'INT', 'SQRT', 'SIGN', 'CEILING', 'FLOOR',
  'IF', 'IFERROR', 'AND', 'OR', 'NOT',
  'VLOOKUP', 'INDEX', 'MATCH', 'SUMIF', 'COUNTIF',
  'LEN', 'LEFT', 'RIGHT', 'MID', 'TRIM', 'UPPER', 'LOWER', 'CONCATENATE',
]);
/** Functions that may receive a rectangular range as a direct argument. */
const rangeFunctions = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'VLOOKUP', 'INDEX', 'MATCH', 'SUMIF', 'COUNTIF']);
export function addressParts(address: string) {
  const m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  if (!m) throw Error('无效单元格引用。');
  const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0), row = Number(m[2]);
  if (col > 50 || row > 2000) throw Error('引用超出2000行/50列支持范围。');
  return { row, col };
}
/** Closed grammar: numbers, quoted text, booleans, cell/range references, arithmetic, comparison, concatenation and whitelisted functions. */
export function parseFormula(source: string, sheet: string) {
  if (!source || source.length > 512) throw Error('公式为空或超过512字。');
  let pos = 0, count = 0;
  const dependencies: Reference[] = [];
  const skip = () => { while (/\s/.test(source[pos] || '') && pos < source.length) pos++; };
  const take = (s: string) => { skip(); if (source.startsWith(s, pos)) { pos += s.length; return true; } return false; };
  const node = <T extends Node>(value: T): T => { if (++count > 256) throw Error('公式节点超过256。'); return value; };
  function primary(depth: number): Node {
    if (depth > 64) throw Error('公式嵌套超过64层。');
    skip();
    if (take('+')) return node({ type: 'unary', op: '+', child: primary(depth + 1) });
    if (take('-')) return node({ type: 'unary', op: '-', child: primary(depth + 1) });
    if (take('(')) { const result = expression(depth + 1); if (!take(')')) throw Error('公式括号不匹配。'); return result; }
    if (take('"')) {
      let value = '';
      for (;;) {
        if (pos >= source.length) throw Error('文本常量没有结束引号。');
        if (source[pos] === '"') { if (source[pos + 1] === '"') { value += '"'; pos += 2; continue; } pos++; break; }
        value += source[pos++];
      }
      if (value.length > 1000) throw Error('文本常量超过1000字。');
      return node({ type: 'text', value });
    }
    // An explicit sheet qualifier takes precedence over numeric literals (e.g. 2026!A1).
    const qualifier = /^(?:'((?:[^']|'')+)'|([^\s'!+*/(),:%=<>\[\]^-]+))!/.exec(source.slice(pos));
    let target = sheet;
    if (qualifier) { target = (qualifier[1]?.replace(/''/g, "'") ?? qualifier[2]); pos += qualifier[0].length; }
    if (!qualifier) {
      const fn = /^([A-Za-z_][A-Za-z_0-9.]*)\s*\(/.exec(source.slice(pos));
      if (fn) {
        const name = fn[1].toUpperCase(); if (!functions.has(name)) throw Error(`不支持函数${name}，没有使用缓存结果。`);
        pos += fn[0].length; const args: Node[] = [];
        if (!take(')')) { do { if (args.length >= 32) throw Error('函数最多32个参数。'); args.push(expression(depth + 1)); } while (take(',')); if (!take(')')) throw Error('函数参数或括号不合法。'); }
        if (!args.length) throw Error('函数参数数量不正确。');
        if ((name === 'ROUND' || name === 'ROUNDUP' || name === 'ROUNDDOWN' || name === 'MOD' || name === 'POWER' || name === 'CEILING' || name === 'FLOOR') && args.length !== 2) throw Error('函数参数数量不正确。');
        if ((name === 'ABS' || name === 'INT' || name === 'SQRT' || name === 'SIGN' || name === 'NOT' || name === 'LEN' || name === 'TRIM' || name === 'UPPER' || name === 'LOWER') && args.length !== 1) throw Error('函数参数数量不正确。');
        if ((name === 'LEFT' || name === 'RIGHT') && (args.length < 1 || args.length > 2)) throw Error('函数参数数量不正确。');
        if (name === 'MID' && args.length !== 3) throw Error('函数参数数量不正确。');
        if ((name === 'IF' || name === 'IFERROR') && (args.length < 2 || args.length > 3)) throw Error('函数参数数量不正确。');
        if ((name === 'AND' || name === 'OR') && (args.length < 1 || args.length > 32)) throw Error('函数参数数量不正确。');
        if (name === 'VLOOKUP' && (args.length < 3 || args.length > 4)) throw Error('函数参数数量不正确。');
        if (name === 'INDEX' && (args.length < 2 || args.length > 3)) throw Error('函数参数数量不正确。');
        if (name === 'MATCH' && (args.length < 2 || args.length > 3)) throw Error('函数参数数量不正确。');
        if (name === 'SUMIF' && (args.length < 2 || args.length > 3)) throw Error('函数参数数量不正确。');
        if (name === 'COUNTIF' && args.length !== 2) throw Error('函数参数数量不正确。');
        return node({ type: 'call', name, args });
      }
      const literal = /^(TRUE|FALSE)(?![A-Za-z_0-9.])/i.exec(source.slice(pos));
      if (literal) { pos += literal[0].length; return node({ type: 'boolean', value: literal[0].toUpperCase() === 'TRUE' }); }
      const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
      if (num) { pos += num[0].length; return node({ type: 'number', value: num[0] }); }
    }
    const cell = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)/.exec(source.slice(pos));
    if (!cell) throw Error('不支持的公式语法：仅支持数值运算、文本常量、布尔值、比较、单元格/同表矩形区域及白名单函数；不支持名称、数组、外部引用。');
    pos += cell[0].length; const address = cell[1].toUpperCase() + cell[2]; addressParts(address);
    let end: string | undefined;
    if (take(':')) { skip(); const last = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)/.exec(source.slice(pos)); if (!last) throw Error('区域终点必须是同表单元格，不支持跨表三维区域。'); pos += last[0].length; end = last[1].toUpperCase() + last[2]; addressParts(end); }
    const ref = { sheet: target, address, ...(end ? { end } : {}) }; dependencies.push(ref); return node({ type: 'ref', ref });
  }
  function factor(depth: number): Node {
    let value = primary(depth);
    while (take('%')) value = node({ type: 'unary', op: '%', child: value });
    return value;
  }
  function product(depth: number): Node {
    let value = factor(depth); while (true) {
      if (take('*')) value = node({ type: 'binary', op: '*', left: value, right: factor(depth + 1) });
      else if (take('/')) value = node({ type: 'binary', op: '/', left: value, right: factor(depth + 1) });
      else break;
    } return value;
  }
  function additive(depth: number): Node {
    let value = product(depth); while (true) {
      if (take('+')) value = node({ type: 'binary', op: '+', left: value, right: product(depth + 1) });
      else if (take('-')) value = node({ type: 'binary', op: '-', left: value, right: product(depth + 1) });
      else break;
    } return value;
  }
  function concat(depth: number): Node {
    let value = additive(depth); while (take('&')) value = node({ type: 'binary', op: '&', left: value, right: additive(depth + 1) });
    return value;
  }
  function expression(depth: number): Node {
    let value = concat(depth); while (true) {
      skip();
      const op = source.startsWith('<>', pos) ? '<>' : source.startsWith('<=', pos) ? '<=' : source.startsWith('>=', pos) ? '>=' : ['=', '<', '>'].find(candidate => source[pos] === candidate);
      if (!op) break;
      pos += op.length; value = node({ type: 'compare', op, left: value, right: concat(depth + 1) });
    } return value;
  }
  if (source.startsWith('=')) pos++;
  const tree = expression(0); skip(); if (pos !== source.length) throw Error('公式包含未支持的语法或尾随内容，没有交付部分计算结果。');
  return { tree, dependencies };
}
function bounded(value: Decimal) {
  if (!value.isFinite() || value.abs().gt('1e15') || (!value.isZero() && value.abs().lt('1e-30'))) throw Error('数值或中间结果超出范围：绝对值≤1e15，非零绝对值≥1e-30。');
  return value;
}
function numeric(value: Scalar): Decimal {
  if (value === null) return new D(0);
  if (value instanceof Decimal || typeof value === 'number') return bounded(new D(value));
  throw Error('数值运算引用了文本、布尔或日期；不会隐式转换类型。');
}
function text(value: Scalar): string {
  if (value === null) return '';
  if (value instanceof Date) throw Error('不支持日期运算；本引擎不计算Excel日期序列。');
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  if (value instanceof Decimal) return value.toSignificantDigits(15).toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(Number(value.toPrecision(15))) : '';
  throw Error('无法转换为文本。');
}
function truthy(value: Scalar): boolean {
  if (value === null) return false;
  if (typeof value === 'boolean') return value;
  if (value instanceof Decimal || typeof value === 'number') return !new D(value).isZero();
  throw Error('逻辑判断只接受数值或布尔值；文本不能当作条件。');
}
/** Excel-like ordering without implicit number/text coercion; blank compares as 0, "" or FALSE depending on the other side. */
function compareValues(left: Scalar, right: Scalar): number {
  if (left === null && right === null) return 0;
  if (left === null) {
    if (typeof right === 'string') return compareText('', right);
    if (typeof right === 'boolean') return compareText('FALSE', right ? 'TRUE' : 'FALSE');
    return compareDecimal(new D(0), right as Decimal);
  }
  if (right === null) return -compareValues(right, left);
  if (typeof left === 'string' || typeof right === 'string') {
    // Numbers and booleans are never equal to text; numbers sort before text.
    if (typeof left !== typeof right) return typeof left === 'string' ? 1 : -1;
    return compareText(left as string, right as string);
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') return left === right ? 0 : (left ? 1 : -1);
  return compareDecimal(numeric(left), numeric(right));
}
function compareText(left: string, right: string): number {
  const a = left.toLocaleUpperCase(), b = right.toLocaleUpperCase();
  return a === b ? 0 : (a < b ? -1 : 1);
}
function compareDecimal(left: Decimal, right: Decimal): number {
  return left.eq(right) ? 0 : (left.lt(right) ? -1 : 1);
}
/** Equality used by lookups; text comparison is case-insensitive like Excel, mixed types never match. */
function equalsValue(left: Scalar, right: Scalar): boolean {
  if (left === null || right === null) {
    const blank = left === null ? right : left, other = left === null ? left : right;
    if (other === null) return true;
    if (typeof blank === 'number') return blank === 0;
    if (typeof blank === 'string') return blank === '';
    if (typeof blank === 'boolean') return blank === false;
    return false;
  }
  if (typeof left === 'string' || typeof right === 'string') return typeof left === 'string' && typeof right === 'string' && left.toLocaleUpperCase() === right.toLocaleUpperCase();
  if (typeof left === 'boolean' || typeof right === 'boolean') return typeof left === 'boolean' && typeof right === 'boolean' && left === right;
  return compareDecimal(numeric(left), numeric(right)) === 0;
}
function matchesCriteria(value: Scalar, criteria: Scalar): boolean {
  if (typeof criteria === 'string') {
    const parsed = /^(>=|<=|<>|>|<|=)\s*([\s\S]*)$/.exec(criteria);
    if (parsed) {
      const raw = parsed[2].trim();
      const operand: Scalar = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ? new D(raw) : raw;
      const order = compareValues(value, operand);
      switch (parsed[1]) { case '=': return order === 0; case '<>': return order !== 0; case '>': return order > 0; case '<': return order < 0; case '>=': return order >= 0; case '<=': return order <= 0; }
    }
    return equalsValue(value, criteria);
  }
  return equalsValue(value, criteria);
}
/** Decimal instances are created by a cloned constructor, so detect them by shape as well as by prototype. */
export function isDecimalValue(value: unknown): value is Decimal {
  return value instanceof Decimal || (typeof value === 'object' && value !== null && typeof (value as { toSignificantDigits?: unknown }).toSignificantDigits === 'function' && typeof (value as { isNegative?: unknown }).isNegative === 'function');
}
/** Cell-safe conversion for engine results: numbers stay numbers, text and booleans are preserved as-is. */
export function scalarToCell(value: Scalar): number | string | boolean | null {
  if (value === null) return null;
  if (isDecimalValue(value)) return Number(value.toString());
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  throw Error('公式结果不能是日期。');
}
export function evaluateFormula(tree: Node, read: (ref: Reference) => Scalar[], tick: () => void): Scalar {
  function gridOf(node: Node): { values: Scalar[]; rows: number; cols: number } {
    if (node.type !== 'ref') throw Error('查找或条件统计函数需要单元格区域参数。');
    const start = addressParts(node.ref.address), end = addressParts(node.ref.end || node.ref.address);
    if (start.row > end.row || start.col > end.col) throw Error('不支持倒序区域，请使用左上角:右下角。');
    const values = read(node.ref);
    const rows = end.row - start.row + 1, cols = end.col - start.col + 1;
    if (values.length !== rows * cols) throw Error('区域读取结果与范围不一致。');
    return { values, rows, cols };
  }
  function evaluate(n: Node, depth = 0): Scalar[] {
    tick(); if (depth > 64) throw Error('计算表达式嵌套超过64层。');
    const single = (node: Node): Scalar => {
      if (node.type === 'ref' && node.ref.end) throw Error('矩形区域只允许作为聚合、查找或条件统计函数的直接参数。');
      const values = evaluate(node, depth + 1); if (values.length !== 1) throw Error('此处需要单一数值。'); return values[0];
    };
    const number = (node: Node): Decimal => numeric(single(node));
    if (n.type === 'number') return [bounded(new D(n.value))];
    if (n.type === 'text') return [n.value];
    if (n.type === 'boolean') return [n.value];
    if (n.type === 'ref') return read(n.ref);
    if (n.type === 'unary') {
      const value = number(n.child);
      if (n.op === '%') return [bounded(value.div(100))];
      return [bounded(n.op === '-' ? value.negated() : value)];
    }
    if (n.type === 'binary') {
      if (n.op === '&') return [text(single(n.left)) + text(single(n.right))];
      const a = number(n.left), b = number(n.right); if (n.op === '/' && b.isZero()) throw Error('除数为零。');
      return [bounded(n.op === '+' ? a.plus(b) : n.op === '-' ? a.minus(b) : n.op === '*' ? a.times(b) : a.div(b))];
    }
    if (n.type === 'compare') {
      const order = compareValues(single(n.left), single(n.right));
      switch (n.op) { case '=': return [order === 0]; case '<>': return [order !== 0]; case '<': return [order < 0]; case '<=': return [order <= 0]; case '>': return [order > 0]; case '>=': return [order >= 0]; }
      throw Error('不支持的比较运算符。');
    }
    const name = n.name;
    if (name === 'IF') {
      const condition = truthy(single(n.args[0]));
      if (condition) return [single(n.args[1])];
      if (n.args.length < 3) return [false];
      return [single(n.args[2])];
    }
    if (name === 'IFERROR') {
      try { return [single(n.args[0])]; }
      catch { return [single(n.args[1])]; }
    }
    if (name === 'AND' || name === 'OR') {
      const flags = n.args.map(arg => truthy(single(arg)));
      return [name === 'AND' ? flags.every(Boolean) : flags.some(Boolean)];
    }
    if (name === 'NOT') return [!truthy(single(n.args[0]))];
    if (name === 'ABS') return [number(n.args[0]).abs()];
    if (name === 'INT') { const value = number(n.args[0]); return [bounded(value.isNegative() && !value.isInteger() ? value.floor() : value.floor())]; }
    if (name === 'SQRT') { const value = number(n.args[0]); if (value.isNegative()) throw Error('SQRT不接受负数。'); return [bounded(value.sqrt())]; }
    if (name === 'SIGN') { const value = number(n.args[0]); return [new D(value.isZero() ? 0 : value.isNegative() ? -1 : 1)]; }
    if (name === 'ROUND' || name === 'ROUNDUP' || name === 'ROUNDDOWN') {
      const value = number(n.args[0]), places = number(n.args[1]);
      if (!places.isInteger() || places.abs().gt(15)) throw Error('舍入位数必须为-15至15的整数。');
      const factor = new D(10).pow(places.toNumber());
      const scaled = value.times(factor);
      const rounded = name === 'ROUND' ? scaled.toDecimalPlaces(0, D.ROUND_HALF_UP) : name === 'ROUNDUP' ? scaled.toDecimalPlaces(0, D.ROUND_UP) : scaled.toDecimalPlaces(0, D.ROUND_DOWN);
      return [bounded(rounded.div(factor))];
    }
    if (name === 'MOD') {
      const value = number(n.args[0]), divisor = number(n.args[1]);
      if (divisor.isZero()) throw Error('MOD的除数为零。');
      // Excel MOD keeps the sign of the divisor, unlike a truncated remainder.
      const remainder = value.modulo(divisor);
      const adjusted = !remainder.isZero() && remainder.isNegative() !== divisor.isNegative() ? remainder.plus(divisor) : remainder;
      return [bounded(adjusted)];
    }
    if (name === 'POWER') {
      const base = number(n.args[0]), exponent = number(n.args[1]);
      if (!exponent.isInteger()) throw Error('POWER只接受整数指数。');
      if (exponent.abs().gt(64) || base.abs().gt(1e12) || base.isZero()) throw Error('幂运算超出支持范围。');
      return [bounded(base.pow(exponent.toNumber()))];
    }
    if (name === 'CEILING' || name === 'FLOOR') {
      const value = number(n.args[0]), step = number(n.args[1]);
      if (step.isZero()) throw Error('步长不能为零。');
      if (step.isNegative()) throw Error('步长必须为正数。');
      const ratio = value.div(step);
      const rounded = name === 'CEILING' ? ratio.ceil() : ratio.floor();
      return [bounded(rounded.times(step))];
    }
    if (name === 'VLOOKUP') {
      const needle = single(n.args[0]);
      const grid = gridOf(n.args[1]);
      const index = number(n.args[2]);
      if (!index.isInteger() || index.lt(1) || index.gt(grid.cols)) throw Error('VLOOKUP的列序号超出区域范围。');
      if (n.args.length > 3) {
        const flag = single(n.args[3]);
        if (flag !== false && flag !== 0) throw Error('VLOOKUP只支持精确匹配（FALSE或省略）；近似匹配需要有序数据。');
      }
      for (let row = 0; row < grid.rows; row++) {
        const candidate = grid.values[row * grid.cols];
        if (equalsValue(candidate, needle)) {
          const found = grid.values[row * grid.cols + index.toNumber() - 1];
          return [found === null ? new D(0) : found];
        }
      }
      throw Error('VLOOKUP未找到匹配值。');
    }
    if (name === 'MATCH') {
      const needle = single(n.args[0]);
      const grid = gridOf(n.args[1]);
      if (grid.rows > 1 && grid.cols > 1) throw Error('MATCH只支持单行或单列区域。');
      if (n.args.length > 2) {
        const flag = number(n.args[2]);
        if (!flag.isZero()) throw Error('MATCH只支持精确匹配（0）。');
      }
      for (let i = 0; i < grid.values.length; i++) {
        const candidate = grid.values[i];
        if (candidate === null) { if (needle === null) return [new D(i + 1)]; continue; }
        if (typeof candidate === 'string' && typeof needle === 'string') { if (candidate.toLocaleUpperCase() === needle.toLocaleUpperCase()) return [new D(i + 1)]; continue; }
        if (typeof candidate === 'string' || typeof needle === 'string') continue;
        if (compareValues(candidate, needle) === 0) return [new D(i + 1)];
      }
      throw Error('MATCH未找到匹配值。');
    }
    if (name === 'INDEX') {
      const grid = gridOf(n.args[0]);
      const row = number(n.args[1]);
      if (!row.isInteger() || row.lt(1)) throw Error('INDEX的行序号必须为正整数。');
      if (grid.rows === 1 && grid.cols > 1) {
        if (n.args.length > 2) throw Error('单行区域的INDEX不接受列序号。');
        const column = number(n.args[1]);
        if (!column.isInteger() || column.lt(1) || column.gt(grid.cols)) throw Error('INDEX的列序号超出区域范围。');
        const found = grid.values[column.toNumber() - 1];
        return [found === null ? new D(0) : found];
      }
      if (row.gt(grid.rows)) throw Error('INDEX的行序号超出区域范围。');
      if (grid.cols === 1) {
        if (n.args.length > 2) throw Error('单列区域的INDEX不接受列序号。');
        const found = grid.values[(row.toNumber() - 1) * grid.cols];
        return [found === null ? new D(0) : found];
      }
      if (n.args.length < 3) throw Error('多行多列区域的INDEX必须同时指定行号和列号。');
      const column = number(n.args[2]);
      if (!column.isInteger() || column.lt(1) || column.gt(grid.cols)) throw Error('INDEX的列序号超出区域范围。');
      const found = grid.values[(row.toNumber() - 1) * grid.cols + column.toNumber() - 1];
      return [found === null ? new D(0) : found];
    }
    if (name === 'SUMIF' || name === 'COUNTIF') {
      const grid = gridOf(n.args[0]);
      const criteria = single(n.args[1]);
      let sumGrid = grid;
      if (n.args.length > 2) {
        sumGrid = gridOf(n.args[2]);
        if (sumGrid.values.length !== grid.values.length) throw Error('SUMIF的求和区域与条件区域大小不一致。');
      }
      let count = 0;
      let sum = new D(0);
      for (let i = 0; i < grid.values.length; i++) {
        if (!matchesCriteria(grid.values[i], criteria)) continue;
        count++;
        const target = sumGrid.values[i];
        if (target instanceof Decimal || typeof target === 'number') sum = bounded(sum.plus(numeric(target)));
      }
      return [name === 'COUNTIF' ? new D(count) : bounded(sum)];
    }
    if (name === 'LEN') return [new D(text(single(n.args[0])).length)];
    if (name === 'LEFT' || name === 'RIGHT') {
      const value = text(single(n.args[0]));
      const count = n.args.length > 1 ? number(n.args[1]) : new D(1);
      if (!count.isInteger() || count.isNegative() || count.gt(32767)) throw Error('截取长度必须为0至32767的整数。');
      const size = count.toNumber();
      return [name === 'LEFT' ? value.slice(0, size) : value.slice(Math.max(0, value.length - size))];
    }
    if (name === 'MID') {
      const value = text(single(n.args[0]));
      const start = number(n.args[1]), length = number(n.args[2]);
      if (!start.isInteger() || start.lt(1) || start.gt(32767)) throw Error('MID起始位置必须为1至32767的整数。');
      if (!length.isInteger() || length.isNegative() || length.gt(32767)) throw Error('MID长度必须为0至32767的整数。');
      return [value.slice(start.toNumber() - 1, start.toNumber() - 1 + length.toNumber())];
    }
    if (name === 'TRIM') return [text(single(n.args[0])).replace(/\s+/g, ' ').trim()];
    if (name === 'UPPER') return [text(single(n.args[0])).toLocaleUpperCase()];
    if (name === 'LOWER') return [text(single(n.args[0])).toLocaleLowerCase()];
    if (name === 'CONCATENATE') return [n.args.map(arg => text(single(arg))).join('')];
    const raw = n.args.flatMap(arg => evaluate(arg, depth + 1));
    if (raw.some(v => v instanceof Date)) throw Error('聚合引用了日期；当前不计算Excel日期序列。');
    const values = raw.filter(v => v instanceof Decimal || typeof v === 'number').map(v => numeric(v));
    if (name === 'COUNT') return [new D(values.length)];
    if (!values.length) { if (name === 'AVERAGE') throw Error('AVERAGE没有数值，不能除以零。'); return [new D(0)]; }
    if (name === 'MIN' || name === 'MAX') return [values.reduce((a, b) => name === 'MIN' ? (a.lt(b) ? a : b) : (a.gt(b) ? a : b))];
    const sum = values.reduce((a, b) => bounded(a.plus(b)), new D(0));
    return [bounded(name === 'AVERAGE' ? sum.div(values.length) : sum)];
  }
  if (tree.type === 'ref' && tree.ref.end) throw Error('公式结果不能是区域或数组。');
  const result = evaluate(tree); if (result.length !== 1) throw Error('公式结果不是单一数值。');
  const value = result[0];
  if (value === null) return new D(0);
  if (value instanceof Date) throw Error('公式结果不能是日期。');
  return value;
}
