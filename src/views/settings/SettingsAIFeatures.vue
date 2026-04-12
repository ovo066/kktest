<template>
  <div class="space-y-4">
    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
        <div class="flex flex-col">
          <span class="text-[17px] text-[var(--text-primary)]">AI 收藏消息</span>
          <span class="text-[12px] text-[var(--text-secondary)]">AI 可以在聊天中收藏你们的消息</span>
        </div>
        <IosToggle :model-value="store.allowAIFavorite" @update:modelValue="handleAllowAIFavoriteChange" />
      </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发送转账</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以在聊天中向你发送转账红包</span>
      </div>
      <IosToggle v-model="store.allowAITransfer" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发送礼物</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以在聊天中送你礼物</span>
      </div>
      <IosToggle v-model="store.allowAIGift" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI邀约线下见面</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以约你线下见面，同意后进入沉浸式场景</span>
      </div>
      <IosToggle v-model="store.allowAIMeet" @update:modelValue="scheduleSave" />
    </div>
    <div v-if="store.allowAIMeet" class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">邀约开场使用线下预设</span>
        <span class="text-[12px] text-[var(--text-secondary)]">同意邀约后，使用你设定的线下模式风格来生成开场</span>
      </div>
      <IosToggle v-model="store.meetOpeningUseOfflinePreset" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发送语音</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以发送语音消息给你</span>
      </div>
      <IosToggle v-model="store.allowAIVoice" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发送表情包</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以在聊天中发送表情包贴纸</span>
      </div>
      <IosToggle v-model="store.allowAIStickers" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI主动发送图片</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以根据对话情境自动生成并发送图片</span>
      </div>
      <IosToggle v-model="store.allowAIImageGeneration" class="shrink-0" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] gap-3">
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-[17px] text-[var(--text-primary)]">同步动态内容到AI</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 在聊天时可以自然地发布朋友圈动态</span>
      </div>
      <IosToggle v-model="store.syncForumToAI" class="shrink-0" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI情绪标签</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 的语音会带有情绪变化，不会显示在聊天中</span>
      </div>
      <IosToggle v-model="store.allowAIEmotionTag" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发送模拟图片</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以发送模拟拍摄的照片消息</span>
      </div>
      <IosToggle v-model="store.allowAIMockImage" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)]">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI发起通话</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以主动发起语音或视频通话</span>
      </div>
      <IosToggle v-model="store.allowAICall" @update:modelValue="scheduleSave" />
    </div>
    <div class="px-4 py-3 flex justify-between items-center">
      <div class="flex flex-col">
        <span class="text-[17px] text-[var(--text-primary)]">AI推荐音乐</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 可以在聊天中向你推荐歌曲</span>
      </div>
      <IosToggle v-model="store.allowAIMusicRecommend" @update:modelValue="scheduleSave" />
    </div>
    <div v-if="store.allowAIMusicRecommend" class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
      <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">音乐搜索</span>
      <input v-model="store.musicSearchApiUrl" class="flex-1 text-right text-[var(--text-primary)] bg-transparent outline-none min-w-0 text-[14px]" placeholder="留空使用内置音源" @change="scheduleSave" />
    </div>
    <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
      <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">时区设置</span>
      <select v-model="store.timeZoneMode" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="handleTimeZoneModeChange">
        <option v-for="opt in TIME_ZONE_MODE_OPTIONS" :key="`timezone-mode-${opt.value}`" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
    <div v-if="store.timeZoneMode === TIME_ZONE_MODE_CUSTOM" class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
      <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">自定义时区</span>
      <input v-model="store.customTimeZone" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如 Asia/Shanghai" @change="handleCustomTimeZoneChange" />
    </div>
    <div v-else class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
      <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">当前时区</span>
      <span class="flex-1 text-right text-[14px] text-[var(--text-secondary)]">{{ activeTimeZoneLabel }}</span>
    </div>
    <div class="px-4 py-3 flex justify-between items-center border-t border-[var(--border-color)] gap-3">
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-[17px] text-[var(--text-primary)]">注入天气上下文</span>
        <span class="text-[12px] text-[var(--text-secondary)]">AI 聊天时会了解你所在地的天气情况</span>
      </div>
      <IosToggle v-model="store.enableWeatherContext" class="shrink-0" @update:modelValue="handleWeatherContextToggle" />
    </div>
      <template v-if="store.enableWeatherContext">
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">位置来源</span>
        <select v-model="store.weatherLocationMode" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="handleWeatherModeChange">
          <option value="auto">自动定位</option>
          <option value="manual">手动城市</option>
        </select>
      </div>
      <div v-if="store.weatherLocationMode === 'manual'" class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">城市</span>
        <input v-model="store.weatherManualCity" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="例如：上海" @change="handleWeatherManualCityChange" />
      </div>
      <div v-else class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">定位权限</span>
        <span class="flex-1 text-right text-[14px] text-[var(--text-secondary)]">{{ geolocationPermissionLabel }}</span>
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)]">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">刷新间隔</span>
        <select v-model.number="store.weatherRefreshMinutes" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="handleWeatherRefreshIntervalChange">
          <option v-for="opt in WEATHER_REFRESH_OPTIONS" :key="`weather-interval-${opt.value}`" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="flex items-center px-4 py-3 border-t border-[var(--border-color)] gap-3">
        <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">当前天气</span>
        <div class="flex items-center justify-end gap-2 flex-1 min-w-0">
          <span class="text-[12px] text-[var(--text-secondary)] truncate">{{ weatherStatus }}</span>
          <button class="px-3 py-1 rounded-md border border-[var(--border-color)] text-[14px] text-[var(--primary-color)] disabled:opacity-60" :disabled="weatherBusy" @click="handleRefreshWeatherNow">{{ weatherRefreshButtonLabel }}</button>
        </div>
      </div>
      <div v-if="weatherError" class="px-4 pb-3 text-[12px] text-red-500 break-all">{{ weatherError }}</div>
      </template>
    </div>

    <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
      <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] gap-3">
        <div class="flex flex-col flex-1 min-w-0">
          <span class="text-[17px] text-[var(--text-primary)]">后台工具调用</span>
          <span class="text-[12px] text-[var(--text-secondary)]">让 AI 在后台自动执行记忆、日程、日记等操作</span>
        </div>
        <IosToggle :model-value="store.allowToolCalling" class="shrink-0" @update:modelValue="handleAllowToolCallingChange" />
      </div>
      <template v-if="store.allowToolCalling">
        <div class="flex items-center px-4 py-3 border-b border-[var(--border-color)]">
          <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">最多轮次</span>
          <select :value="store.toolCallingConfig.maxToolRounds" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="handleMaxToolRoundsChange($event.target.value)">
            <option v-for="count in TOOL_ROUND_OPTIONS" :key="`tool-round-${count}`" :value="count">{{ count }}</option>
          </select>
        </div>
        <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] gap-3">
          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-[17px] text-[var(--text-primary)]">展示工具调用卡片</span>
            <span class="text-[12px] text-[var(--text-secondary)]">在主聊天中显示 MCP / 内置工具的调用结果卡片</span>
          </div>
          <IosToggle :model-value="store.toolCallingConfig.showToolLog" class="shrink-0" @update:modelValue="handleShowToolLogChange" />
        </div>
        <div class="px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] gap-3">
          <div class="flex flex-col flex-1 min-w-0">
            <span class="text-[17px] text-[var(--text-primary)]">MCP 桥接</span>
            <span class="text-[12px] text-[var(--text-secondary)]">通过桥接服务连接外部工具，扩展 AI 能力</span>
          </div>
          <IosToggle :model-value="store.toolCallingConfig.mcpBridgeEnabled" class="shrink-0" @update:modelValue="handleMcpBridgeEnabledChange" />
        </div>
        <template v-if="store.toolCallingConfig.mcpBridgeEnabled">
          <div class="px-4 py-3 border-b border-[var(--border-color)] space-y-2">
            <div class="flex items-center">
              <span class="w-28 text-[16px] text-[var(--text-primary)] shrink-0">桥接地址</span>
              <input v-model="store.toolCallingConfig.mcpBridgeUrl" class="flex-1 min-w-0 text-[15px] outline-none text-right bg-transparent text-[var(--text-primary)]" placeholder="http://localhost:3099 或 https://bridge.example.com" @change="handleMcpBridgeUrlChange" />
            </div>
            <div class="pl-28 text-[12px] text-[var(--text-secondary)] leading-relaxed">
              填写 MCP 桥接服务的地址。如果应用部署在 HTTPS 上而桥接是 HTTP，可能需要额外配置。
            </div>
          </div>
          <div class="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-[16px] text-[var(--text-primary)]">桥接状态</span>
                <span class="text-[12px] text-[var(--text-secondary)] leading-relaxed">{{ mcpBridgeStatusSummary }}</span>
              </div>
              <span class="shrink-0 text-[12px] font-medium" :class="mcpBridgeStatusClass">{{ mcpBridgeStatusLabel }}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[12px] text-[var(--text-secondary)]">
              <div class="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">配置服务器 {{ toolCallingServers.length }}</div>
              <div class="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">已连接 {{ mcpBridgeStatus.connectedCount }}</div>
              <div class="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">发现工具 {{ mcpBridgeStatus.toolsCount }}</div>
              <div class="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">最近检测 {{ mcpBridgeUpdatedLabel }}</div>
            </div>
            <div v-if="mcpBridgeStatus.lastError" class="text-[12px] text-red-500 break-all">{{ mcpBridgeStatus.lastError }}</div>
            <div class="flex gap-2">
              <button class="flex-1 rounded-xl border border-[var(--border-color)] px-3 py-2 text-[14px] text-[var(--primary-color)] disabled:opacity-60" :disabled="mcpBridgeBusy || mcpRefreshBusy" @click="handleTestMcpBridge">
                {{ mcpBridgeBusy ? '检测中...' : '测试连接' }}
              </button>
              <button class="flex-1 rounded-xl border border-[var(--border-color)] px-3 py-2 text-[14px] text-[var(--primary-color)] disabled:opacity-60" :disabled="mcpBridgeBusy || mcpRefreshBusy" @click="handleRefreshMcpBridgeTools">
                {{ mcpRefreshBusy ? '刷新中...' : '刷新工具' }}
              </button>
            </div>
          </div>
          <div class="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
            <div class="flex flex-col gap-1">
              <span class="text-[16px] text-[var(--text-primary)]">MCP 服务器</span>
              <span class="text-[12px] text-[var(--text-secondary)]">管理已添加的 MCP 服务器，可单独启用或禁用</span>
            </div>
            <div v-if="toolCallingServers.length === 0" class="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-3 text-[12px] text-[var(--text-secondary)]">
              还没有添加任何服务器，点击下方按钮添加
            </div>
            <div v-for="server in toolCallingServers" :key="server.id" class="rounded-xl border border-[var(--border-color)] px-3 py-3 space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex flex-col min-w-0">
                  <span class="text-[15px] text-[var(--text-primary)] truncate">{{ server.name || '未命名服务器' }}</span>
                  <span class="text-[12px] text-[var(--text-secondary)]">{{ server.transport === 'http' ? 'HTTP' : 'STDIO' }}</span>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <IosToggle :model-value="server.enabled !== false" @update:modelValue="handleMcpServerToggle(server.id, $event)" />
                  <button class="text-[13px] text-red-500" @click="handleRemoveMcpServer(server.id)">删除</button>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">名称</span>
                <input :value="server.name" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="例如 filesystem" @change="handleMcpServerFieldChange(server.id, 'name', $event.target.value)" />
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">连接</span>
                <select :value="server.transport || 'stdio'" class="flex-1 text-[var(--primary-color)] bg-transparent outline-none text-right" @change="handleMcpServerTransportChange(server.id, $event.target.value)">
                  <option value="stdio">STDIO</option>
                  <option value="http">HTTP</option>
                </select>
              </div>
              <template v-if="server.transport === 'http'">
                <div class="flex items-center gap-3">
                  <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">URL</span>
                  <input :value="server.url || ''" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="http://127.0.0.1:8080/mcp" @change="handleMcpServerFieldChange(server.id, 'url', $event.target.value)" />
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-3">
                  <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">命令</span>
                  <input :value="server.command || ''" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="npx" @change="handleMcpServerFieldChange(server.id, 'command', $event.target.value)" />
                </div>
                <div class="space-y-2">
                  <div class="flex items-center gap-3">
                    <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">参数</span>
                    <input :value="mcpArgsDrafts[server.id] ?? formatJsonInline(server.args || [])" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder='["-y","@modelcontextprotocol/server-filesystem","."]' @input="handleMcpArgsDraftInput(server.id, $event.target.value)" @blur="handleMcpServerArgsBlur(server.id)" />
                  </div>
                  <div v-if="mcpServerErrors[server.id]?.args" class="text-[12px] text-red-500 break-all">{{ mcpServerErrors[server.id].args }}</div>
                </div>
                <div class="space-y-2">
                  <div class="flex items-start gap-3">
                    <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0 pt-1">环境</span>
                    <textarea :value="mcpEnvDrafts[server.id] ?? formatJsonBlock(server.env || {})" rows="4" class="flex-1 min-w-0 rounded-lg border border-[var(--border-color)] bg-transparent px-3 py-2 text-[13px] outline-none resize-none text-[var(--text-primary)]" placeholder='{"API_KEY":"xxx"}' @input="handleMcpEnvDraftInput(server.id, $event.target.value)" @blur="handleMcpServerEnvBlur(server.id)"></textarea>
                  </div>
                  <div v-if="mcpServerErrors[server.id]?.env" class="text-[12px] text-red-500 break-all">{{ mcpServerErrors[server.id].env }}</div>
                </div>
              </template>
            </div>
            <button class="w-full rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-[14px] text-[var(--primary-color)]" @click="handleAddMcpServer">
              添加 MCP 服务器
            </button>
          </div>
          <!-- MCP 直连服务器 -->
          <div class="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col gap-1">
                <span class="text-[16px] text-[var(--text-primary)]">MCP 直连</span>
                <span class="text-[12px] text-[var(--text-secondary)]">直接连接云端 MCP 服务，无需本地桥接</span>
              </div>
              <button class="shrink-0 rounded-xl border border-[var(--border-color)] px-3 py-1.5 text-[13px] text-[var(--primary-color)]" @click="handleAddDirectServer">+ 添加</button>
            </div>
            <div v-if="directServers.length === 0" class="rounded-xl border border-dashed border-[var(--border-color)] px-3 py-3 text-[12px] text-[var(--text-secondary)]">
              还没有添加直连服务，添加后填入地址并测试连接即可
            </div>
            <div v-for="srv in directServers" :key="srv.id" class="rounded-xl border border-[var(--border-color)] px-3 py-3 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[15px] text-[var(--text-primary)] truncate flex-1 min-w-0">{{ srv.name || '未命名' }}</span>
                <div class="flex items-center gap-3 shrink-0">
                  <IosToggle :model-value="srv.enabled !== false" @update:modelValue="handleDirectServerToggle(srv.id, $event)" />
                  <button class="text-[13px] text-red-500" @click="handleRemoveDirectServer(srv.id)">删除</button>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">名称</span>
                <input :value="srv.name" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="例如 Notion" @change="handleDirectServerFieldChange(srv.id, 'name', $event.target.value)" />
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">URL</span>
                <input :value="srv.url" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="https://mcp.composio.dev/notion/xxx" @change="handleDirectServerFieldChange(srv.id, 'url', $event.target.value)" />
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">Auth</span>
                <input :value="srv.authHeader || ''" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="可选，直接填写 Authorization 值，如 Bearer xxx" @change="handleDirectServerFieldChange(srv.id, 'authHeader', $event.target.value)" />
              </div>
              <div class="flex items-center gap-3">
                <span class="w-16 text-[14px] text-[var(--text-secondary)] shrink-0">API Key</span>
                <input :value="srv.apiKey || ''" type="password" class="flex-1 min-w-0 text-[14px] outline-none bg-transparent text-[var(--text-primary)]" placeholder="可选，未填写 Auth 时自动转成 Bearer Authorization" @change="handleDirectServerFieldChange(srv.id, 'apiKey', $event.target.value)" />
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="text-[12px] text-[var(--text-secondary)]">
                  <span v-if="srv.toolsError" class="text-red-500">{{ srv.toolsError }}</span>
                  <span v-else-if="srv.toolsCount > 0">已发现 {{ srv.toolsCount }} 个工具</span>
                  <span v-else>未测试</span>
                </div>
                <button class="rounded-xl border border-[var(--border-color)] px-3 py-1.5 text-[13px] text-[var(--primary-color)] disabled:opacity-60" :disabled="directServerBusy[srv.id]" @click="handleTestDirectServer(srv.id)">
                  {{ directServerBusy[srv.id] ? '检测中...' : '测试连接' }}
                </button>
              </div>
              <div v-if="srv.toolNames && srv.toolNames.length > 0" class="flex flex-wrap gap-1.5">
                <span v-for="toolName in srv.toolNames" :key="toolName" class="rounded-md bg-[var(--bg-secondary)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{{ toolName }}</span>
              </div>
            </div>
          </div>
        </template>
        <div class="px-4 py-3">
          <p class="text-[12px] text-[var(--text-secondary)] leading-relaxed">工具调用默认按后台方式工作；开启“展示工具调用卡片”后，主聊天中会显示可感知的调用结果卡片。</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useStorage } from '../../composables/useStorage'
import { useToast } from '../../composables/useToast'
import { useMcpBridge } from '../../composables/useMcpBridge'
import IosToggle from '../../components/common/IosToggle.vue'
import { useWeatherSettings } from './composables/useWeatherSettings'
import { makeId } from '../../utils/id'

const store = useSettingsStore()
const { flushSaveNow, scheduleSave } = useStorage()
const { showToast } = useToast()
const { getBridgeStatus, refreshMcpTools, testDirectServer, refreshDirectTools } = useMcpBridge({ settingsStore: store, showToast })
const {
  activeTimeZoneLabel,
  geolocationPermissionLabel,
  handleCustomTimeZoneChange,
  handleRefreshWeatherNow,
  handleTimeZoneModeChange,
  handleWeatherContextToggle,
  handleWeatherManualCityChange,
  handleWeatherModeChange,
  handleWeatherRefreshIntervalChange,
  TIME_ZONE_MODE_CUSTOM,
  TIME_ZONE_MODE_OPTIONS,
  weatherBusy,
  weatherError,
  WEATHER_REFRESH_OPTIONS,
  weatherRefreshButtonLabel,
  weatherStatus
} = useWeatherSettings({ scheduleSave, showToast, store })
const TOOL_ROUND_OPTIONS = [1, 2, 3, 4, 5]
const toolCallingServers = computed(() => (
  Array.isArray(store.toolCallingConfig?.mcpServers)
    ? store.toolCallingConfig.mcpServers
    : []
))
const mcpArgsDrafts = ref({})
const mcpEnvDrafts = ref({})
const mcpServerErrors = ref({})
const mcpBridgeBusy = ref(false)
const mcpRefreshBusy = ref(false)
const mcpBridgeStatus = ref(createInitialMcpBridgeStatus())
const directServerBusy = ref({})
const directServers = computed(() => (
  Array.isArray(store.toolCallingConfig?.mcpDirectServers)
    ? store.toolCallingConfig.mcpDirectServers
    : []
))

const mcpBridgeStatusSummary = computed(() => {
  const bridgeUrl = String(store.toolCallingConfig?.mcpBridgeUrl || '').trim()
  const status = mcpBridgeStatus.value

  if (!bridgeUrl) return '先填写桥接地址，再测试连接。'
  if (!status.updatedAt && !mcpBridgeBusy.value) return '可手动测试桥接服务，或在修改服务器后刷新工具。'
  if (mcpBridgeBusy.value && !status.updatedAt) return '正在检测桥接服务状态。'
  if (!status.reachable) return '桥接服务当前不可用。'

  return `已连接 ${status.connectedCount}/${status.serverCount} 个服务器，发现 ${status.toolsCount} 个工具。`
})

const mcpBridgeStatusLabel = computed(() => {
  if (mcpBridgeBusy.value) return '检测中'
  if (!mcpBridgeStatus.value.updatedAt) return '未检测'
  return mcpBridgeStatus.value.reachable ? '已连接' : '未连接'
})

const mcpBridgeStatusClass = computed(() => {
  if (mcpBridgeBusy.value) return 'text-[var(--primary-color)]'
  return mcpBridgeStatus.value.reachable ? 'text-emerald-500' : 'text-red-500'
})

const mcpBridgeUpdatedLabel = computed(() => {
  const updatedAt = Number(mcpBridgeStatus.value.updatedAt || 0)
  if (!updatedAt) return '未检测'
  try {
    return new Date(updatedAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return '刚刚'
  }
})

watch(
  () => store.toolCallingConfig?.mcpServers,
  (servers) => {
    const nextArgs = { ...mcpArgsDrafts.value }
    const nextEnv = { ...mcpEnvDrafts.value }
    const nextErrors = { ...mcpServerErrors.value }
    const validIds = new Set()

    ;(Array.isArray(servers) ? servers : []).forEach((server) => {
      const serverId = String(server?.id || '').trim()
      if (!serverId) return
      validIds.add(serverId)
      if (!Object.prototype.hasOwnProperty.call(nextArgs, serverId)) {
        nextArgs[serverId] = formatJsonInline(server.args || [])
      }
      if (!Object.prototype.hasOwnProperty.call(nextEnv, serverId)) {
        nextEnv[serverId] = formatJsonBlock(server.env || {})
      }
      if (!Object.prototype.hasOwnProperty.call(nextErrors, serverId)) {
        nextErrors[serverId] = {}
      }
    })

    Object.keys(nextArgs).forEach((serverId) => {
      if (!validIds.has(serverId)) delete nextArgs[serverId]
    })
    Object.keys(nextEnv).forEach((serverId) => {
      if (!validIds.has(serverId)) delete nextEnv[serverId]
    })
    Object.keys(nextErrors).forEach((serverId) => {
      if (!validIds.has(serverId)) delete nextErrors[serverId]
    })

    mcpArgsDrafts.value = nextArgs
    mcpEnvDrafts.value = nextEnv
    mcpServerErrors.value = nextErrors
  },
  { immediate: true, deep: true }
)

watch(
  () => JSON.stringify({
    allowToolCalling: store.allowToolCalling,
    mcpBridgeEnabled: store.toolCallingConfig?.mcpBridgeEnabled,
    mcpBridgeUrl: store.toolCallingConfig?.mcpBridgeUrl || '',
    mcpServers: toolCallingServers.value
  }),
  () => {
    if (store.allowToolCalling && store.toolCallingConfig?.mcpBridgeEnabled && String(store.toolCallingConfig?.mcpBridgeUrl || '').trim()) {
      void refreshBridgeStatus({ force: true, silent: true })
      return
    }
    mcpBridgeStatus.value = createInitialMcpBridgeStatus()
  },
  { immediate: true }
)

function handleAllowAIFavoriteChange(nextValue) {
  store.allowAIFavorite = !!nextValue
  void flushSaveNow()
}

function formatJsonInline(value) {
  try {
    return JSON.stringify(value ?? [])
  } catch {
    return '[]'
  }
}

function formatJsonBlock(value) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function createInitialMcpBridgeStatus() {
  return {
    reachable: false,
    bridgeName: '',
    serverCount: 0,
    connectedCount: 0,
    toolsCount: 0,
    servers: [],
    lastError: '',
    updatedAt: 0
  }
}

function updateToolCallingConfig(patch) {
  store.toolCallingConfig = {
    ...store.toolCallingConfig,
    ...patch
  }
  scheduleSave()
}

function updateDirectServers(nextServers) {
  updateToolCallingConfig({ mcpDirectServers: nextServers })
}

function handleAddDirectServer() {
  updateDirectServers([
    ...directServers.value,
    { id: makeId('mcpd'), name: '', url: '', authHeader: '', apiKey: '', enabled: true, toolsCount: 0, toolsError: '' }
  ])
}

function handleRemoveDirectServer(serverId) {
  updateDirectServers(directServers.value.filter((s) => s.id !== serverId))
}

function handleDirectServerToggle(serverId, nextValue) {
  updateDirectServers(directServers.value.map((s) => s.id !== serverId ? s : { ...s, enabled: !!nextValue }))
}

function handleDirectServerFieldChange(serverId, key, nextValue) {
  updateDirectServers(directServers.value.map((s) => s.id !== serverId ? s : { ...s, [key]: String(nextValue || '').trim() }))
}

async function handleTestDirectServer(serverId) {
  directServerBusy.value = { ...directServerBusy.value, [serverId]: true }
  try {
    const result = await testDirectServer(serverId)
    updateDirectServers(directServers.value.map((s) =>
      s.id !== serverId ? s : { ...s, toolsCount: result.toolsCount, toolsError: result.error || '', toolNames: result.toolNames || [] }
    ))
    if (result.error) {
      showToast(result.error, 2800)
    } else {
      showToast(`连接成功，发现 ${result.toolsCount} 个工具`, 2200)
    }
  } finally {
    directServerBusy.value = { ...directServerBusy.value, [serverId]: false }
  }
}

function handleAllowToolCallingChange(nextValue) {
  store.allowToolCalling = !!nextValue
  scheduleSave()
}

function handleMaxToolRoundsChange(nextValue) {
  const rounds = Number(nextValue)
  updateToolCallingConfig({
    maxToolRounds: Number.isFinite(rounds) ? Math.max(1, Math.min(8, Math.round(rounds))) : 3
  })
}

function handleShowToolLogChange(nextValue) {
  updateToolCallingConfig({
    showToolLog: !!nextValue
  })
}

function handleMcpBridgeEnabledChange(nextValue) {
  updateToolCallingConfig({
    mcpBridgeEnabled: !!nextValue
  })
}

function handleMcpBridgeUrlChange() {
  updateToolCallingConfig({
    mcpBridgeUrl: String(store.toolCallingConfig?.mcpBridgeUrl || '').trim()
  })
}

async function refreshBridgeStatus({ force = false, silent = false } = {}) {
  const bridgeUrl = String(store.toolCallingConfig?.mcpBridgeUrl || '').trim()
  if (!bridgeUrl) {
    mcpBridgeStatus.value = createInitialMcpBridgeStatus()
    if (!silent) {
      showToast('请先填写 MCP 桥接地址', 2200)
    }
    return mcpBridgeStatus.value
  }

  mcpBridgeBusy.value = true
  try {
    const status = await getBridgeStatus({ force })
    mcpBridgeStatus.value = status

    if (!silent) {
      if (status.reachable) {
        showToast(`桥接可用，已发现 ${status.toolsCount} 个工具`, 2200)
      } else if (status.lastError) {
        showToast(status.lastError, 2600)
      }
    }

    return status
  } finally {
    mcpBridgeBusy.value = false
  }
}

async function handleTestMcpBridge() {
  await refreshBridgeStatus({ force: true })
}

async function handleRefreshMcpBridgeTools() {
  const bridgeUrl = String(store.toolCallingConfig?.mcpBridgeUrl || '').trim()
  if (!bridgeUrl) {
    showToast('请先填写 MCP 桥接地址', 2200)
    return
  }

  mcpRefreshBusy.value = true
  try {
    const discovery = await refreshMcpTools()
    const status = await refreshBridgeStatus({ force: true, silent: true })
    const toolCount = Array.isArray(discovery?.tools) ? discovery.tools.length : status.toolsCount

    mcpBridgeStatus.value = {
      ...status,
      toolsCount: toolCount
    }

    if (status.reachable) {
      showToast(`已刷新 ${toolCount} 个 MCP 工具`, 2200)
    }
  } finally {
    mcpRefreshBusy.value = false
  }
}

function createDefaultMcpServer() {
  return {
    id: makeId('mcp'),
    name: '',
    transport: 'stdio',
    command: '',
    args: [],
    env: {},
    url: '',
    enabled: true
  }
}

function updateMcpServers(nextServers) {
  updateToolCallingConfig({
    mcpServers: nextServers
  })
}

function updateSingleMcpServer(serverId, updater) {
  updateMcpServers(
    toolCallingServers.value.map((server) => {
      if (server.id !== serverId) return server
      const next = typeof updater === 'function' ? updater(server) : updater
      return { ...server, ...next }
    })
  )
}

function setMcpServerError(serverId, key, message = '') {
  mcpServerErrors.value = {
    ...mcpServerErrors.value,
    [serverId]: {
      ...(mcpServerErrors.value[serverId] || {}),
      [key]: message
    }
  }
}

function handleAddMcpServer() {
  updateMcpServers([
    ...toolCallingServers.value,
    createDefaultMcpServer()
  ])
}

function handleRemoveMcpServer(serverId) {
  updateMcpServers(toolCallingServers.value.filter((server) => server.id !== serverId))
}

function handleMcpServerToggle(serverId, nextValue) {
  updateSingleMcpServer(serverId, { enabled: !!nextValue })
}

function handleMcpServerTransportChange(serverId, nextValue) {
  updateSingleMcpServer(serverId, {
    transport: nextValue === 'http' ? 'http' : 'stdio'
  })
}

function handleMcpServerFieldChange(serverId, key, nextValue) {
  updateSingleMcpServer(serverId, {
    [key]: String(nextValue || '').trim()
  })
}

function handleMcpArgsDraftInput(serverId, value) {
  mcpArgsDrafts.value = {
    ...mcpArgsDrafts.value,
    [serverId]: value
  }
}

function handleMcpEnvDraftInput(serverId, value) {
  mcpEnvDrafts.value = {
    ...mcpEnvDrafts.value,
    [serverId]: value
  }
}

function handleMcpServerArgsBlur(serverId) {
  try {
    const raw = String(mcpArgsDrafts.value[serverId] || '').trim()
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) {
      throw new Error('参数必须是 JSON 数组')
    }
    setMcpServerError(serverId, 'args', '')
    updateSingleMcpServer(serverId, {
      args: parsed.map((item) => String(item ?? '').trim()).filter(Boolean)
    })
    mcpArgsDrafts.value = {
      ...mcpArgsDrafts.value,
      [serverId]: formatJsonInline(parsed)
    }
  } catch (error) {
    const message = error?.message || '参数必须是 JSON 数组'
    setMcpServerError(serverId, 'args', message)
    showToast(message, 2800)
  }
}

function handleMcpServerEnvBlur(serverId) {
  try {
    const raw = String(mcpEnvDrafts.value[serverId] || '').trim()
    const parsed = raw ? JSON.parse(raw) : {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('环境变量必须是 JSON 对象')
    }
    setMcpServerError(serverId, 'env', '')
    const nextEnv = Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [String(key || '').trim(), String(value ?? '').trim()])
        .filter(([key]) => !!key)
    )
    updateSingleMcpServer(serverId, { env: nextEnv })
    mcpEnvDrafts.value = {
      ...mcpEnvDrafts.value,
      [serverId]: formatJsonBlock(nextEnv)
    }
  } catch (error) {
    const message = error?.message || '环境变量必须是 JSON 对象'
    setMcpServerError(serverId, 'env', message)
    showToast(message, 2800)
  }
}
</script>
