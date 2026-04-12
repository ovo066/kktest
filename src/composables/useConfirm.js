/**
 * iOS 风格确认对话框 composable
 */
import { ref } from 'vue'

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmText = ref('确定')
const cancelText = ref('取消')
const destructive = ref(false)
let resolvePromise = null

/**
 * 显示确认对话框
 * @param {Object} options - 配置选项
 * @param {string} options.message - 提示消息
 * @param {string} options.title - 标题（可选）
 * @param {string} options.confirmText - 确认按钮文字（默认"确定"）
 * @param {string} options.cancelText - 取消按钮文字（默认"取消"）
 * @param {boolean} options.destructive - 是否为危险操作（红色按钮）
 * @returns {Promise<boolean>} 用户选择结果
 */
export function showConfirm(options) {
  const opts = typeof options === 'string' ? { message: options } : options

  confirmTitle.value = opts.title || ''
  confirmMessage.value = opts.message || '确定执行此操作？'
  confirmText.value = opts.confirmText || '确定'
  cancelText.value = opts.cancelText || '取消'
  destructive.value = opts.destructive || false
  confirmVisible.value = true

  return new Promise(resolve => {
    resolvePromise = resolve
  })
}

function handleConfirm() {
  confirmVisible.value = false
  if (resolvePromise) {
    resolvePromise(true)
    resolvePromise = null
  }
}

function handleCancel() {
  confirmVisible.value = false
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
}

export function useConfirm() {
  return {
    confirmVisible,
    confirmTitle,
    confirmMessage,
    confirmText,
    cancelText,
    destructive,
    showConfirm,
    handleConfirm,
    handleCancel
  }
}
