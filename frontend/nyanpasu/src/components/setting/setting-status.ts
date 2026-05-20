export const getOnOffLabel = (enabled: boolean) =>
  enabled ? '已开启' : '已关闭'

export const getTakeoverLabel = (active: boolean) =>
  active ? '接管中' : '未接管'

export const getSyncStatusLabel = (synced: boolean) =>
  synced ? '已同步' : '同步中'

export const getAvailabilityLabel = (available: boolean) =>
  available ? '可用' : '不可用'
