// Shared gift catalog for chat rendering and AI prompt injection.

let _customGiftSource = null

export function registerCustomGiftSource(fn) {
  _customGiftSource = fn
}

function getCustomGifts() {
  return typeof _customGiftSource === 'function' ? (_customGiftSource() || []) : []
}

export const GIFT_CATEGORIES = [
  { id: 'coffee', name: '咖啡饮品', icon: 'ph-coffee' },
  { id: 'food', name: '美食餐饮', icon: 'ph-hamburger' },
  { id: 'dessert', name: '甜品蛋糕', icon: 'ph-cake' },
  { id: 'entertainment', name: '影音娱乐', icon: 'ph-film-strip' },
  { id: 'classic', name: '经典礼物', icon: 'ph-gift' }
]

export const GIFTS = [
  // 咖啡饮品
  { id: 'starbucks-latte', name: '星巴克拿铁', category: 'coffee', price: 38, description: '一杯经典大杯拿铁', aliases: ['星巴克', '拿铁', 'Starbucks'] },
  { id: 'starbucks-frappuccino', name: '星冰乐', category: 'coffee', price: 42, description: '冰爽星冰乐，夏日必备', aliases: ['星冰乐'] },
  { id: 'luckin-coffee', name: '瑞幸生椰拿铁', category: 'coffee', price: 18, description: '超人气生椰拿铁', aliases: ['瑞幸', '生椰拿铁'] },
  { id: 'milk-tea', name: '喜茶多肉葡萄', category: 'coffee', price: 29, description: '满杯鲜果水果茶', aliases: ['喜茶', '奶茶'] },
  // 美食餐饮
  { id: 'kfc-bucket', name: 'KFC全家桶', category: 'food', price: 89, description: '经典全家桶，分享快乐', aliases: ['KFC', '肯德基', '全家桶'] },
  { id: 'mcdonalds-meal', name: '麦当劳套餐', category: 'food', price: 39, description: '巨无霸套餐，经典美味', aliases: ['麦当劳', 'McDonalds'] },
  { id: 'pizza-hut', name: '必胜客披萨', category: 'food', price: 99, description: '9寸超级至尊披萨', aliases: ['必胜客', '披萨'] },
  { id: 'haidilao', name: '海底捞代金券', category: 'food', price: 200, description: '海底捞200元代金券', aliases: ['海底捞', '火锅'] },
  // 甜品蛋糕
  { id: 'cake', name: '生日蛋糕', category: 'dessert', price: 168, description: '精美双层生日蛋糕', aliases: ['蛋糕', '生日蛋糕'] },
  { id: 'macarons', name: '马卡龙礼盒', category: 'dessert', price: 128, description: '法式马卡龙12枚精美礼盒', aliases: ['马卡龙'] },
  { id: 'chocolate', name: 'Godiva巧克力', category: 'dessert', price: 199, description: '经典松露巧克力礼盒', aliases: ['巧克力', 'Godiva'] },
  { id: 'ice-cream', name: '哈根达斯', category: 'dessert', price: 88, description: '经典迷你杯4支装', aliases: ['哈根达斯', '冰淇淋'] },
  // 影音娱乐
  { id: 'netflix', name: 'Netflix会员', category: 'entertainment', price: 89, description: '一个月标准会员', aliases: ['Netflix', '奈飞'] },
  { id: 'spotify', name: 'Spotify会员', category: 'entertainment', price: 35, description: '一个月个人会员', aliases: ['Spotify'] },
  { id: 'movie-ticket', name: '电影票', category: 'entertainment', price: 45, description: '全国通用电影兑换券', aliases: ['电影票', '电影'] },
  { id: 'game-card', name: 'Steam充值卡', category: 'entertainment', price: 100, description: 'Steam平台100元充值卡', aliases: ['Steam', '游戏充值'] },
  // 经典礼物
  { id: 'rose', name: '玫瑰花束', category: 'classic', price: 99, description: '11朵红玫瑰花束', aliases: ['玫瑰', '玫瑰花'] },
  { id: 'ring', name: '戒指', category: 'classic', price: 520, description: '精美银饰戒指', aliases: ['戒指', '钻戒'] },
  { id: 'perfume', name: '香水', category: 'classic', price: 299, description: '品牌香水小样套装', aliases: ['香水'] },
  { id: 'bouquet', name: '花束', category: 'classic', price: 188, description: '混搭鲜花精美包装', aliases: ['花束', '鲜花'] },
  { id: 'bear', name: '小熊玩偶', category: 'classic', price: 68, description: '毛绒泰迪熊玩偶', aliases: ['小熊', '泰迪熊', '熊'] },
  { id: 'wine', name: '红酒', category: 'classic', price: 258, description: '法国进口干红葡萄酒', aliases: ['红酒', '葡萄酒', '酒'] },
  { id: 'crown', name: '皇冠', category: 'classic', price: 66, description: '闪耀皇冠头饰', aliases: ['皇冠', '王冠'] },
  { id: 'star', name: '星星', category: 'classic', price: 9.9, description: '一颗闪亮的星', aliases: ['星星', '星'] }
]

export function getGiftData(itemName) {
  const name = String(itemName ?? '').trim()
  if (!name) return null
  const lower = name.toLowerCase()
  // Check custom gifts first (user-defined take priority)
  const custom = getCustomGifts().find(g => g.name === name || g.id === lower)
  if (custom) return custom
  const gift = GIFTS.find(g =>
    g.name === name || g.id === lower || g.aliases.some(a => a === name)
  )
  return gift || null
}

export function getGiftImageUrl(itemName) {
  const gift = getGiftData(itemName)
  if (!gift) return null
  // Custom gifts store image as base64/dataURL directly
  if (gift.image) return gift.image
  return `/gifts/${gift.id}.svg`
}

export function getGiftPrice(itemName) {
  const gift = getGiftData(itemName)
  return gift?.price ?? null
}

export function createGiftSnapshot(itemName) {
  const gift = getGiftData(itemName)
  if (!gift) return null

  return {
    id: String(gift.id || '').trim(),
    name: String(gift.name || '').trim(),
    description: String(gift.description || ''),
    price: gift.price ?? null,
    image: gift.image || `/gifts/${gift.id}.svg`,
    category: String(gift.category || '').trim() || null
  }
}

export function getAllGifts() {
  return [...GIFTS, ...getCustomGifts()]
}

export function getGiftsByCategory(categoryId) {
  const all = getAllGifts()
  if (!categoryId || categoryId === 'all') return all
  return all.filter(g => g.category === categoryId)
}
