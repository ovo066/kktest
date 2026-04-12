<template>
  <div class="absolute inset-0 z-20 bg-[var(--bg-color)] flex flex-col">
    <div class="pt-app-lg pb-2 px-4 flex items-end justify-between">
      <h1 class="text-3xl font-bold text-[var(--text-primary)]">美化</h1>
      <button class="text-[var(--primary-color)] font-semibold text-[17px]" @click="router.push('/')">完成</button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
      <!-- 快捷设置 -->
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">快捷设置</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <!-- 壁纸设置 -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
            @click="wallpaperInput?.click()"
          >
            <div class="flex items-center gap-3">
              <i class="ph-fill ph-image text-xl text-[var(--primary-color)]"></i>
              <span class="text-[17px] text-[var(--text-primary)]">壁纸设置</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="text-[12px] text-[var(--primary-color)] px-1"
                @click.stop="handleWallpaperUrlInput"
              >
                URL
              </button>
              <div
                v-if="settingsStore.wallpaper"
                class="w-8 h-8 rounded-lg bg-cover bg-center border border-gray-200"
                :style="{ backgroundImage: `url(${settingsStore.wallpaper})` }"
              ></div>
              <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
            </div>
          </div>
          <input ref="wallpaperInput" type="file" class="hidden" accept="image/*" @change="handleWallpaperChange">

          <!-- 锁屏壁纸 -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
            @click="lockWallpaperInput?.click()"
          >
            <div class="flex items-center gap-3">
              <i class="ph-fill ph-lock-simple text-xl text-[#5856D6]"></i>
              <span class="text-[17px] text-[var(--text-primary)]">锁屏壁纸</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="text-[12px] text-[var(--primary-color)] px-1"
                @click.stop="handleLockWallpaperUrlInput"
              >
                URL
              </button>
              <div
                v-if="settingsStore.lockScreenWallpaper"
                class="w-8 h-8 rounded-lg bg-cover bg-center border border-gray-200"
                :style="{ backgroundImage: `url(${settingsStore.lockScreenWallpaper})` }"
              ></div>
              <span v-else class="text-[13px] text-[var(--text-secondary)]">跟随桌面</span>
              <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
            </div>
          </div>
          <input ref="lockWallpaperInput" type="file" class="hidden" accept="image/*" @change="handleLockWallpaperChange">

          <!-- 锁屏解锁方式 -->
          <div class="px-4 py-3 border-b border-[var(--border-color)]">
            <div class="flex items-start gap-3">
              <i class="ph-fill ph-hand-swipe-right text-xl text-[#34C759] mt-0.5"></i>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <span class="block text-[17px] text-[var(--text-primary)]">锁屏解锁方式</span>
                    <span class="block text-[12px] text-[var(--text-secondary)] mt-0.5">{{ lockScreenUnlockHintText }}</span>
                  </div>
                  <span class="text-[12px] font-medium text-[var(--primary-color)] whitespace-nowrap">{{ currentLockScreenUnlockLabel }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-3">
                  <button
                    v-for="option in lockScreenUnlockOptions"
                    :key="option.value"
                    class="px-3 py-2 rounded-[12px] text-[13px] font-medium border transition-colors"
                    :class="currentLockScreenUnlockMode === option.value
                      ? 'bg-[var(--primary-color)] text-white border-transparent'
                      : 'bg-transparent text-[var(--text-primary)] border-[var(--border-color)]'"
                    @click="setLockScreenUnlockMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 模拟图片占位图 -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
            @click="mockImageInput?.click()"
          >
            <div class="flex items-center gap-3">
              <i class="ph-fill ph-camera text-xl text-[#8E8E93]"></i>
              <span class="text-[17px] text-[var(--text-primary)]">模拟图片占位图</span>
            </div>
            <div class="flex items-center gap-2">
              <div
                class="w-8 h-8 rounded-lg bg-cover bg-center border border-gray-200"
                :style="{ backgroundImage: `url(${mockImagePlaceholderPreview})` }"
              ></div>
              <button
                v-if="settingsStore.theme.mockImagePlaceholder"
                class="text-[12px] text-red-500 px-1"
                @click.stop="clearMockImagePlaceholder"
              >
                恢复
              </button>
              <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
            </div>
          </div>
          <input ref="mockImageInput" type="file" class="hidden" accept="image/*" @change="handleMockImagePlaceholderChange">

          <!-- 顶部状态栏 -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <div class="flex items-center gap-3">
              <i class="ph-fill ph-device-mobile text-xl text-[#007AFF]"></i>
              <div class="flex flex-col">
                <span class="text-[17px] text-[var(--text-primary)]">小手机状态栏</span>
                <span class="text-[12px] text-[var(--text-secondary)]">{{ statusBarHintText }}</span>
              </div>
            </div>
            <IosToggle
              :model-value="settingsStore.theme.showPhoneStatusBar"
              @update:modelValue="handlePhoneStatusBarToggle"
            />
          </div>

          <!-- 桌面小组件 -->
          <div
            class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
            @click="showWidgetManager = true"
          >
            <div class="flex items-center gap-3">
              <i class="ph-fill ph-squares-four text-xl text-[#FF9500]"></i>
              <span class="text-[17px] text-[var(--text-primary)]">桌面小组件</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[15px] text-[var(--text-secondary)]">{{ widgetsStore.widgets.length }} 个</span>
              <i class="ph ph-caret-right text-[var(--text-secondary)]"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 预设主题 -->
      <CollapsibleSection title="预设主题" :defaultOpen="true">
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="preset in settingsStore.presetThemes"
            :key="preset.id"
            class="flex flex-col items-center p-3 rounded-xl transition-all"
            :class="settingsStore.activeThemeId === `preset_${preset.id}`
              ? 'ring-2 ring-[var(--primary-color)] bg-[var(--card-bg)]'
              : 'bg-[var(--card-bg)]'"
            @click="applyPreset(preset.id)"
          >
            <div
              class="w-full h-12 rounded-lg mb-2 flex items-end justify-center gap-1 p-1"
              :style="{ background: preset.preview.bg }"
            >
              <div class="w-6 h-4 rounded-sm" :style="{ background: preset.preview.aiBubble }"></div>
              <div class="w-8 h-5 rounded-sm" :style="{ background: preset.preview.userBubble }"></div>
            </div>
            <span class="text-[12px] text-[var(--text-primary)] font-medium">{{ preset.name }}</span>
            <i v-if="settingsStore.activeThemeId === `preset_${preset.id}`" class="ph-fill ph-check-circle text-[var(--primary-color)] text-lg mt-1"></i>
          </button>
        </div>
      </CollapsibleSection>

      <!-- 我的主题 -->
      <CollapsibleSection title="我的主题" :defaultOpen="true">
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <button
            class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]"
            @click="showSaveDialog = true"
          >
            <i class="ph ph-plus-circle text-xl"></i>
            <span>保存当前设置为主题</span>
          </button>

          <div v-if="settingsStore.savedThemes.length === 0" class="px-4 py-6 text-center text-[var(--text-secondary)]">
            <i class="ph ph-palette text-3xl mb-2"></i>
            <div class="text-[14px]">还没有保存的主题</div>
            <div class="text-[12px]">调整下方设置后点击上方按钮保存</div>
          </div>

          <div v-else class="divide-y divide-[var(--border-color)]">
            <div
              v-for="theme in settingsStore.savedThemes"
              :key="theme.id"
              class="px-4 py-3 flex items-center gap-3"
              :class="settingsStore.activeThemeId === theme.id ? 'bg-black/5 dark:bg-white/5' : ''"
            >
              <div class="flex gap-1 shrink-0">
                <div class="w-4 h-4 rounded-full border border-white/20" :style="{ background: theme.data.primaryColor || '#007AFF' }"></div>
                <div class="w-4 h-4 rounded-full border border-white/20" :style="{ background: theme.data.bubbleUserBg || '#007AFF' }"></div>
                <div class="w-4 h-4 rounded-full border border-white/20" :style="{ background: theme.data.bubbleAiBg || '#E9E9EB' }"></div>
              </div>
              <div class="flex-1 min-w-0">
                <div v-if="renamingThemeId === theme.id" class="flex items-center gap-2">
                  <input
                    v-model="renameInput"
                    class="flex-1 px-2 py-1 text-[15px] bg-[var(--bg-color)] rounded outline-none text-[var(--text-primary)]"
                    @keyup.enter="confirmRename(theme.id)"
                    @keyup.esc="renamingThemeId = null"
                    ref="renameInputRef"
                  />
                  <button class="text-[var(--primary-color)] text-[13px]" @click="confirmRename(theme.id)">确定</button>
                </div>
                <div v-else class="text-[15px] text-[var(--text-primary)] truncate">{{ theme.name }}</div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button
                  v-if="settingsStore.activeThemeId === theme.id"
                  class="px-2 py-1 text-[12px] text-[var(--primary-color)] border border-[var(--primary-color)] rounded-full"
                  @click="updateCurrentTheme(theme.id)"
                >更新</button>
                <button
                  v-else
                  class="px-2 py-1 text-[12px] text-[var(--primary-color)] border border-[var(--primary-color)] rounded-full"
                  @click="loadTheme(theme.id)"
                >应用</button>
                <button class="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] active:bg-[var(--border-color)] rounded-full" @click="startRename(theme)">
                  <i class="ph ph-pencil-simple text-[16px]"></i>
                </button>
                <button class="w-8 h-8 flex items-center justify-center text-red-500 active:bg-red-50 dark:active:bg-red-900/20 rounded-full" @click="deleteTheme(theme.id)">
                  <i class="ph ph-trash text-[16px]"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 主题导入/导出 -->
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden mt-3">
          <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2 border-b border-[var(--border-color)]" @click="handleExportTheme">
            <i class="ph ph-export text-xl"></i>
            <span>导出主题</span>
          </button>
          <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2" @click="themeImportInput?.click()">
            <i class="ph ph-download text-xl"></i>
            <span>导入主题</span>
          </button>
          <input ref="themeImportInput" type="file" class="hidden" accept="application/json" @change="handleImportTheme">
        </div>
      </CollapsibleSection>

      <!-- 颜色设置 -->
      <CollapsibleSection title="颜色设置">
        <div class="space-y-3">
          <div class="text-[12px] text-[var(--text-secondary)] ml-1">全局颜色</div>
          <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
            <ColorRow label="主色调" v-model="settingsStore.theme.primaryColor" placeholder="#007AFF" @change="applyAndSave" />
            <ColorRow label="背景色" v-model="settingsStore.theme.backgroundColor" placeholder="#F2F2F7" @change="applyAndSave" />
            <ColorRow label="卡片背景" v-model="settingsStore.theme.cardBackground" placeholder="#FFFFFF" @change="applyAndSave" />
            <ColorRow label="主文字色" v-model="settingsStore.theme.textPrimary" placeholder="#000000" @change="applyAndSave" />
            <ColorRow label="次要文字" v-model="settingsStore.theme.textSecondary" placeholder="#8E8E93" @change="applyAndSave" />
            <ColorRow label="边框颜色" v-model="settingsStore.theme.borderColor" placeholder="#E5E5EA" :last="true" @change="applyAndSave" />
          </div>

          <div class="flex items-center justify-between ml-1 mr-1">
            <span class="text-[12px] text-[var(--text-secondary)]">深色模式颜色</span>
            <span class="text-[11px] text-[var(--text-secondary)]">留空使用默认</span>
          </div>
          <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
            <ColorRow label="背景色" v-model="settingsStore.theme.darkBackgroundColor" placeholder="#000000" @change="applyAndSave" />
            <ColorRow label="卡片背景" v-model="settingsStore.theme.darkCardBackground" placeholder="#1C1C1E" @change="applyAndSave" />
            <ColorRow label="主文字色" v-model="settingsStore.theme.darkTextPrimary" placeholder="#FFFFFF" @change="applyAndSave" />
            <ColorRow label="次要文字" v-model="settingsStore.theme.darkTextSecondary" placeholder="#8E8E93" @change="applyAndSave" />
            <ColorRow label="边框颜色" v-model="settingsStore.theme.darkBorderColor" placeholder="#38383A" :last="true" @change="applyAndSave" />
          </div>
        </div>
      </CollapsibleSection>

      <!-- 聊天样式 -->
      <CollapsibleSection title="聊天样式">
        <div class="space-y-3">
          <div class="text-[12px] text-[var(--text-secondary)] ml-1">气泡样式</div>
          <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
            <ColorRow label="用户气泡背景" v-model="settingsStore.theme.bubbleUserBg" placeholder="#007AFF" @change="applyAndSave" />
            <ColorRow label="用户气泡文字" v-model="settingsStore.theme.bubbleUserText" placeholder="#FFFFFF" @change="applyAndSave" />
            <ColorRow label="AI气泡背景" v-model="settingsStore.theme.bubbleAiBg" placeholder="#E9E9EB" @change="applyAndSave" />
            <ColorRow label="AI气泡文字" v-model="settingsStore.theme.bubbleAiText" placeholder="#000000" @change="applyAndSave" />
            <TextRow label="气泡圆角" v-model="settingsStore.theme.bubbleRadius" placeholder="18px" @change="applyAndSave" />
            <TextRow label="气泡阴影" v-model="settingsStore.theme.bubbleShadow" placeholder="0 2px 8px rgba(0,0,0,0.1)" @change="applyAndSave" />
            <TextRow label="气泡边框" v-model="settingsStore.theme.bubbleBorder" placeholder="1px solid #ddd" :last="true" @change="applyAndSave" />
          </div>

          <div class="text-[12px] text-[var(--text-secondary)] ml-1">导航栏</div>
          <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
            <TextRow label="背景" v-model="settingsStore.theme.navbarBg" placeholder="rgba(255,255,255,0.8)" @change="applyAndSave" />
            <TextRow label="模糊程度" v-model="settingsStore.theme.navbarBlur" placeholder="20px" @change="applyAndSave" />
            <TextRow label="底部边框" v-model="settingsStore.theme.navbarBorder" placeholder="rgba(0,0,0,0.1)" :last="true" @change="applyAndSave" />
          </div>

          <div class="text-[12px] text-[var(--text-secondary)] ml-1">输入框 & 按钮</div>
          <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
            <ColorRow label="输入框背景" v-model="settingsStore.theme.inputBg" placeholder="#FFFFFF" @change="applyAndSave" />
            <ColorRow label="输入框边框" v-model="settingsStore.theme.inputBorder" placeholder="#E5E5EA" @change="applyAndSave" />
            <TextRow label="输入框圆角" v-model="settingsStore.theme.inputRadius" placeholder="20px" @change="applyAndSave" />
            <TextRow label="按钮圆角" v-model="settingsStore.theme.buttonRadius" placeholder="10px" :last="true" @change="applyAndSave" />
          </div>
        </div>
      </CollapsibleSection>

      <!-- 字体设置 -->
      <CollapsibleSection title="字体设置">
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <TextRow label="字体名称" v-model="settingsStore.theme.fontFamily" placeholder="system-ui, sans-serif" @change="applyAndSave" />
          <TextRow label="字体导入URL" v-model="settingsStore.theme.fontImport" placeholder="https://fonts.googleapis.com/... 或 https://example.com/font.woff2" @change="applyAndSave" />
          <TextRow label="基础字号" v-model="settingsStore.theme.fontSize" placeholder="16px" @change="applyAndSave" />
          <TextRow label="全局圆角" v-model="settingsStore.theme.globalRadius" placeholder="10px" :last="true" @change="applyAndSave" />
        </div>
      </CollapsibleSection>

      <!-- 桌面图标 -->
      <CollapsibleSection title="桌面图标">
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden p-4">
          <div class="grid grid-cols-3 gap-4">
            <div v-for="app in appList" :key="app.key" class="flex flex-col items-center gap-2">
              <div
                class="w-14 h-14 rounded-[12px] flex items-center justify-center cursor-pointer active:scale-95 transition-transform overflow-hidden relative shadow-md"
                :style="getIconStyle(app)"
                @click="triggerIconUpload(app.key)"
              >
                <img v-if="settingsStore.theme.appIcons?.[app.key]" :src="settingsStore.theme.appIcons[app.key]" class="w-full h-full object-cover">
                <i v-else :class="app.icon" class="text-2xl text-white"></i>
                <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <i class="ph ph-camera text-white text-lg"></i>
                </div>
              </div>
              <span class="text-[11px] text-[var(--text-secondary)]">{{ app.label }}</span>
              <div class="flex items-center gap-2">
                <button class="text-[11px] text-[var(--primary-color)]" @click="handleIconUrlInput(app.key)">URL</button>
                <button v-if="settingsStore.theme.appIcons?.[app.key]" class="text-[11px] text-red-500" @click="clearIcon(app.key)">恢复</button>
              </div>
            </div>
          </div>
          <input ref="iconInput" type="file" class="hidden" accept="image/*" @change="handleIconChange">
        </div>
      </CollapsibleSection>

      <!-- 自定义 CSS (高级) -->
      <CollapsibleSection title="自定义 CSS" subtitle="高级">
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden p-4">
          <textarea
            v-model="settingsStore.theme.customCSS"
            class="w-full h-56 text-[13px] font-mono bg-[var(--bg-color)] rounded-lg p-3 outline-none resize-none text-[var(--text-primary)] leading-relaxed"
            :placeholder="cssPlaceholder"
            @change="applyAndSave"
          ></textarea>
        </div>

        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden mt-3">
          <div class="px-4 py-3 border-b border-[var(--border-color)]">
            <div class="text-[15px] text-[var(--text-primary)] font-medium mb-2">CSS 变量</div>
            <div class="text-[12px] text-[var(--text-secondary)] font-mono bg-[var(--bg-color)] rounded p-2 space-y-1 overflow-x-auto">
              <div>--primary-color, --bg-color, --card-bg</div>
              <div>--text-primary, --text-secondary, --border-color</div>
              <div>--bubble-user-bg, --bubble-ai-bg, --bubble-radius</div>
              <div>--bubble-tail-display, --chat-bg, --avatar-bg</div>
              <div>--badge-bg, --badge-text, --meta-color</div>
            </div>
          </div>
          <button class="w-full px-4 py-3 text-[var(--primary-color)] flex items-center justify-center gap-2" @click="downloadThemeReference">
            <i class="ph ph-file-text text-xl"></i>
            <span>下载完整选择器参考文档</span>
          </button>
        </div>
      </CollapsibleSection>

      <!-- 重置选项 -->
      <div class="space-y-2">
        <span class="text-[13px] text-[var(--text-secondary)] uppercase ml-4">重置选项</span>
        <div class="bg-[var(--card-bg)] rounded-[10px] overflow-hidden">
          <button class="w-full px-4 py-3 text-red-500 border-b border-[var(--border-color)]" @click="handleResetTheme">
            重置主题样式
          </button>
          <button class="w-full px-4 py-3 text-red-500 border-b border-[var(--border-color)]" @click="handleResetIcons">
            重置桌面图标
          </button>
          <button class="w-full px-4 py-3 text-red-500 border-b border-[var(--border-color)]" @click="handleClearWallpaper">
            清除壁纸
          </button>
          <button class="w-full px-4 py-3 text-red-500" @click="handleClearLockWallpaper">
            清除锁屏壁纸
          </button>
        </div>
      </div>

      <div class="h-8"></div>
    </div>

    <!-- 保存主题对话框 -->
    <div
      v-if="showSaveDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="showSaveDialog = false"
    >
      <div class="bg-[var(--card-bg)] rounded-2xl w-[280px] overflow-hidden">
        <div class="px-4 pt-5 pb-3 text-center">
          <div class="text-[17px] font-semibold text-[var(--text-primary)] mb-1">保存主题</div>
          <div class="text-[13px] text-[var(--text-secondary)] mb-4">为当前主题设置命名</div>
          <input
            v-model="newThemeName"
            class="w-full px-3 py-2 text-[15px] bg-[var(--bg-color)] rounded-lg outline-none text-[var(--text-primary)] text-center"
            placeholder="输入主题名称"
            @keyup.enter="saveNewTheme"
            ref="saveDialogInput"
          />
        </div>
        <div class="flex border-t border-[var(--border-color)]">
          <button class="flex-1 py-3 text-[17px] text-[var(--primary-color)] border-r border-[var(--border-color)]" @click="showSaveDialog = false">取消</button>
          <button class="flex-1 py-3 text-[17px] text-[var(--primary-color)] font-semibold" @click="saveNewTheme">保存</button>
        </div>
      </div>
    </div>

    <!-- 小组件管理器 -->
    <WidgetManager
      v-if="showWidgetManager"
      @close="showWidgetManager = false"
    />
  </div>
</template>

<script setup>
import { ref, h, nextTick, watch, defineComponent, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { useWidgetsStore } from '../stores/widgets'
import { useStorage } from '../composables/useStorage'
import { useToast } from '../composables/useToast'
import { compressImage } from '../composables/useImage'
import { showConfirm } from '../composables/useConfirm'
import { resolveMockImagePlaceholder } from '../features/chat'
import { DESKTOP_APPS } from '../data/homeApps'
import { downloadBlob } from '../utils/download'
import { normalizeImageUrlInput } from '../utils/mediaUrl'
import WidgetManager from '../components/widgets/WidgetManager.vue'
import IosToggle from '../components/common/IosToggle.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const widgetsStore = useWidgetsStore()
const { scheduleSave } = useStorage()
const { showToast } = useToast()

const iconInput = ref(null)
const wallpaperInput = ref(null)
const lockWallpaperInput = ref(null)
const mockImageInput = ref(null)
const themeImportInput = ref(null)
const currentIconKey = ref(null)
const showWidgetManager = ref(false)

const showSaveDialog = ref(false)
const newThemeName = ref('')
const saveDialogInput = ref(null)

const renamingThemeId = ref(null)
const renameInput = ref('')
const renameInputRef = ref(null)
const mockImagePlaceholderPreview = computed(() => resolveMockImagePlaceholder(settingsStore.theme.mockImagePlaceholder))
const lockScreenUnlockOptions = [
  { value: 'swipe', label: '滑动解锁' },
  { value: 'tap', label: '点击解锁' }
]

const currentLockScreenUnlockMode = computed(() => {
  const mode = String(settingsStore.theme.lockScreenUnlockMode || '').trim()
  return ['swipe', 'tap'].includes(mode) ? mode : 'swipe'
})

const currentLockScreenUnlockLabel = computed(() => {
  const current = lockScreenUnlockOptions.find(option => option.value === currentLockScreenUnlockMode.value)
  return current?.label || '滑动解锁'
})

const lockScreenUnlockHintText = computed(() => {
  return currentLockScreenUnlockMode.value === 'tap'
    ? '点按锁屏任意区域即可解锁'
    : '从底部向上滑动以解锁'
})

watch(showSaveDialog, (show) => {
  if (show) {
    newThemeName.value = ''
    nextTick(() => saveDialogInput.value?.focus())
  }
})

// 可折叠区块组件
const CollapsibleSection = defineComponent({
  name: 'CollapsibleSection',
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    defaultOpen: { type: Boolean, default: false }
  },
  setup(props, { slots }) {
    const isOpen = ref(props.defaultOpen)
    return () => h('div', { class: 'space-y-2' }, [
      h('button', {
        class: 'flex items-center justify-between w-full text-left ml-4 mr-4',
        onClick: () => { isOpen.value = !isOpen.value }
      }, [
        h('div', { class: 'flex items-center gap-2' }, [
          h('span', { class: 'text-[13px] text-[var(--text-secondary)] uppercase' }, props.title),
          props.subtitle ? h('span', { class: 'text-[11px] text-[var(--text-secondary)] bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded' }, props.subtitle) : null
        ]),
        h('i', { class: `ph ph-caret-${isOpen.value ? 'up' : 'down'} text-[var(--text-secondary)] mr-4` })
      ]),
      isOpen.value ? slots.default?.() : null
    ])
  }
})

// 颜色输入行组件
const ColorRow = (props, { emit }) => {
  return h('div', {
    class: `flex items-center px-4 py-3 ${props.last ? '' : 'border-b border-[var(--border-color)]'}`
  }, [
    h('span', { class: 'flex-1 text-[17px] text-[var(--text-primary)]' }, props.label),
    h('input', {
      type: 'color',
      value: props.modelValue || '#000000',
      class: 'w-8 h-8 rounded cursor-pointer',
      onInput: (e) => emit('update:modelValue', e.target.value),
      onChange: () => emit('change')
    }),
    h('input', {
      type: 'text',
      value: props.modelValue,
      placeholder: props.placeholder,
      class: 'w-24 ml-2 text-right text-[15px] bg-transparent text-[var(--text-primary)] outline-none',
      onInput: (e) => emit('update:modelValue', e.target.value),
      onChange: () => emit('change')
    })
  ])
}
ColorRow.props = ['label', 'modelValue', 'placeholder', 'last']
ColorRow.emits = ['update:modelValue', 'change']

// 文本输入行组件
const TextRow = (props, { emit }) => {
  return h('div', {
    class: `flex items-center px-4 py-3 ${props.last ? '' : 'border-b border-[var(--border-color)]'}`
  }, [
    h('span', { class: 'w-28 shrink-0 text-[17px] text-[var(--text-primary)]' }, props.label),
    h('input', {
      type: 'text',
      value: props.modelValue,
      placeholder: props.placeholder,
      class: 'flex-1 min-w-0 text-right text-[15px] bg-transparent text-[var(--text-primary)] outline-none',
      onInput: (e) => emit('update:modelValue', e.target.value),
      onChange: () => emit('change')
    })
  ])
}
TextRow.props = ['label', 'modelValue', 'placeholder', 'last']
TextRow.emits = ['update:modelValue', 'change']

const appList = DESKTOP_APPS

const cssPlaceholder = `/* 示例 */
.bubble-user {
  background: #95EC69 !important;
  border-radius: 4px !important;
}`

function getIconStyle(app) {
  if (settingsStore.theme.appIcons?.[app.key]) return undefined
  return { background: app.previewBackground }
}

function triggerIconUpload(key) {
  currentIconKey.value = key
  iconInput.value?.click()
}

function promptImageUrl(message, currentValue = '') {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null
  return window.prompt(message, currentValue || '')
}

function clearAppIconRef(key) {
  if (!settingsStore.theme.appIconRefs || typeof settingsStore.theme.appIconRefs !== 'object') return
  if (settingsStore.theme.appIconRefs[key]) {
    delete settingsStore.theme.appIconRefs[key]
  }
  if (Object.keys(settingsStore.theme.appIconRefs).length === 0) {
    delete settingsStore.theme.appIconRefs
  }
}

function handleWallpaperUrlInput() {
  const raw = promptImageUrl('请输入壁纸图床 URL（支持 http/https）', settingsStore.wallpaper || '')
  if (raw === null) return
  const url = normalizeImageUrlInput(raw)
  if (url === null) {
    showToast('请输入有效的图片 URL')
    return
  }
  settingsStore.wallpaper = url || null
  settingsStore.wallpaperRef = ''
  scheduleSave()
  showToast(url ? '壁纸 URL 已设置' : '壁纸已清除')
}

function handleLockWallpaperUrlInput() {
  const raw = promptImageUrl('请输入锁屏壁纸图床 URL（支持 http/https）', settingsStore.lockScreenWallpaper || '')
  if (raw === null) return
  const url = normalizeImageUrlInput(raw)
  if (url === null) {
    showToast('请输入有效的图片 URL')
    return
  }
  settingsStore.lockScreenWallpaper = url || null
  settingsStore.lockScreenWallpaperRef = ''
  scheduleSave()
  showToast(url ? '锁屏壁纸 URL 已设置' : '锁屏壁纸已清除')
}

function handleIconUrlInput(key) {
  const current = settingsStore.theme.appIcons?.[key] || ''
  const raw = promptImageUrl('请输入图标图床 URL（支持 http/https）', current)
  if (raw === null) return
  const url = normalizeImageUrlInput(raw)
  if (url === null) {
    showToast('请输入有效的图片 URL')
    return
  }
  if (!settingsStore.theme.appIcons || typeof settingsStore.theme.appIcons !== 'object') {
    settingsStore.theme.appIcons = {}
  }
  settingsStore.theme.appIcons[key] = url || null
  clearAppIconRef(key)
  scheduleSave()
  showToast(url ? '图标 URL 已设置' : '已恢复默认')
}

async function handleIconChange(e) {
  const file = e.target.files?.[0]
  if (file && currentIconKey.value) {
    const b64 = await compressImage(file, 120)
    if (!settingsStore.theme.appIcons) settingsStore.theme.appIcons = {}
    settingsStore.theme.appIcons[currentIconKey.value] = b64
    scheduleSave()
    showToast('图标已更换')
  }
  e.target.value = ''
  currentIconKey.value = null
}

async function handleWallpaperChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    const b64 = await compressImage(file, 800)
    settingsStore.wallpaper = b64
    scheduleSave()
    showToast('壁纸已更换')
  }
  e.target.value = ''
}

async function handleLockWallpaperChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    const b64 = await compressImage(file, 800)
    settingsStore.lockScreenWallpaper = b64
    scheduleSave()
    showToast('锁屏壁纸已更换')
  }
  e.target.value = ''
}

async function handleMockImagePlaceholderChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    const b64 = await compressImage(file, 960, 0.9)
    settingsStore.theme.mockImagePlaceholder = b64
    scheduleSave()
    showToast('模拟图片占位图已更新')
  }
  e.target.value = ''
}

function clearMockImagePlaceholder() {
  settingsStore.theme.mockImagePlaceholder = ''
  scheduleSave()
  showToast('已恢复默认占位图')
}

function clearIcon(key) {
  if (settingsStore.theme.appIcons) {
    settingsStore.theme.appIcons[key] = null
    clearAppIconRef(key)
    scheduleSave()
    showToast('已恢复默认')
  }
}

function setLockScreenUnlockMode(mode) {
  settingsStore.theme.lockScreenUnlockMode = mode
  applyAndSave()
  showToast(`已切换为${lockScreenUnlockOptions.find(option => option.value === mode)?.label || '滑动解锁'}`)
}

function applyAndSave() {
  settingsStore.applyTheme()
  scheduleSave()
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isAndroidDevice() {
  return /Android/i.test(navigator.userAgent || '')
}

const statusBarHintText = computed(() => {
  if (isIOSDevice()) {
    return 'iOS 使用系统状态栏'
  }
  return '安卓默认全屏，用小状态栏'
})

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null
}

async function requestRootFullscreen() {
  const el = document.documentElement
  if (el.requestFullscreen) return el.requestFullscreen()
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen()
  if (el.msRequestFullscreen) return el.msRequestFullscreen()
  return Promise.resolve()
}

async function exitRootFullscreen() {
  if (document.exitFullscreen) return document.exitFullscreen()
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen()
  if (document.msExitFullscreen) return document.msExitFullscreen()
  return Promise.resolve()
}

async function syncAndroidStatusBarMode(showPhoneStatusBar) {
  if (!isAndroidDevice()) return
  try {
    if (showPhoneStatusBar) {
      if (!getFullscreenElement()) await requestRootFullscreen()
      return
    }
    if (getFullscreenElement()) await exitRootFullscreen()
  } catch {
    // Some Android browsers require strict user activation timing.
  }
}

async function handlePhoneStatusBarToggle(nextValue) {
  settingsStore.theme.showPhoneStatusBar = !!nextValue
  applyAndSave()
  if (isIOSDevice()) {
    showToast('iOS 已改为系统状态栏 + 安全区，占位不会显示小手机状态栏')
  }
  await syncAndroidStatusBarMode(settingsStore.theme.showPhoneStatusBar)
}

function saveNewTheme() {
  const name = newThemeName.value.trim()
  if (!name) {
    showToast('请输入主题名称')
    return
  }
  settingsStore.saveThemeAs(name)
  scheduleSave()
  showSaveDialog.value = false
  showToast('主题已保存')
}

function loadTheme(id) {
  if (settingsStore.loadSavedTheme(id)) {
    scheduleSave()
    showToast('已应用主题')
  }
}

function applyPreset(presetId) {
  if (settingsStore.applyPresetTheme(presetId)) {
    scheduleSave()
    showToast('已应用预设主题')
  }
}

function updateCurrentTheme(id) {
  settingsStore.updateSavedTheme(id)
  scheduleSave()
  showToast('主题已更新')
}

async function deleteTheme(id) {
  const confirmed = await showConfirm({ message: '确定删除此主题?', destructive: true })
  if (!confirmed) return
  settingsStore.deleteSavedTheme(id)
  scheduleSave()
  showToast('已删除')
}

function startRename(theme) {
  renamingThemeId.value = theme.id
  renameInput.value = theme.name
  nextTick(() => renameInputRef.value?.focus())
}

function confirmRename(id) {
  const name = renameInput.value.trim()
  if (!name) {
    showToast('名称不能为空')
    return
  }
  settingsStore.renameSavedTheme(id, name)
  scheduleSave()
  renamingThemeId.value = null
  showToast('已重命名')
}

function handleExportTheme() {
  const themeData = settingsStore.exportTheme()
  const json = JSON.stringify(themeData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `theme-${Date.now()}.json`)
  showToast('主题已导出')
}

async function handleImportTheme(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const themeData = JSON.parse(text)
    settingsStore.importTheme(themeData)
    applyAndSave()
    showToast('主题已导入')
  } catch {
    showToast('导入失败：无效的主题文件')
  }
  e.target.value = ''
}

async function downloadThemeReference() {
  try {
    const response = await fetch('/theme-reference.md')
    const text = await response.text()
    const blob = new Blob([text], { type: 'text/markdown' })
    downloadBlob(blob, 'theme-reference.md')
    showToast('已下载')
  } catch {
    showToast('下载失败')
  }
}

async function handleResetTheme() {
  const confirmed = await showConfirm({ message: '确定重置所有主题样式?', destructive: true })
  if (!confirmed) return
  settingsStore.resetTheme()
  applyAndSave()
  showToast('已重置')
}

async function handleResetIcons() {
  const confirmed = await showConfirm({ message: '确定重置所有桌面图标?', destructive: true })
  if (!confirmed) return
  settingsStore.resetAppIcons()
  scheduleSave()
  showToast('已重置')
}

async function handleClearWallpaper() {
  const confirmed = await showConfirm({ message: '确定清除壁纸?', destructive: true })
  if (!confirmed) return
  settingsStore.wallpaper = null
  settingsStore.wallpaperRef = ''
  scheduleSave()
  showToast('壁纸已清除')
}

async function handleClearLockWallpaper() {
  const confirmed = await showConfirm({ message: '确定清除锁屏壁纸？清除后将跟随桌面壁纸', destructive: true })
  if (!confirmed) return
  settingsStore.lockScreenWallpaper = null
  settingsStore.lockScreenWallpaperRef = ''
  scheduleSave()
  showToast('锁屏壁纸已清除')
}
</script>
