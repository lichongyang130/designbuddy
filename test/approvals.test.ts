import test from 'node:test'
import assert from 'node:assert/strict'

import { ApprovalBroker } from '../src/core/approvals.ts'
import { describeArgs } from '../src/plugins/approvals.ts'
import type { ApprovalRequest } from '../src/core/approvals.ts'
import { designBundle } from '../src/boot/profiles.ts'
import type { ToolRegistry } from '../src/core/tools.ts'
import type { ConnectorHub } from '../src/connectors/hub.ts'
import { boot, toolCallContext } from './support/app.ts'

/** 拿到请求但什么都不做，用来观察 broker 抛了什么。 */
function recorder(broker: ApprovalBroker): { seen: ApprovalRequest[]; stop: () => void } {
  const seen: ApprovalRequest[] = []
  const stop = broker.onRequest((request) => {
    seen.push(request)
  })
  return { seen, stop }
}

test('没有审批通道时默认拒绝，绝不默默放行', async () => {
  const broker = new ApprovalBroker()
  const answer = await broker.request({ sessionId: 's1', tool: 'notion.create_page', title: '新建页面', detail: 'title = 周报' })
  assert.equal(answer.approved, false)
  assert.match(String(answer.reason), /不支持写操作确认/)
  assert.equal(broker.pending().length, 0, '拒绝之后不该留下悬挂请求')
})

test('用户点「允许」后工具放行', async () => {
  const broker = new ApprovalBroker()
  broker.onRequest((request) => {
    assert.equal(broker.respond(request.id, true), true)
  })
  const answer = await broker.request({ sessionId: 's1', tool: 'notion.create_page', title: '新建页面', detail: 'title = 周报' })
  assert.deepEqual(answer, { approved: true })
})

test('用户点「拒绝」带上理由传给模型', async () => {
  const broker = new ApprovalBroker()
  broker.onRequest((request) => broker.respond(request.id, false, '标题写着测试，先别建'))
  const answer = await broker.request({ sessionId: 's1', tool: 'github.create_pr', title: '创建 PR', detail: 'title = WIP' })
  assert.equal(answer.approved, false)
  assert.equal(answer.reason, '标题写着测试，先别建')
})

test('拒绝时不写理由有一个能读的默认说法', async () => {
  const broker = new ApprovalBroker()
  broker.onRequest((request) => broker.respond(request.id, false))
  const answer = await broker.request({ sessionId: 's1', tool: 'feishu.send_message', title: '发送消息', detail: 'text = 你好' })
  assert.equal(answer.approved, false)
  assert.match(String(answer.reason), /拒绝了这次写操作/)
})

test('等不到确认就超时拒绝，理由里写明等了多久', async () => {
  const broker = new ApprovalBroker({ timeoutMs: 20 })
  const { seen, stop } = recorder(broker)
  const startedAt = Date.now()
  // broker 的超时计时器是 unref 的（不拖住进程退出），所以这里要自己按住事件循环。
  const keepAlive = setTimeout(() => {}, 200)
  const answer = await broker.request({ sessionId: 's1', tool: 'notion.create_page', title: '新建页面', detail: '' })
  clearTimeout(keepAlive)
  stop()
  assert.equal(answer.approved, false)
  assert.match(String(answer.reason), /没等到确认/)
  assert.equal(seen.length, 1)
  assert.ok(Date.now() - startedAt >= 15, '应该真的等过')
  assert.equal(broker.pending().length, 0)
})

test('运行被中止时立刻拒绝，不等超时', async () => {
  const broker = new ApprovalBroker({ timeoutMs: 60_000 })
  const { stop } = recorder(broker)
  const controller = new AbortController()
  const waiting = broker.request({
    sessionId: 's1',
    tool: 'notion.create_page',
    title: '新建页面',
    detail: '',
    signal: controller.signal,
  })
  controller.abort()
  const answer = await waiting
  stop()
  assert.equal(answer.approved, false)
  assert.match(String(answer.reason), /已被取消/)
})

test('会话结束时只收掉这个会话的请求', async () => {
  const broker = new ApprovalBroker({ timeoutMs: 60_000 })
  const { seen, stop } = recorder(broker)
  const first = broker.request({ sessionId: 'a', tool: 'notion.create_page', title: 'A', detail: '' })
  const second = broker.request({ sessionId: 'b', tool: 'notion.create_page', title: 'B', detail: '' })
  assert.equal(seen.length, 2)

  broker.cancelSession('a')
  const answerA = await first
  assert.equal(answerA.approved, false)
  assert.match(String(answerA.reason), /会话已结束/)
  assert.equal(broker.pending().length, 1, 'B 会话的请求还该等着')

  // 收尾，避免测试进程一直挂着
  broker.respond(seen[1].id, true)
  assert.equal((await second).approved, true)
  stop()
})

test('重复回答返回 false，不会二次结算', async () => {
  const broker = new ApprovalBroker()
  let first = ''
  broker.onRequest((request) => {
    first = request.id
    broker.respond(request.id, true)
  })
  const answer = await broker.request({ sessionId: 's1', tool: 'notion.create_page', title: '新建页面', detail: '' })
  assert.equal(answer.approved, true)
  assert.equal(broker.respond(first, false), false, '过期 id 应该被认出来')
  assert.equal(broker.respond('ap-does-not-exist', true), false)
})

test('dispose 会把还挂着的请求全部拒掉', async () => {
  const broker = new ApprovalBroker({ timeoutMs: 60_000 })
  const { stop } = recorder(broker)
  const waiting = broker.request({ sessionId: 's1', tool: 'notion.create_page', title: '新建页面', detail: '' })
  broker.dispose()
  const answer = await waiting
  stop()
  assert.equal(answer.approved, false)
  assert.match(String(answer.reason), /通道已关闭/)
})

test('参数摘要一行说清要改什么，长值截断', () => {
  assert.equal(describeArgs({}), '没有额外参数')
  assert.equal(describeArgs({ title: '周报', body: '本周进展' }), 'title = 周报，body = 本周进展')
  const long = describeArgs({ body: 'x'.repeat(200) })
  assert.match(long, /…$/)
  assert.ok(long.length < 90, '摘要不该把整篇正文搬进卡片')
  assert.equal(describeArgs({ title: '  多  空格  ' }), 'title = 多 空格')
})

test('写工具每次调用都要问；读工具一次都不问', async (t) => {
  const app = await boot([designBundle])
  t.after(() => app.dispose())

  const hub = app.ctx.require<ConnectorHub>('connectors')
  const tools = app.ctx.require<ToolRegistry>('tools')
  const broker = app.ctx.require<ApprovalBroker>('approvals')

  await hub.connect('notion', undefined, { allowWrite: true })
  assert.ok(tools.get('notion.create_page'), '写工具应该已经注册（详情页里授权过）')
  assert.deepEqual(hub.writeToolOf('notion.create_page'), {
    connector: 'notion',
    name: 'create_page',
    label: 'Notion · 新建页面',
  })
  assert.equal(hub.writeToolOf('notion.search'), undefined, '读工具不该被当成写工具')

  // 1) 没人应答 → 拒绝，且工具体根本没执行（demo 适配器会带出 demo:true，拿不到就是没执行）
  const refused = await tools.execute('notion.create_page', { title: '周报' }, toolCallContext)
  assert.equal(refused.isError, true)
  assert.equal(refused.rejectedAt, 'policy')
  assert.match(refused.content, /不支持写操作确认/)

  // 2) 有人点允许 → 工具真的跑了
  const asked: ApprovalRequest[] = []
  const stop = broker.onRequest((request) => {
    asked.push(request)
    broker.respond(request.id, true)
  })
  const ok = await tools.execute('notion.create_page', { title: '周报' }, toolCallContext)
  stop()
  assert.equal(ok.isError, false)
  assert.match(ok.content, /"demo": true/)
  assert.equal(asked.length, 1)
  assert.equal(asked[0].tool, 'notion.create_page')
  assert.equal(asked[0].sessionId, toolCallContext.sessionId)
  assert.equal(asked[0].title, 'Notion · 新建页面')
  assert.equal(asked[0].detail, 'title = 周报')

  // 3) 读工具不问：没人监听也照常执行
  const read = await tools.execute('notion.search', { query: '设计规范' }, toolCallContext)
  assert.equal(read.isError, false)
  assert.equal(asked.length, 1, '读工具不该产生审批请求')
})
