import { useVNStore } from '../stores/vn'
import { generateNovelAI } from './imageGen/novelai'
import { generateNanoBanana } from './imageGen/nanobanana'
import { generateCustom } from './imageGen/custom'
import { imageUrlToBase64 } from '../utils/imageData'

export function useImageGen() {
  const vnStore = useVNStore()

  async function generateImage(prompt, options = {}) {
    const provider = vnStore.imageGenConfig?.provider
    switch (provider) {
      case 'novelai':
        return generateNovelAI(prompt, vnStore.imageGenConfig?.novelai, options)
      case 'nanobanana':
        return generateNanoBanana(prompt, vnStore.imageGenConfig?.nanobanana, options)
      case 'custom':
        return generateCustom(prompt, vnStore.imageGenConfig?.custom, options)
      default:
        throw new Error('未知的图像生成 provider: ' + provider)
    }
  }

  async function generateBackground(name, prompt) {
    const fullPrompt = String(prompt || '').includes('background')
      ? prompt
      : `${prompt}, anime style, detailed background, no characters, 16:9 aspect ratio`

    const url = await generateImage(fullPrompt, { width: 1344, height: 768 })
    vnStore.setResource('backgrounds', name, { url, prompt })
    return url
  }

  async function generateSprite(character, expression, options = {}) {
    const strategy = vnStore.imageGenConfig?.spriteStrategy
    const resourceKey = `${character.contactId}_${expression}`

    const existing = vnStore.getResource('sprites', resourceKey)
    if (existing && !options.force) return existing.url

    let url = null

    if (strategy === 'img2img' && expression !== 'normal') {
      const baseKey = `${character.contactId}_normal`
      const baseSprite = vnStore.getResource('sprites', baseKey)

      if (baseSprite?.url) {
        const editPrompt = vnStore.imageGenConfig?.provider === 'nanobanana'
          ? `Edit this anime character illustration: change the facial expression to "${expression}". Keep the exact same character design, pose, clothing, hairstyle, and art style. Only modify the facial expression.`
          : `${character.spritePrompt || ''}, ${expression} expression, upper body, visual novel character sprite, white background, anime style`

        const base64 = await imageUrlToBase64(baseSprite.url)
        url = await generateImage(editPrompt, {
          baseImage: base64,
          width: 832,
          height: 1216,
          strength: 0.45
        })
      } else {
        await generateSprite(character, 'normal', options)
        return generateSprite(character, expression, options)
      }
    } else {
      const prompt = `${character.spritePrompt || character.vnName}, ${expression} expression, upper body portrait, visual novel character sprite, anime style, white background, clean lineart, high quality`
      url = await generateImage(prompt, { width: 832, height: 1216 })
    }

    vnStore.setResource('sprites', resourceKey, {
      url,
      prompt: `${expression} expression`,
      isBase: expression === 'normal'
    })

    return url
  }

  async function batchGenerate(plan, onProgress) {
    const total = (plan.backgrounds?.length || 0) + (plan.sprites?.length || 0)
    let current = 0

    for (const bg of (plan.backgrounds || [])) {
      onProgress?.(++current, total, `生成背景: ${bg.name}`)
      try {
        await generateBackground(bg.name, bg.prompt)
      } catch (e) {
        console.warn('背景生成失败:', bg.name, e)
      }
    }

    for (const sp of (plan.sprites || [])) {
      const char = vnStore.currentProject?.characters?.find(c => c.contactId === sp.characterId)
      if (!char) continue
      onProgress?.(++current, total, `生成立绘: ${char.vnName} - ${sp.expression}`)
      try {
        await generateSprite(char, sp.expression)
      } catch (e) {
        console.warn('立绘生成失败:', char.vnName, sp.expression, e)
      }
    }
  }

  return {
    generateImage,
    generateBackground,
    generateSprite,
    batchGenerate
  }
}
