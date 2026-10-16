import Decimal from 'decimal.js';
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Scalar = number | string | boolean | Date | null | Decimal;
export type Reference = { sheet: string; address: string; end?: string };
type Node = { type: 'number'; value: string } | { type: 'ref'; ref: Reference } | { type: 'unary'; op: string; child: Node } | { type: 'binary'; op: string; left: Node; right: Node } | { type: 'call'; name: string; args: Node[] };
const functions = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'ROUND', 'ABS']);
export function addressParts(address: string) {
  const m = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
  if (!m) throw Error('无效单元格引用。');
  const col = [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0), row = Number(m[2]);
  if (col > 50 || row > 2000) throw Error('引用超出2000行/50列支持范围。');
  return { row, col };
}
/** Closed arithmetic grammar. No eval, Function, JavaScript, URLs or Excel macros. */
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
        if (!args.length || (name === 'ROUND' && args.length !== 2) || (name === 'ABS' && args.length !== 1)) throw Error('函数参数数量不正确。');
        return node({ type: 'call', name, args });
      }
      const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
      if (num) { pos += num[0].length; return node({ type: 'number', value: num[0] }); }
    }
    const cell = /^\$?([A-Za-z]{1,3})\$?([1-9]\d*)/.exec(source.slice(pos));
    if (!cell) throw Error('不支持的公式语法：仅支持数值运算、单元格/同表矩形区域及白名单函数；不支持名称、字符串、外部引用。');
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
  function expression(depth: number): Node {
    let value = product(depth); while (true) {
      if (take('+')) value = node({ type: 'binary', op: '+', left: value, right: product(depth + 1) });
      else if (take('-')) value = node({ type: 'binary', op: '-', left: value, right: product(depth + 1) });
      else break;
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
export function evaluateFormula(tree: Node, read: (ref: Reference) => Scalar[], tick: () => void): Decimal {
  function evaluate(n: Node, depth = 0): Scalar[] {
    tick(); if (depth > 64) throw Error('计算表达式嵌套超过64层。');
    const one = (node: Node) => { if (node.type === 'ref' && node.ref.end) throw Error('矩形区域只允许作为聚合函数的直接参数。'); const values = evaluate(node, depth + 1); if (values.length !== 1) throw Error('此处需要单一数值。'); return numeric(values[0]); };
    if (n.type === 'number') return [bounded(new D(n.value))];
    if (n.type === 'ref') return read(n.ref);
    if (n.type === 'unary') { const v = one(n.child); return [bounded(n.op === '-' ? v.negated() : n.op === '%' ? v.div(100) : v)]; }
    if (n.type === 'binary') {
      const a = one(n.left), b = one(n.right); if (n.op === '/' && b.isZero()) throw Error('除数为零。');
      return [bounded(n.op === '+' ? a.plus(b) : n.op === '-' ? a.minus(b) : n.op === '*' ? a.times(b) : a.div(b))];
    }
    if (n.name === 'ABS') return [one(n.args[0]).abs()];
    if (n.name === 'ROUND') {
      const value = one(n.args[0]), places = one(n.args[1]); if (!places.isInteger() || places.abs().gt(15)) throw Error('ROUND位数必须为-15至15的整数。');
      const factor = new D(10).pow(places.toNumber()); return [bounded(value.times(factor).toDecimalPlaces(0, D.ROUND_HALF_UP).div(factor))];
    }
    const raw = n.args.flatMap(arg => evaluate(arg, depth + 1));
    if (raw.some(v => v instanceof Date)) throw Error('聚合引用了日期；当前不计算Excel日期序列。');
    const values = raw.filter(v => v instanceof Decimal || typeof v === 'number').map(v => numeric(v));
    if (n.name === 'COUNT') return [new D(values.length)];
    if (!values.length) { if (n.name === 'AVERAGE') throw Error('AVERAGE没有数值，不能除以零。'); return [new D(0)]; }
    if (n.name === 'MIN' || n.name === 'MAX') return [values.reduce((a,b) => n.name === 'MIN' ? (a.lt(b) ? a : b) : (a.gt(b) ? a : b))];
    const sum = values.reduce((a,b) => bounded(a.plus(b)), new D(0)); return [bounded(n.name === 'AVERAGE' ? sum.div(values.length) : sum)];
  }
  if (tree.type === 'ref' && tree.ref.end) throw Error('公式结果不能是区域或数组。');
  const result = evaluate(tree); if (result.length !== 1) throw Error('公式结果不是单一数值。'); return numeric(result[0]);
}
