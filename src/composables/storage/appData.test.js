import { describe, expect, it } from 'vitest'
import { defaultAppData, hasUserData, normalizeLoadedAppData, prepareLoadedAppData } from './appData'
import { APP_DATA_MODULES } from './appDataModules'
import { STORAGE_APPLY_MODULES, STORAGE_SNAPSHOT_MODULES } from './storageModules'
import { DESKTOP_APP_KEYS } from '../../data/homeApps'
import { DEFAULT_CHAT_FORMAT_TEMPLATE } from '../../utils/presetPromptBooks'

describe('appData theme defaults', () => {
  it('returns isolated theme defaults for each snapshot', () => {
    const first = defaultAppData()
    const second = defaultAppData()

    first.theme.appIcons.messages = 'custom-icon'
    first.theme.headerActions.push('video')

    expect(second.theme.appIcons.messages).toBe(null)
    expect(second.theme.headerActions).toEqual([])
  })

  it('returns isolated planner and offline defaults for each snapshot', () => {
    const first = defaultAppData()
    const second = defaultAppData()

    first.planner.categories[0].name = '已修改'
    first.offlinePresets.themeConfig.customCss = 'body { color: red; }'

    expect(second.planner.categories[0].name).toBe('工作')
    expect(second.offlinePresets.themeConfig.customCss).toBe('')
  })

  it('keeps app data module ids aligned with snapshot/apply storage modules', () => {
    const moduleIds = APP_DATA_MODULES.map(module => module.id).sort()
    const snapshotIds = [...new Set(STORAGE_SNAPSHOT_MODULES.map(module => module.id))].sort()
    const applyIds = [...new Set(STORAGE_APPLY_MODULES.map(module => module.id))].sort()

    expect(snapshotIds).toEqual(moduleIds)
    expect(applyIds).toEqual(moduleIds)
  })

  it('fills missing theme fields and icon slots during normalization', () => {
    const normalized = normalizeLoadedAppData({
      theme: {
        primaryColor: '#123456',
        appIcons: {
          messages: 'custom-icon'
        }
      }
    })

    expect(normalized.theme.primaryColor).toBe('#123456')
    expect(normalized.theme.headerActions).toEqual([])
    expect(normalized.theme.showPhoneStatusBar).toBe(true)
    expect(normalized.theme.appIcons.messages).toBe('custom-icon')
    DESKTOP_APP_KEYS.forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(normalized.theme.appIcons, key)).toBe(true)
    })
    expect(normalized.theme.appIcons.meet).toBe(null)
    expect(normalized.theme.appIcons.album).toBe(null)
    expect(normalized.theme.appIcons.planner).toBe(null)
    expect(normalized.theme.appIcons.favorites).toBe(null)
  })
  it('infers STT provider from known endpoint hosts during normalization', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        sttEngine: 'online',
        sttTriggerMode: 'unexpected',
        sttApiUrl: 'https://api.deepgram.com/v1/listen',
        sttProvider: ''
      }
    })

    expect(normalized.settings.sttTriggerMode).toBe('auto')
    expect(normalized.settings.sttProvider).toBe('deepgram')
  })
  it('recognizes partitioned contact metadata as user data', () => {
    const snapshot = defaultAppData()
    snapshot.contacts = [{
      id: 'demo',
      name: 'AI 助手',
      msgCount: 3,
      lastMsgPreview: '最近消息',
      lastMsgTime: Date.now()
    }]

    expect(hasUserData(snapshot)).toBe(true)
  })

  it('inherits planner auto capture from legacy planner toggle when field is missing', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        allowPlannerAI: true
      }
    })

    expect(normalized.settings.allowPlannerAI).toBe(true)
    expect(normalized.settings.allowAIPlannerCapture).toBe(true)
  })

  it('marks legacy planner and whisper settings as migrations that need saving', () => {
    const prepared = prepareLoadedAppData({
      settings: {
        allowPlannerAI: true,
        whisperApiUrl: 'https://stt.example.com/v1',
        whisperApiKey: 'secret',
        whisperApiModel: 'whisper-1',
        sttEngine: 'whisper-api'
      }
    })

    expect(prepared.needsSave).toBe(true)
    expect(prepared.appliedMigrations).toEqual(expect.arrayContaining([
      'legacy-planner-auto-capture',
      'legacy-whisper-stt-settings'
    ]))
    expect(prepared.data.settings.allowAIPlannerCapture).toBe(true)
    expect(prepared.data.settings.sttEngine).toBe('online')
    expect(prepared.data.settings.sttApiUrl).toBe('https://stt.example.com/v1')
  })

  it('keeps explicit planner auto capture setting when provided', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        allowPlannerAI: true,
        allowAIPlannerCapture: false
      }
    })

    expect(normalized.settings.allowAIPlannerCapture).toBe(false)
  })

  it('preserves custom cloud sync thresholds during normalization', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        cloudSyncAutoSyncPolicy: 'custom',
        cloudSyncCustomMinIntervalMs: 90 * 60 * 1000,
        cloudSyncCustomMinDeltaBytes: 3 * 1024 * 1024
      }
    })

    expect(normalized.settings.cloudSyncAutoSyncPolicy).toBe('custom')
    expect(normalized.settings.cloudSyncCustomMinIntervalMs).toBe(90 * 60 * 1000)
    expect(normalized.settings.cloudSyncCustomMinDeltaBytes).toBe(3 * 1024 * 1024)
  })

  it('normalizes tool calling settings and MCP bridge payloads', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        allowToolCalling: 1,
        toolCallingConfig: {
          maxToolRounds: '11',
          showToolLog: 1,
          mcpBridgeUrl: '  http://localhost:4010  ',
          mcpBridgeEnabled: 'yes',
          mcpServers: [
            { name: 'calendar ', transport: ' http ', url: ' http://127.0.0.1:7001/mcp ', enabled: false },
            { command: ' node ./server.js ', args: [' --stdio ', 'demo '], env: { API_KEY: ' 123 ' } }
          ],
          mcpDirectServers: [
            { id: ' direct_notion ', name: ' Notion ', url: ' https://mcp.example.com/notion ', apiKey: ' secret ' }
          ]
        }
      }
    })

    expect(normalized.settings.allowToolCalling).toBe(true)
    expect(normalized.settings.toolCallingConfig.maxToolRounds).toBe(8)
    expect(normalized.settings.toolCallingConfig.showToolLog).toBe(true)
    expect(normalized.settings.toolCallingConfig.mcpBridgeUrl).toBe('http://localhost:4010')
    expect(normalized.settings.toolCallingConfig.mcpBridgeEnabled).toBe(true)
    expect(normalized.settings.toolCallingConfig.mcpServers).toEqual([
      { name: 'calendar', transport: 'http', url: 'http://127.0.0.1:7001/mcp', enabled: false },
      { command: 'node ./server.js', args: ['--stdio', 'demo'], env: { API_KEY: '123' }, enabled: true }
    ])
    expect(normalized.settings.toolCallingConfig.mcpDirectServers).toEqual([
      { id: 'direct_notion', name: 'Notion', url: 'https://mcp.example.com/notion', apiKey: 'secret', enabled: true }
    ])
  })

  it('normalizes contact and group MCP server selections', () => {
    const normalized = normalizeLoadedAppData({
      contacts: [
        {
          id: 'c_1',
          name: 'Alice',
          prompt: 'hello',
          mcpServerIds: [' calendar ', '', 'calendar', 'filesystem '],
          msgs: []
        },
        {
          id: 'g_1',
          type: 'group',
          name: 'Team',
          mcpServerIds: [' group-a ', 'group-a'],
          members: [
            {
              id: 'm_1',
              contactId: 'c_1',
              name: 'Alice',
              mcpServerIds: [' member-a ', '', 'member-a']
            }
          ],
          msgs: []
        }
      ]
    })

    expect(normalized.contacts[0].mcpServerIds).toEqual(['calendar', 'filesystem'])
    expect(normalized.contacts[1].mcpServerIds).toEqual(['group-a'])
    expect(normalized.contacts[1].members[0].mcpServerIds).toEqual(['member-a'])
  })

  it('normalizes meet, resources, music, and snoop payloads through registered modules', () => {
    const normalized = normalizeLoadedAppData({
      meetMeetings: { broken: true },
      meetPresets: null,
      meetCurrentMeetingId: 123,
      meetAssetSources: 'invalid',
      callResources: 'invalid',
      characterResources: [],
      music: 'invalid',
      snoop: []
    })

    expect(normalized.meetMeetings).toEqual([])
    expect(normalized.meetPresets).toEqual([])
    expect(normalized.meetCurrentMeetingId).toBe(null)
    expect(normalized.meetAssetSources).toBe(null)
    expect(normalized.callResources).toEqual({})
    expect(normalized.characterResources).toEqual({})
    expect(normalized.music).toBe(null)
    expect(normalized.snoop).toEqual({})
  })

  it('runs forum and offline migrations through the registered migration runner', () => {
    const prepared = prepareLoadedAppData({
      offlinePresets: [{ id: 'preset_1', name: '旧格式' }],
      forum: [{
        id: 'moment_1',
        title: '旧标题',
        content: '旧内容',
        authorId: 'user',
        replies: [{ id: 'reply_1', authorId: 'user', content: '回复' }]
      }]
    })

    expect(prepared.needsSave).toBe(true)
    expect(prepared.appliedMigrations).toEqual(expect.arrayContaining([
      'legacy-offline-presets-array',
      'legacy-forum-snapshot'
    ]))
    expect(prepared.data.forumUser).toMatchObject({
      id: 'forum_user',
      name: '匿名用户'
    })
    expect(prepared.data.forum[0]).toMatchObject({
      content: '旧标题\n旧内容',
      authorId: 'forum_user',
      authorName: '匿名用户',
      _momentVersion: 1
    })
    expect(prepared.data.forum[0].replies[0]).toMatchObject({
      authorId: 'forum_user',
      authorName: '匿名用户'
    })
    expect(prepared.data.offlinePresets.presets).toEqual([{ id: 'preset_1', name: '旧格式' }])
  })

  it('normalizes sound settings and drops missing selections', () => {
    const normalized = normalizeLoadedAppData({
      settings: {
        soundConfig: {
          enabled: true,
          volume: 2.4,
          customSounds: [
            { id: 'custom_ping', name: 'Ping', source: 'data:audio/wav;base64,AAAA', size: 128 },
            { id: 'broken', name: 'Broken', source: 'blob:temp-sound' }
          ],
          events: {
            notification: {
              enabled: true,
              soundId: 'custom_ping'
            },
            typing: {
              enabled: true,
              soundId: 'missing'
            }
          }
        }
      }
    })

    expect(normalized.settings.soundConfig.enabled).toBe(true)
    expect(normalized.settings.soundConfig.volume).toBe(1)
    expect(normalized.settings.soundConfig.customSounds).toHaveLength(1)
    expect(normalized.settings.soundConfig.events.notification.soundId).toBe('custom_ping')
    expect(normalized.settings.soundConfig.events.typing.soundId).toBe('type_01')
  })

  it('upgrades legacy chat format preset content to the current default template', () => {
    const normalized = normalizeLoadedAppData({
      lorebook: [{
        id: 'preset_chat_format_v1',
        presetKey: 'chat-format-v1',
        entries: [{
          id: 'preset_entry_chat_format_v1',
          content: `输出规则：
1. 每行一条消息，口语化短句，像真人发微信。
2. 旁白/心理/动作用 *...* 包裹。
3. 只输出 {{char}} 的发言，不代替 {{user}} 说话。`
        }]
      }]
    })

    const presetBook = normalized.lorebook.find(book => book.id === 'preset_chat_format_v1')
    expect(presetBook?.entries?.[0]?.content).toBe(DEFAULT_CHAT_FORMAT_TEMPLATE)
  })

  it('upgrades the previous long chat format default to the current default template', () => {
    const normalized = normalizeLoadedAppData({
      lorebook: [{
        id: 'preset_chat_format_v1',
        presetKey: 'chat-format-v1',
        entries: [{
          id: 'preset_entry_chat_format_v1',
          content: `你正在和 {{user}} 进行手机聊天，对方名称是 {{char}}。

输出规则：
1. 每一行必须是一条可显示的消息。
2. 心理描写、动作、场景旁白统一用 *...* 包裹。
3. 不要输出说明、标题、前后缀、JSON 或代码块。
4. 不要代替 {{user}} 发言，不要重复用户原话。
5. 保持口语化、短句优先，符合即时聊天节奏。
6. 需要“引用回复”时，使用两行格式：
   [quote:被引用消息原文]
   回复正文（不要把 [quote:...] 写在正文中间）。`
        }]
      }]
    })

    const presetBook = normalized.lorebook.find(book => book.id === 'preset_chat_format_v1')
    expect(presetBook?.entries?.[0]?.content).toBe(DEFAULT_CHAT_FORMAT_TEMPLATE)
  })

  it('preserves customized chat format preset content during normalization', () => {
    const customContent = '按我的规则输出，不要替换。'
    const normalized = normalizeLoadedAppData({
      lorebook: [{
        id: 'preset_chat_format_v1',
        presetKey: 'chat-format-v1',
        entries: [{
          id: 'preset_entry_chat_format_v1',
          content: customContent
        }]
      }]
    })

    const presetBook = normalized.lorebook.find(book => book.id === 'preset_chat_format_v1')
    expect(presetBook?.entries?.[0]?.content).toBe(customContent)
  })
})

