import { defineStore } from 'pinia'
import { reactive } from 'vue'

export const useWidgetsStore = defineStore('widgets', () => {
  const widgets = reactive([])

  function generateId() {
    return 'widget_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  }

  function addWidget(type, config = {}) {
    const defaultConfigs = {
      clock: { style: 'digital', showSeconds: false, showDate: true },
      weather: { city: '北京', temp: '25', condition: 'sunny', unit: 'celsius' },
      image: { src: '', caption: '', rotation: 0, tape: true, tapeColor: '#ffc0cb' },
      todo: { title: 'TODO', items: [], bgColor: '#fffdf0', tapeColor: '#90EE90' },
      quote: { text: '生活不止眼前的苟且，还有诗和远方。', author: '', fontStyle: 'normal' },
      calendar: { showFullMonth: false, highlightToday: true },
      battery: {},
      music: { title: '', artist: '' },
      stats: { statType: 'chat_count' },
      shortcuts: { apps: [
        { label: '消息', route: '/messages', icon: 'ph-fill ph-chat-circle-dots', bg: '#E3F2FD' },
        { label: '设置', route: '/settings', icon: 'ph-fill ph-gear', bg: '#FFF3E0' }
      ]}
    }

    const defaultSizes = {
      clock: '2x1',
      weather: '2x1',
      image: '2x2',
      todo: '2x2',
      quote: '4x2',
      calendar: '2x1',
      battery: '2x1',
      music: '2x2',
      stats: '2x1',
      shortcuts: '2x2'
    }

    const widget = {
      id: generateId(),
      type,
      size: defaultSizes[type] || '2x2',
      position: widgets.length,
      enabled: true,
      config: { ...defaultConfigs[type], ...config }
    }

    widgets.push(widget)
    return widget
  }

  function updateWidget(id, updates) {
    const index = widgets.findIndex(w => w.id === id)
    if (index !== -1) {
      Object.assign(widgets[index], updates)
    }
  }

  function updateWidgetConfig(id, configUpdates) {
    const widget = widgets.find(w => w.id === id)
    if (widget) {
      Object.assign(widget.config, configUpdates)
    }
  }

  function removeWidget(id) {
    const index = widgets.findIndex(w => w.id === id)
    if (index !== -1) {
      widgets.splice(index, 1)
      // Update positions
      widgets.forEach((w, i) => {
        w.position = i
      })
    }
  }

  function moveWidget(id, newPosition) {
    const index = widgets.findIndex(w => w.id === id)
    if (index !== -1 && newPosition >= 0 && newPosition < widgets.length) {
      const [widget] = widgets.splice(index, 1)
      widgets.splice(newPosition, 0, widget)
      // Update positions
      widgets.forEach((w, i) => {
        w.position = i
      })
    }
  }

  function toggleWidget(id) {
    const widget = widgets.find(w => w.id === id)
    if (widget) {
      widget.enabled = !widget.enabled
    }
  }

  function getEnabledWidgets() {
    return widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position)
  }

  function setWidgets(newWidgets) {
    widgets.splice(0, widgets.length, ...newWidgets)
  }

  return {
    widgets,
    addWidget,
    updateWidget,
    updateWidgetConfig,
    removeWidget,
    moveWidget,
    toggleWidget,
    getEnabledWidgets,
    setWidgets
  }
})
