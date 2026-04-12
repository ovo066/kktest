export const PRESET_CHAT_FORMAT_BOOK_ID = 'preset_chat_format_v1'
export const PRESET_CHAT_FORMAT_KEY = 'chat-format-v1'
export const PRESET_IMAGE_GEN_BOOK_ID = 'preset_image_generation_v1'
export const PRESET_IMAGE_GEN_KEY = 'chat-image-generation-v1'

export const DEFAULT_CHAT_FORMAT_TEMPLATE = `你正在和{{user}}手机聊天

输出规则：
1. 每行是一条消息，口语化。
2. 旁白/心理/动作等描写用 *...* 包裹。`

const LEGACY_CHAT_FORMAT_TEMPLATE_CURRENT = `输出规则：
1. 每行一条消息，口语化，像真人发微信。
2. 旁白/心理/动作等用 *...* 包裹。
3. 只输出 {{char}} 的发言，不代替 {{user}} 说话。`

const LEGACY_CHAT_FORMAT_TEMPLATE_SHORT = `输出规则：
1. 每行一条消息，口语化短句，像真人发微信。
2. 旁白/心理/动作用 *...* 包裹。
3. 只输出 {{char}} 的发言，不代替 {{user}} 说话。`

const LEGACY_CHAT_FORMAT_TEMPLATE_LONG = `你正在和 {{user}} 进行手机聊天，对方名称是 {{char}}。

输出规则：
1. 每一行必须是一条可显示的消息。
2. 心理描写、动作、场景旁白统一用 *...* 包裹。
3. 不要输出说明、标题、前后缀、JSON 或代码块。
4. 不要代替 {{user}} 发言，不要重复用户原话。
5. 保持口语化、短句优先，符合即时聊天节奏。
6. 需要“引用回复”时，使用两行格式：
   [quote:被引用消息原文]
   回复正文（不要把 [quote:...] 写在正文中间）。`

export const DEFAULT_IMAGE_GENERATION_TEMPLATE = `你可以发送真实图片。发图的唯一方式是在单独一行输出 image token，禁止用文字描述图片来代替。

适合发图的时机：用户想看、你在分享见闻/展示场景、视觉内容比文字更直观时，像真人发照片一样自然。

输出规则：
1. 仅在单独一行输出：(image:tag1, tag2, tag3, ...)
2. 每次回复最多 1 个 image token；可以先正常回复一句，再单独一行给 image token。
3. image token 里只写动作、场景、镜头、光影、情绪相关 tag。
4. 不要在 image token 中写角色外观 tag、画师 tag，系统会自动拼接。
5. tag 使用英文 danbooru 风格（小写+下划线），用英文逗号分隔，6-20 个高信息密度 tag。
6. 非角色图（风景、食物、物品等）加 type 前缀：(image:type=scene, sunset, beach)
7. 若当前不适合发图则不要输出 image token；禁止输出 JSON、代码块或解释性前后缀。`

export const DEFAULT_IMAGE_GENERATION_TEMPLATE_NL = `你可以发送真实图片。适合发图时在单独一行输出 image token，像真人发照片一样自然。

1. 格式：(image:简短描述)，每次最多 1 个，单独占一行。
2. 角色图只写动作/场景/情绪（系统处理外观），如 (image:在咖啡厅微笑着看窗外)
3. 非角色图加前缀：(image:type=scene, 夕阳下的海滩)`

function normalizePromptText(text) {
  return String(text || '').replace(/\r\n/g, '\n').trim()
}

export function isPresetChatFormatBook(book) {
  return !!book && (book.presetKey === PRESET_CHAT_FORMAT_KEY || book.id === PRESET_CHAT_FORMAT_BOOK_ID)
}

export function isPresetImageGenerationBook(book) {
  return !!book && (book.presetKey === PRESET_IMAGE_GEN_KEY || book.id === PRESET_IMAGE_GEN_BOOK_ID)
}

export function isReservedPromptPresetBook(book) {
  return isPresetChatFormatBook(book) || isPresetImageGenerationBook(book)
}

export function createChatFormatPresetBook(now = Date.now()) {
  return {
    id: PRESET_CHAT_FORMAT_BOOK_ID,
    presetKey: PRESET_CHAT_FORMAT_KEY,
    name: '聊天格式',
    description: '约束 AI 输出为手机聊天气泡格式',
    icon: '🧩',
    entries: [{
      id: 'preset_entry_chat_format_v1',
      name: '手机聊天格式',
      content: DEFAULT_CHAT_FORMAT_TEMPLATE,
      keywords: [],
      insertDepth: 0,
      alwaysActive: true,
      enabled: true,
      order: 0,
      createdAt: now,
      updatedAt: now
    }],
    createdAt: now,
    updatedAt: now
  }
}

export function createImageGenerationPresetBook(now = Date.now()) {
  return {
    id: PRESET_IMAGE_GEN_BOOK_ID,
    presetKey: PRESET_IMAGE_GEN_KEY,
    name: 'AI生图',
    description: '规范 AI 主动发图 token（配合 VN 生图配置）',
    icon: '🖼️',
    entries: [{
      id: 'preset_entry_image_generation_v1',
      name: '主动生图规则（NAI / Danbooru）',
      content: DEFAULT_IMAGE_GENERATION_TEMPLATE,
      keywords: [],
      insertDepth: 0,
      alwaysActive: true,
      enabled: true,
      order: 0,
      createdAt: now,
      updatedAt: now
    }],
    createdAt: now,
    updatedAt: now
  }
}

export function isLegacyChatFormatTemplate(content) {
  const text = normalizePromptText(content)
  if (!text) return false
  return (
    text === normalizePromptText(LEGACY_CHAT_FORMAT_TEMPLATE_CURRENT) ||
    text === normalizePromptText(LEGACY_CHAT_FORMAT_TEMPLATE_SHORT) ||
    text === normalizePromptText(LEGACY_CHAT_FORMAT_TEMPLATE_LONG)
  )
}

export function isLegacyImageGenerationTemplate(content) {
  const text = normalizePromptText(content)
  if (!text) return false
  if (text.includes('发图的唯一方式是在单独一行输出')) return false
  return (
    text.includes('无需用户明确说”生成图片”') ||
    (text.includes('当你认为图片能明显提升聊天体验时，可以主动发送图片。') &&
    text.includes('仅在单独一行输出：(image:tag1, tag2, tag3, ...)'))
  )
}
