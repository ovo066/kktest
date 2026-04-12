// Thin public entry kept for backward compatibility with existing imports.
export {
  getTemplateVars,
  normalizeRoleAliasesToTemplateVars,
  applyTemplateVars
} from './prompts/templateVars'
export {
  formatTimestampForAI,
  buildTimestampSystemPrompt,
  buildTimestampData
} from './prompts/timeContext'
export {
  buildChatFormatSystemPrompt,
  buildImageGenerationPrompt
} from './prompts/promptTemplates'
export {
  buildPersonaSystemPrompt,
  buildGroupSystemPrompt
} from './prompts/characterPrompts'
export {
  buildReplyFormatSystemPrompt,
  buildStickerSystemPrompt,
  buildSpecialFeaturesSystemPrompt
} from './prompts/featureRules'
export { insertLorebookEntries } from './prompts/lorebook'
export { buildUnifiedSystemPrompt } from './prompts/unifiedPrompt'
