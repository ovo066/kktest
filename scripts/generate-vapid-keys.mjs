import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey)
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey)
console.log('VAPID_SUBJECT=mailto:you@example.com')
console.log('PUSH_SERVER_TOKEN=replace-with-a-long-random-string')

