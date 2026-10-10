import { isInTauri } from '@nyanpasu/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unwrapResult } from '../utils'
import { commands } from './bindings'

export type { BackupInfo } from './bindings'

export const BACKUPS_QUERY_KEY = 'application-backups'

export const useBackups = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [BACKUPS_QUERY_KEY],
    enabled: isInTauri(),
    queryFn: async () => unwrapResult(await commands.listBackups()),
  })

  const create = useMutation({
    mutationFn: async () => unwrapResult(await commands.createManualBackup()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [BACKUPS_QUERY_KEY] })
    },
  })

  const verify = useMutation({
    mutationFn: async (name: string) =>
      unwrapResult(await commands.verifyBackup(name)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [BACKUPS_QUERY_KEY] })
    },
  })

  const openDirectory = useMutation({
    mutationFn: async () => unwrapResult(await commands.openBackupDirectory()),
  })

  return { query, create, verify, openDirectory }
}
