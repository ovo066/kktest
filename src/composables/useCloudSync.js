import { useCloudSyncStore } from '../stores/cloudSync'
import {
  bootstrapCloudSync,
  linkCloudSyncWithGoogle,
  notifyCloudSyncLocalSave,
  pullCloudSyncNow,
  pushCloudSyncNow,
  reconnectCloudSync
} from './cloudSync/manager'

export function useCloudSync(storageApi = null) {
  const cloudSyncStore = useCloudSyncStore()

  return {
    cloudSyncStore,
    bootstrapCloudSync: (options = {}) => bootstrapCloudSync({ ...options, storageApi: options.storageApi || storageApi }),
    notifyCloudSyncLocalSave: (options = {}) => notifyCloudSyncLocalSave({ ...options, storageApi: options.storageApi || storageApi }),
    pushCloudSyncNow: (options = {}) => pushCloudSyncNow({ ...options, storageApi: options.storageApi || storageApi }),
    pullCloudSyncNow: (options = {}) => pullCloudSyncNow({ ...options, storageApi: options.storageApi || storageApi }),
    linkCloudSyncWithGoogle: (options = {}) => linkCloudSyncWithGoogle({ ...options, storageApi: options.storageApi || storageApi }),
    reconnectCloudSync: (options = {}) => reconnectCloudSync({ ...options, storageApi: options.storageApi || storageApi })
  }
}
