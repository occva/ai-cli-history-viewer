# 会话详情秒开与消息异步加载方案

## 1. 背景

当前 Web 端点击会话后，页面不会立刻进入详情视图，而是要先完成一整段串行工作：

1. `selectConversation()` 先查目标 session。
2. `loadConversationMessages()` 读取完整消息。
3. 同步构造 `convLike`。
4. `await loadMarkdownRenderer()`。
5. `transformConversation()` 生成 blocks。
6. 最后才 `currentView = 'detail'`。

这条链路里同时包含：

- I/O：消息读取，索引 miss 时还会回退到源文件。
- 动态 chunk 加载：Markdown 渲染器首次打开时要拉取异步模块。
- 前端 CPU 工作：消息映射、block 转换、首屏渲染前准备。

结果就是“点了会话，但详情页要等一会儿才出现”。消息越多、首次进入越明显。

## 2. 目标

下一版把详情页改成“两段式进入”：

1. 点击后立刻进入详情页，只显示稳定壳层。
2. 消息异步加载，加载完成后再填充消息区。

目标体验：

- 点击后 1 帧内切到详情页。
- 标题、时间、项目路径、删除按钮等壳层信息立即可见。
- 消息区先显示 skeleton / loading 占位。
- 消息加载完成后再恢复滚动位置、搜索命中定位、用户目录。

本次方案只做加载链路重排，不引入新依赖，不改后端接口，不顺带上虚拟列表。

## 3. 当前瓶颈

当前慢点不在单一函数，而在“切页”和“数据准备”耦合在一起：

- `currentView = 'detail'` 放在最后，导致视图切换被 I/O 阻塞。
- `selectedSession` 依赖 `currentConversation`，导致没有完整消息时，详情头部也拿不到稳定选中态。
- `loadMarkdownRenderer()` 被放进关键路径，但 `transformConversation()` 本身并不依赖 Markdown 组件。
- `restoreConversationViewport()`、搜索命中滚动、进度目录更新都默认消息已经就绪，缺少“壳层已进入、消息未就绪”的中间态。

## 4. 改造原则

- 保持实现简单，优先改 `src/App.svelte`，不拆新架构层。
- 把“当前选中的会话”和“当前已加载完成的消息详情”分成两个状态。
- 复用现有 `loadConversationMessages()`、`transformConversation()`、`restoreConversationViewport()`。
- 用请求 token 防止连续点选时旧请求回写新页面。
- Markdown 渲染器改为并行预热，不再阻塞切页。

## 5. 具体方案

### 5.1 拆出详情页壳层状态

新增独立状态，承接“已选中，但消息还没回来”的阶段：

- `detailTargetSessionId`
- `detailTargetSourceType`
- `isConversationLoading`
- `conversationLoadError`
- `conversationLoadToken`

同时调整派生状态：

- `selectedSession` 不再从 `currentConversation` 推导。
- 改为从 `detailTargetSessionId + detailTargetSourceType` 直接查 `allSessions`。

这样即使 `currentConversation === null`，详情头部仍然能立即显示正确的会话信息。

### 5.2 进入详情页改为先切视图

`selectConversation()` 改成两阶段：

第一阶段同步完成：

1. 查到 `target`
2. `syncConversationContext(target)`
3. 更新 `detailTargetSessionId/detailTargetSourceType`
4. `currentView = 'detail'`
5. 清空旧的瞬时状态
   - `currentConversation = null`
   - `activeSearchMatch = null`
   - `clearConversationProgress()`
   - `conversationLoadError = ''`
   - `isConversationLoading = true`
6. 立即更新路由

第二阶段异步完成：

1. 启动后台加载任务
2. 消息回来后再写入 `currentConversation`
3. 最后恢复滚动和搜索定位

示意：

```ts
async function selectConversation(...) {
  const target = ...
  if (!target) return;

  const token = ++conversationLoadToken;
  syncConversationContext(target);
  detailTargetSessionId = target.sessionId;
  detailTargetSourceType = target.providerId;
  currentView = 'detail';
  currentConversation = null;
  activeSearchMatch = null;
  clearConversationProgress();
  conversationLoadError = '';
  isConversationLoading = true;

  updateConversationRoute(...);
  void hydrateConversationDetail(token, target, searchMatch, options);
}
```

### 5.3 新增后台加载函数

建议新增 `hydrateConversationDetail()`，集中处理消息加载和回写：

```ts
async function hydrateConversationDetail(
  token: number,
  target: SessionMeta,
  searchMatch?: SearchResultLocal | null,
  options: SelectConversationOptions = {},
) {
  try {
    const [rawMsgs] = await Promise.all([
      loadConversationMessages(target),
      loadMarkdownRenderer(),
    ]);

    if (token !== conversationLoadToken) return;

    const convLike = ...
    currentConversation = transformConversation(convLike);
    activeSearchMatch = buildSearchMatch(...);
    isConversationLoading = false;

    await restoreConversationViewport(target, ...);
  } catch (e) {
    if (token !== conversationLoadToken) return;
    currentConversation = null;
    conversationLoadError = e instanceof Error ? e.message : 'Failed to load conversation';
    isConversationLoading = false;
  }
}
```

这里的关键点：

- `loadConversationMessages()` 和 `loadMarkdownRenderer()` 并行。
- 即使 Markdown chunk 还没到，页面也已经进入详情页。
- `transformConversation()` 不再等待 Markdown 组件。
- 连续点击多个会话时，旧请求通过 token 丢弃，不覆盖新会话。

### 5.4 详情页模板补 loading/error 中间态

当前模板大量使用 `currentConversation` 作为是否显示详情内容的判断条件。下一版需要补三种状态：

1. `selectedSession && isConversationLoading`
2. `selectedSession && conversationLoadError`
3. `currentConversation`

推荐行为：

- 详情头部：只要 `selectedSession` 存在就显示。
- 消息区 loading：显示 4-6 条 skeleton block，占位高度尽量接近真实消息卡片。
- 加载失败：显示一条轻量错误提示和“重试”按钮，重试直接复用 `selectConversation()` 或 `hydrateConversationDetail()`。
- 用户目录浮标：仅在 `currentConversation` 已就绪且 `conversationProgressAnchors.length > 0` 时显示。

### 5.5 滚动恢复和搜索定位后移

这两个动作必须继续留在消息加载完成后：

- `restoreConversationViewport()`
- `scrollActiveSearchMatchIntoView()`

原因很简单：DOM 还没生成时恢复滚动没有意义。

但要改一点时机：

- 不再在切页前等待这些逻辑。
- 只在 `currentConversation` 写入后执行一次。
- token 失效时直接跳过，避免旧会话把新会话滚动位置冲掉。

### 5.6 刷新逻辑复用同一套加载管线

`refreshCurrentConversation()` 最好也复用 `hydrateConversationDetail()`，不要保留另一条独立装配链路。

这样可以避免：

- 首次进入和刷新后的行为不一致
- 一个修了 loading，另一个还走旧逻辑
- 搜索命中、滚动恢复、错误态在两套代码里重复维护

## 6. 建议落地顺序

### Step 1

先把 `selectedSession` 从 `currentConversation` 脱钩，保证详情壳层可以独立显示。

### Step 2

补 `isConversationLoading / conversationLoadError / conversationLoadToken` 三个状态。

### Step 3

重写 `selectConversation()`，把 `currentView = 'detail'` 和路由更新提前到异步读取前。

### Step 4

新增 `hydrateConversationDetail()`，把消息读取、Markdown 预热、结果回写集中到一个函数。

### Step 5

调整详情模板，补 loading/error/success 三态。

### Step 6

让 `refreshCurrentConversation()`、路由恢复 `syncConversationFromRoute()` 复用新链路。

## 7. 风险点

### 7.1 连点切换的竞态

如果没有 token 保护，A 会话慢返回时会覆盖已经切到的 B 会话。

### 7.2 滚动恢复时机错误

如果在 skeleton 阶段恢复滚动，等真实消息渲染后位置会漂。

### 7.3 旧 UI 条件判断过多依赖 `currentConversation`

需要系统性梳理头部、按钮、消息区、浮标区的判断条件，避免出现“已经进详情页但头部空白”的半残状态。

### 7.4 搜索结果跳转

搜索命中高亮依赖 `match_seq`，必须在真实消息 blocks 生成后再设置最终滚动定位。

## 8. 验收标准

- 点击任意会话后，详情页壳层立即出现，不再等消息加载完成。
- 首次打开未缓存的 Markdown chunk 时，页面仍能立即切到详情页。
- 大会话加载期间，消息区显示 loading，占位稳定，不闪白。
- 连续快速点击多个会话，只保留最后一次点击结果。
- 从搜索结果进入详情页后，消息加载完成后仍能正确滚到命中位置。
- 返回列表再进入同一会话，滚动恢复行为与现在一致。
- 用户目录、刷新按钮、删除按钮在加载前后都不出现错位或失效。

## 9. 非目标

本方案不包含以下内容：

- 消息虚拟列表
- 后端分页接口
- 消息分批增量流式渲染
- 搜索索引结构调整

这些可以在“详情页秒开”稳定后再评估，避免一次把问题做大。

## 10. 建议结论

下一版优先做“详情壳层先进入 + 消息异步回填”，这是当前 Web 端详情慢的最低成本解法。

它不需要改后端协议，也不需要引入复杂状态机，只要把现有串行链路拆成“同步切页 + 异步填充”两段，就能先把最直观的卡顿拿掉。
