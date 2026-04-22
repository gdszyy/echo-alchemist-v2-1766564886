# src/event_bus.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 258 | 函数数: 13 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| EventBus | class | L75 | L75 | 1 | `EventBus()` |
| constructor | method | L76 | L95 | 20 | `constructor(options = {})` |
| on | method | L96 | L114 | 19 | `on(event, handler)` |
| off | method | L115 | L130 | 16 | `off(event, handler)` |
| once | method | L131 | L144 | 14 | `once(event, handler)` |
| emit | method | L145 | L182 | 38 | `emit(event, data)` |
| hasListeners | method | L183 | L192 | 10 | `hasListeners(event)` |
| listenerCount | method | L193 | L201 | 9 | `listenerCount(event)` |
| removeAllListeners | method | L202 | L213 | 12 | `removeAllListeners(event)` |
| getHistory | method | L214 | L220 | 7 | `getHistory()` |
| clearHistory | method | L221 | L228 | 8 | `clearHistory()` |
| _recordHistory | method | L229 | L244 | 16 | `_recordHistory(event, data)` |
| setDebug | method | L245 | L259 | 15 | `setDebug(enabled)` |
