export function defineProxy(target, key, source, sourceKey = key) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      return source[sourceKey]
    },
    set(value) {
      source[sourceKey] = value
    }
  })
}

export function defineProxyMap(target, source, keys) {
  keys.forEach((key) => defineProxy(target, key, source, key))
}

export function defineAliasedProxyMap(target, source, fieldMap) {
  Object.entries(fieldMap).forEach(([alias, key]) => defineProxy(target, alias, source, key))
}
