<template>
  <IosModal
    :visible="visible"
    :title="isEdit ? '编辑群聊' : '新建群聊'"
    :show-delete="isEdit"
    height="90%"
    @close="$emit('close')"
    @done="saveGroup"
    @delete="deleteGroup"
  >
    <div class="p-6 flex flex-col gap-5">
      <!-- 群聊头像和名称 -->
      <div class="flex flex-col items-center gap-3">
        <div class="group-avatar-preview">
          <template v-if="form.members.length > 0">
            <div
              v-for="(member, idx) in form.members.slice(0, 4)"
              :key="idx"
              class="group-avatar-item"
              :style="getAvatarPosition(idx, Math.min(form.members.length, 4))"
            >
              <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
              <span v-else class="text-sm">{{ member.avatar }}</span>
            </div>
          </template>
          <span v-else class="text-3xl">👥</span>
        </div>
      </div>

      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <input
          v-model="form.name"
          type="text"
          placeholder="群聊名称 (必填)"
          class="w-full px-4 py-3 text-[17px] outline-none bg-transparent dark:text-white"
        >
      </div>

      <!-- 群聊模式 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">群聊模式</span>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700"
          @click="form.groupMode = 'single'"
        >
          <div class="flex-1">
            <div class="text-[17px] text-black dark:text-white">单API模拟</div>
            <div class="text-[13px] text-[#8E8E93]">一个API模拟所有角色对话，成本低</div>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 ml-3"
            :class="form.groupMode === 'single' ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.groupMode === 'single'" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
          @click="form.groupMode = 'multi'"
        >
          <div class="flex-1">
            <div class="text-[17px] text-black dark:text-white">多API独立</div>
            <div class="text-[13px] text-[#8E8E93]">每个角色独立API，指定发言人</div>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 ml-3"
            :class="form.groupMode === 'multi' ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.groupMode === 'multi'" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- 已选群成员 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700 flex justify-between items-center">
          <span class="text-[13px] text-[#8E8E93] uppercase">已选成员 ({{ form.members.length }})</span>
        </div>
        <div v-if="form.members.length === 0" class="px-4 py-4 text-[#8E8E93] text-center text-[14px]">
          请从下方联系人列表中选择
        </div>
        <div v-else class="px-4 py-3 flex flex-col gap-2">
          <div
            v-for="member in form.members"
            :key="member.contactId"
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F2F2F7] dark:bg-gray-800"
          >
            <div class="w-8 h-8 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-base overflow-hidden shrink-0">
              <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
              <span v-else>{{ member.avatar }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[15px] text-black dark:text-white font-medium">{{ member.name }}</div>
              <div class="text-[12px] text-[#8E8E93]">
                <span v-if="form.groupMode === 'multi'">
                  API: {{ member.configId ? getConfigName(member.configId) : '默认' }}
                </span>
                <span v-else class="text-[#8E8E93]">单API模式</span>
              </div>
              <div class="text-[12px] text-[#8E8E93] mt-0.5">贴纸：{{ memberStickerLabel(member) }}</div>
              <div class="text-[12px] text-[#8E8E93] mt-0.5">MCP：{{ memberMcpLabel(member) }}</div>
            </div>
            <button class="text-[#8E8E93] hover:text-[#FF3B30] p-1" @click="removeMember(member.contactId)">
              <i class="ph ph-x text-base"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 从联系人选择 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">选择联系人</span>
        </div>
        <div v-if="availableContacts.length === 0" class="px-4 py-6 text-[#8E8E93] text-center">
          暂无可选联系人
        </div>
        <div
          v-for="contact in availableContacts"
          :key="contact.id"
          class="px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0"
          @click="toggleContact(contact)"
        >
          <div class="w-10 h-10 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-xl overflow-hidden shrink-0">
            <img v-if="contact.avatarType === 'image'" :src="contact.avatar" class="w-full h-full object-cover">
            <span v-else>{{ contact.avatar || '🤖' }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[17px] text-black dark:text-white truncate">{{ contact.name }}</div>
            <div class="text-[13px] text-[#8E8E93] truncate">
              {{ contact.configId ? getConfigName(contact.configId) : '默认API' }}
              <span v-if="contact.prompt"> · {{ contact.prompt.slice(0, 20) }}...</span>
            </div>
            <div class="text-[12px] text-[#8E8E93] truncate">贴纸：{{ contactStickerLabel(contact) }}</div>
            <div class="text-[12px] text-[#8E8E93] truncate">MCP：{{ contactMcpLabel(contact) }}</div>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0"
            :class="isContactSelected(contact.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="isContactSelected(contact.id)" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- 单API模式的全局配置 -->
      <div v-if="form.groupMode === 'single'" class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">使用的API配置</span>
        </div>
        <div
          v-for="cfg in configsStore.configs"
          :key="cfg.id"
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0"
          @click="form.configId = cfg.id"
        >
          <span class="text-[17px] text-black dark:text-white">{{ cfg.name }}</span>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
            :class="form.configId === cfg.id ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.configId === cfg.id" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- 多API模式提示 -->
      <div v-if="form.groupMode === 'multi'" class="text-[13px] text-[#8E8E93] text-center px-4">
        多API模式下，每个成员将使用其联系人绑定的API配置（如有），否则使用默认配置
      </div>

      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">群聊MCP服务器</span>
        </div>
        <div v-if="availableMcpServers.length === 0" class="px-4 py-3 text-[#8E8E93] text-center">
          暂无可选 MCP 服务器，请先在“设置-AI功能”中配置。
        </div>
        <template v-else>
          <div
            class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700"
            @click="form.mcpServerIds = []"
          >
            <div class="flex items-center gap-2">
              <span class="text-xl">🌐</span>
              <div>
                <div class="text-[17px] text-black dark:text-white">全部已启用服务器</div>
                <div class="text-[12px] text-[#8E8E93]">留空时不限制群聊可用的 MCP 列表</div>
              </div>
            </div>
            <div
              class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
              :class="form.mcpServerIds.length === 0 ? 'bg-[#FF9500] border-[#FF9500]' : 'border-[#C6C6C8]'"
            >
              <i v-if="form.mcpServerIds.length === 0" class="ph-bold ph-check text-white text-sm"></i>
            </div>
          </div>
          <div
            v-for="server in availableMcpServers"
            :key="server.id"
            class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0"
            @click="toggleGroupMcpServer(server.id)"
          >
            <div class="flex items-center gap-2">
              <span class="text-xl">🧰</span>
              <div>
                <div class="text-[17px] text-black dark:text-white">{{ server.name || server.id }}</div>
                <div class="text-[12px] text-[#8E8E93]">
                  {{ server.transport === 'http' ? 'HTTP' : 'STDIO' }}
                  <span v-if="server.enabled === false"> · 全局已禁用</span>
                </div>
              </div>
            </div>
            <div
              class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
              :class="form.mcpServerIds.includes(server.id) ? 'bg-[#FF9500] border-[#FF9500]' : 'border-[#C6C6C8]'"
            >
              <i v-if="form.mcpServerIds.includes(server.id)" class="ph-bold ph-check text-white text-sm"></i>
            </div>
          </div>
        </template>
      </div>

      <div v-if="form.members.length > 0 && availableMcpServers.length > 0" class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">成员MCP覆盖</span>
        </div>
        <div class="px-4 py-3 text-[12px] text-[#8E8E93] border-b border-[#E5E5EA] dark:border-gray-700">
          留空则继承群聊设置；在单API群聊中会合并所有成员的自定义服务器。
        </div>
        <div
          v-for="member in form.members"
          :key="`member-mcp-${member.id}`"
          class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0 space-y-3"
        >
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-base overflow-hidden shrink-0">
              <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
              <span v-else>{{ member.avatar }}</span>
            </div>
            <div class="min-w-0">
              <div class="text-[15px] text-black dark:text-white">{{ member.name }}</div>
              <div class="text-[12px] text-[#8E8E93]">{{ memberMcpLabel(member) }}</div>
            </div>
          </div>
          <div
            class="flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 rounded-lg px-3 py-2"
            @click="member.mcpServerIds = []"
          >
            <div>
              <div class="text-[15px] text-black dark:text-white">继承群聊设置</div>
              <div class="text-[12px] text-[#8E8E93]">未单独指定时使用群聊 MCP 列表</div>
            </div>
            <div
              class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
              :class="!member.mcpServerIds?.length ? 'bg-[#FF9500] border-[#FF9500]' : 'border-[#C6C6C8]'"
            >
              <i v-if="!member.mcpServerIds?.length" class="ph-bold ph-check text-white text-sm"></i>
            </div>
          </div>
          <div class="space-y-2">
            <div
              v-for="server in availableMcpServers"
              :key="`${member.id}-${server.id}`"
              class="flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 rounded-lg px-3 py-2"
              @click="toggleMemberMcpServer(member.id, server.id)"
            >
              <div>
                <div class="text-[15px] text-black dark:text-white">{{ server.name || server.id }}</div>
                <div class="text-[12px] text-[#8E8E93]">
                  {{ server.transport === 'http' ? 'HTTP' : 'STDIO' }}
                  <span v-if="server.enabled === false"> · 全局已禁用</span>
                </div>
              </div>
              <div
                class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
                :class="member.mcpServerIds?.includes(server.id) ? 'bg-[#FF9500] border-[#FF9500]' : 'border-[#C6C6C8]'"
              >
                <i v-if="member.mcpServerIds?.includes(server.id)" class="ph-bold ph-check text-white text-sm"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 用户面具绑定 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">用户面具</span>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700"
          @click="form.personaId = null"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl">🌐</span>
            <span class="text-[17px] text-black dark:text-white">使用全局默认</span>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
            :class="!form.personaId ? 'bg-[#AF52DE] border-[#AF52DE]' : 'border-[#C6C6C8]'"
          >
            <i v-if="!form.personaId" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
        <div
          v-for="persona in personasStore.personas"
          :key="persona.id"
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0"
          @click="form.personaId = persona.id"
        >
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-lg overflow-hidden">
              <img v-if="persona.avatarType === 'image'" :src="persona.avatar" class="w-full h-full object-cover">
              <template v-else>{{ persona.avatar }}</template>
            </div>
            <span class="text-[17px] text-black dark:text-white">{{ persona.name }}</span>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
            :class="form.personaId === persona.id ? 'bg-[#AF52DE] border-[#AF52DE]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.personaId === persona.id" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- Lorebook Binding -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">世界书绑定</span>
        </div>
        <div v-if="availableLorebooks.length === 0" class="px-4 py-3 text-[#8E8E93] text-center">暂无可绑定世界书</div>
        <div
          v-for="book in availableLorebooks"
          :key="book.id"
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700 last:border-b-0"
          @click="toggleLorebookBinding(book.id)"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ book.icon }}</span>
            <span class="text-[17px] text-black dark:text-white">{{ book.name }}</span>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center"
            :class="form.boundLorebooks.includes(book.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.boundLorebooks.includes(book.id)" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- Chat Background -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">聊天背景</span>
        </div>
        <div class="p-4">
          <div
            class="w-full h-24 rounded-lg bg-cover bg-center border border-[#E5E5EA] dark:border-gray-700 flex items-center justify-center cursor-pointer active:opacity-80"
            :style="{ backgroundImage: form.chatBackground ? `url(${form.chatBackground})` : 'none', backgroundColor: form.chatBackground ? 'transparent' : '#F2F2F7' }"
            @click="bgInput?.click()"
          >
            <span v-if="!form.chatBackground" class="text-[#8E8E93] text-sm">点击设置背景图</span>
          </div>
          <input ref="bgInput" type="file" class="hidden" accept="image/*" @change="handleBgChange">
          <button
            class="mt-3 px-3 py-1.5 rounded-full text-[12px] text-[#007AFF] bg-[#007AFF]/10 dark:bg-[#0A84FF]/20"
            @click="handleBgUrlInput"
          >
            填URL
          </button>
        </div>
        <button
          v-if="form.chatBackground"
          class="w-full px-4 py-3 text-red-500 border-t border-[#E5E5EA] dark:border-gray-700 text-center"
          @click="form.chatBackground = null"
        >
          清除背景
        </button>
      </div>

      <!-- Chat History Settings -->
      <div v-if="isEdit" class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">聊天记录管理</span>
        </div>
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <div class="flex justify-between items-center mb-2">
            <span class="text-[17px] text-black dark:text-white">保留消息条数</span>
            <span class="text-[15px] text-[#8E8E93]">{{ form.maxMessages === 0 ? '不限制' : form.maxMessages + ' 条' }}</span>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="opt in messageRetentionOptions"
              :key="opt.value"
              class="px-3 py-1.5 rounded-full text-[14px] transition-colors"
              :class="form.maxMessages === opt.value ? 'bg-[#007AFF] text-white' : 'bg-[#E9E9EB] dark:bg-gray-700 text-black dark:text-white'"
              @click="form.maxMessages = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <div class="text-[12px] text-[#8E8E93] mt-2">超出限制时自动删除最早的消息</div>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
          @click="clearChatHistory"
        >
          <span class="text-[17px] text-[#FF3B30]">清空聊天记录</span>
          <span class="text-[15px] text-[#8E8E93]">{{ currentMsgCount }} 条消息</span>
        </div>
      </div>
    </div>
  </IosModal>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useContactsStore } from '../../stores/contacts'
import { useConfigsStore } from '../../stores/configs'
import { useLorebookStore } from '../../stores/lorebook'
import { usePersonasStore } from '../../stores/personas'
import { useSettingsStore } from '../../stores/settings'
import { useStickersStore } from '../../stores/stickers'
import { useStorage } from '../../composables/useStorage'
import { useToast } from '../../composables/useToast'
import { isReservedPromptPresetBook } from '../../utils/presetPromptBooks'
import { showConfirm } from '../../composables/useConfirm'
import { compressImage } from '../../composables/useImage'
import { normalizeImageUrlInput } from '../../utils/mediaUrl'
import { describeMcpServerSelection, normalizeMcpServerIds } from '../../utils/mcpServers'
import { describeStickerGroups } from '../../utils/stickerGroups'
import IosModal from '../common/IosModal.vue'

const props = defineProps({
  visible: Boolean,
  isEdit: Boolean,
  contactId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'saved', 'deleted'])

const contactsStore = useContactsStore()
const configsStore = useConfigsStore()
const lorebookStore = useLorebookStore()
const personasStore = usePersonasStore()
const settingsStore = useSettingsStore()
const stickersStore = useStickersStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

function normalizeBoundLorebooks(bookIds) {
  if (!Array.isArray(bookIds)) return []
  return bookIds.filter(bookId => {
    const book = lorebookStore.lorebook.books.find(b => b.id === bookId)
    return !isReservedPromptPresetBook(book)
  })
}

const availableLorebooks = computed(() => {
  return (lorebookStore.lorebook?.books || []).filter(book => !isReservedPromptPresetBook(book))
})
const availableMcpServers = computed(() => (
  Array.isArray(settingsStore.toolCallingConfig?.mcpServers)
    ? settingsStore.toolCallingConfig.mcpServers
    : []
))

const bgInput = ref(null)

const form = reactive({
  name: '',
  groupMode: 'single',
  configId: null,
  personaId: null,
  boundLorebooks: [],
  mcpServerIds: [],
  members: [],
  maxMessages: 0,
  chatBackground: null
})

const messageRetentionOptions = [
  { label: '不限制', value: 0 },
  { label: '20条', value: 20 },
  { label: '50条', value: 50 },
  { label: '100条', value: 100 },
  { label: '200条', value: 200 }
]

const currentMsgCount = computed(() => {
  return editingGroup.value?.msgs?.length || 0
})

// 可选的联系人（排除群聊）
const availableContacts = computed(() => {
  return contactsStore.contacts.filter(c => c.type !== 'group')
})

const editingGroup = computed(() => {
  const contactId = String(props.contactId || '').trim()
  if (!contactId) return null
  const contact = contactsStore.contacts.find(item => String(item?.id || '') === contactId) || null
  if (!contact || contact.type !== 'group') return null
  return contact
})

function resetForm() {
  form.name = ''
  form.groupMode = 'single'
  form.configId = configsStore.activeConfigId
  form.personaId = null
  form.boundLorebooks = []
  form.mcpServerIds = []
  form.members = []
  form.maxMessages = 0
  form.chatBackground = null
}

function populateForm(group) {
  form.name = group.name || ''
  form.groupMode = group.groupMode || 'single'
  form.configId = group.configId || configsStore.activeConfigId
  form.personaId = group.personaId || null
  form.boundLorebooks = normalizeBoundLorebooks(group.boundLorebooks)
  form.mcpServerIds = normalizeMcpServerIds(group.mcpServerIds)
  form.members = JSON.parse(JSON.stringify(group.members || [])).map((member) => ({
    ...member,
    mcpServerIds: normalizeMcpServerIds(member?.mcpServerIds)
  }))
  form.maxMessages = group.maxMessages || 0
  form.chatBackground = group.chatBackground || null
}

watch(() => [props.visible, props.isEdit, props.contactId, contactsStore.contacts.length], ([visible, isEdit]) => {
  if (!visible) return

  if (isEdit && editingGroup.value) {
    populateForm(editingGroup.value)
    return
  }
  resetForm()
}, { immediate: true })

function isContactSelected(contactId) {
  return form.members.some(m => m.contactId === contactId)
}

function getConfigName(configId) {
  const cfg = configsStore.configs.find(c => c.id === configId)
  return cfg ? cfg.name : '默认API'
}

function toggleContact(contact) {
  const idx = form.members.findIndex(m => m.contactId === contact.id)
  if (idx > -1) {
    form.members.splice(idx, 1)
  } else {
    form.members.push({
      id: 'm_' + Date.now(),
      contactId: contact.id,
      name: contact.name,
      avatar: contact.avatar,
      avatarType: contact.avatarType || 'emoji',
      prompt: contact.prompt || '',
      configId: contact.configId || configsStore.activeConfigId, // 继承联系人的API配置
      stickerGroupIds: Array.isArray(contact.stickerGroupIds) ? [...contact.stickerGroupIds] : [],
      mcpServerIds: normalizeMcpServerIds(contact.mcpServerIds)
    })
  }
}

function contactStickerLabel(contact) {
  const names = describeStickerGroups(contact?.stickerGroupIds, stickersStore.stickerGroups)
  return names.length > 0 ? names.join('、') : '全部贴纸'
}

function contactMcpLabel(contact) {
  return describeMcpServerSelection(contact?.mcpServerIds, availableMcpServers.value, {
    emptyLabel: '全部已启用服务器'
  })
}

function memberStickerLabel(member) {
  const sourceContact = availableContacts.value.find(contact => contact.id === member?.contactId)
  const names = describeStickerGroups(
    sourceContact?.stickerGroupIds?.length ? sourceContact.stickerGroupIds : member?.stickerGroupIds,
    stickersStore.stickerGroups
  )
  return names.length > 0 ? names.join('、') : '全部贴纸'
}

function memberMcpLabel(member) {
  return describeMcpServerSelection(member?.mcpServerIds, availableMcpServers.value, {
    emptyLabel: '继承群聊设置'
  })
}

function toggleGroupMcpServer(serverId) {
  const index = form.mcpServerIds.indexOf(serverId)
  if (index > -1) {
    form.mcpServerIds.splice(index, 1)
  } else {
    form.mcpServerIds.push(serverId)
  }
}

function toggleMemberMcpServer(memberId, serverId) {
  const member = form.members.find(item => item.id === memberId)
  if (!member) return
  if (!Array.isArray(member.mcpServerIds)) {
    member.mcpServerIds = []
  }
  const index = member.mcpServerIds.indexOf(serverId)
  if (index > -1) {
    member.mcpServerIds.splice(index, 1)
  } else {
    member.mcpServerIds.push(serverId)
  }
}

function toggleLorebookBinding(bookId) {
  const index = form.boundLorebooks.indexOf(bookId)
  if (index > -1) {
    form.boundLorebooks.splice(index, 1)
  } else {
    form.boundLorebooks.push(bookId)
  }
}

async function handleBgChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    form.chatBackground = await compressImage(file, 800)
  }
  e.target.value = ''
}

function handleBgUrlInput() {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return
  const raw = window.prompt('请输入聊天背景图床 URL（支持 http/https）', form.chatBackground || '')
  if (raw === null) return
  const url = normalizeImageUrlInput(raw)
  if (url === null) {
    showToast('请输入有效的图片 URL')
    return
  }
  form.chatBackground = url || null
}

function removeMember(contactId) {
  const idx = form.members.findIndex(m => m.contactId === contactId)
  if (idx > -1) {
    form.members.splice(idx, 1)
  }
}

function getAvatarPosition(idx, total) {
  if (total === 1) {
    return { width: '100%', height: '100%', top: '0', left: '0' }
  }
  if (total === 2) {
    return {
      width: '50%',
      height: '100%',
      top: '0',
      left: idx === 0 ? '0' : '50%'
    }
  }
  if (total === 3) {
    if (idx === 0) return { width: '50%', height: '50%', top: '25%', left: '0' }
    return {
      width: '50%',
      height: '50%',
      top: idx === 1 ? '0' : '50%',
      left: '50%'
    }
  }
  // total === 4
  return {
    width: '50%',
    height: '50%',
    top: idx < 2 ? '0' : '50%',
    left: idx % 2 === 0 ? '0' : '50%'
  }
}

function saveGroup() {
  if (!form.name.trim()) {
    showToast('请输入群聊名称')
    return
  }
  if (form.members.length < 2) {
    showToast('至少需要选择2个成员')
    return
  }

  const boundLorebooks = normalizeBoundLorebooks(form.boundLorebooks)
  const mcpServerIds = normalizeMcpServerIds(form.mcpServerIds)
  const members = form.members.map((member) => ({
    ...member,
    mcpServerIds: normalizeMcpServerIds(member?.mcpServerIds)
  }))

  if (props.isEdit && editingGroup.value) {
    const contactIndex = contactsStore.contacts.findIndex(x => x.id === editingGroup.value.id)
    if (contactIndex !== -1) {
      contactsStore.contacts[contactIndex].name = form.name.trim()
      contactsStore.contacts[contactIndex].groupMode = form.groupMode
      contactsStore.contacts[contactIndex].configId = form.configId
      contactsStore.contacts[contactIndex].personaId = form.personaId
      contactsStore.contacts[contactIndex].boundLorebooks = [...boundLorebooks]
      contactsStore.contacts[contactIndex].mcpServerIds = [...mcpServerIds]
      contactsStore.contacts[contactIndex].members = JSON.parse(JSON.stringify(members))
      contactsStore.contacts[contactIndex].maxMessages = form.maxMessages
      contactsStore.contacts[contactIndex].chatBackground = form.chatBackground
      if (!Array.isArray(contactsStore.contacts[contactIndex].callHistory)) {
        contactsStore.contacts[contactIndex].callHistory = []
      }
      if (contactsStore.activeChat?.id === editingGroup.value.id) {
        contactsStore.activeChat = contactsStore.contacts[contactIndex]
      }
    }
    showToast('已更新')
  } else {
    const newGroup = {
      id: 'g_' + Date.now(),
      type: 'group',
      name: form.name.trim(),
      groupMode: form.groupMode,
      configId: form.configId,
      personaId: form.personaId,
      boundLorebooks: [...boundLorebooks],
      mcpServerIds: [...mcpServerIds],
      members: JSON.parse(JSON.stringify(members)),
      msgs: [],
      maxMessages: form.maxMessages,
      chatBackground: form.chatBackground,
      callHistory: []
    }
    contactsStore.contacts.unshift(newGroup)
    showToast('已创建')
  }

  scheduleSave()
  emit('saved')
  emit('close')
}

async function clearChatHistory() {
  if (!editingGroup.value) return
  const confirmed = await showConfirm({ message: `确定清空 ${currentMsgCount.value} 条聊天记录?`, destructive: true })
  if (!confirmed) return
  const contactIndex = contactsStore.contacts.findIndex(x => x.id === editingGroup.value.id)
  if (contactIndex !== -1) {
    contactsStore.contacts[contactIndex].msgs = []
    if (contactsStore.activeChat?.id === editingGroup.value.id) {
      contactsStore.activeChat = contactsStore.contacts[contactIndex]
    }
  }
  scheduleSave()
  showToast('已清空')
}

async function deleteGroup() {
  if (!props.isEdit || !editingGroup.value) return
  const confirmed = await showConfirm({ message: '确定删除群聊?', destructive: true })
  if (!confirmed) return
  const deletedId = editingGroup.value.id
  contactsStore.contacts = contactsStore.contacts.filter(c => c.id !== deletedId)
  if (contactsStore.activeChat?.id === deletedId) {
    contactsStore.activeChat = null
  }
  scheduleSave()
  showToast('已删除')
  emit('deleted')
  emit('close')
}
</script>
