// These interfaces have empty (unused) __${type}SpaceResource properties which are only
// there to make the types differ, in order to make TypeScript type narrowing work correctly
// With empty types TypeScript does not accept this code
// ```
//   if(isPublicSpaceResource(resource)) { console.log(resource.id) } else { console.log(resource.id) }
// ```
// because in the else block resource gets the type never. If this is changed in a later TypeScript version
// or all types get different members, the underscored props can be removed.
import { DriveItem, Quota, User } from '@opencloud-eu/web-client/graph/generated'
import { Ability, Resource } from '../resource'
import { PublicLinkType } from './functions'

export const SHARE_JAIL_ID = 'a0ca6a90-a365-4782-871e-d44447bbc668'
export const OCM_PROVIDER_ID = '89f37a33-858b-45fa-8890-a1f2b27d90e1'

export interface SpaceResource extends Resource {
  description: string
  disabled: boolean
  driveAlias: string
  driveType: 'mountpoint' | 'personal' | 'project' | 'share' | 'public' | (string & unknown)
  root: DriveItem
  spaceQuota: Quota
  spaceImageData: DriveItem
  spaceReadmeData: DriveItem
  webDavTrashPath: string

  // permissions for the current user. need to be loaded manually at some point via the space store.
  graphPermissions?: string[]

  canDisable(args?: { user?: User; ability?: Ability }): boolean
  canEditDescription(args?: { user?: User; ability?: Ability }): boolean
  canEditImage(args?: { user?: User }): boolean
  canEditReadme(args?: { user?: User }): boolean
  canRestore(args?: { user?: User; ability?: Ability }): boolean
  canDeleteFromTrashBin(args?: { user?: User }): boolean
  canRestoreFromTrashbin(args?: { user?: User }): boolean
  canListVersions(args?: { user?: User }): boolean

  getWebDavUrl({ path }: { path: string }): string
  getWebDavTrashUrl({ path }: { path: string }): string
  getDriveAliasAndItem(resource: Resource): string

  isOwner(user: User): boolean
}

export const isSpaceResource = (resource: Resource): resource is SpaceResource => {
  return resource?.type === 'space'
}

export interface PersonalSpaceResource extends SpaceResource {
  __personalSpaceResource?: any
}
export const isPersonalSpaceResource = (resource: Resource): resource is PersonalSpaceResource => {
  return (resource as SpaceResource)?.driveType === 'personal'
}

export interface ProjectSpaceResource extends SpaceResource {
  __projectSpaceResource?: any
}
export const isProjectSpaceResource = (resource: Resource): resource is ProjectSpaceResource => {
  return (resource as SpaceResource)?.driveType === 'project'
}

export interface ShareSpaceResource extends SpaceResource {
  __shareSpaceResource?: any
  rename(newName: string): void
}
export const isShareSpaceResource = (resource: Resource): resource is ShareSpaceResource => {
  return (resource as SpaceResource)?.driveType === 'share'
}

export interface MountPointSpaceResource extends SpaceResource {
  __mountPointSpaceResource?: any
}
export const isMountPointSpaceResource = (
  resource: Resource
): resource is MountPointSpaceResource => {
  return (resource as SpaceResource)?.driveType === 'mountpoint'
}

export interface PublicSpaceResource extends SpaceResource {
  publicLinkPassword?: string
  publicLinkItemType?: string
  publicLinkPermission?: number
  publicLinkExpiration?: string
  publicLinkShareDate?: string
  publicLinkShareOwner?: string
  publicLinkType?: PublicLinkType
}
export const isPublicSpaceResource = (resource: Resource): resource is PublicSpaceResource => {
  return (resource as SpaceResource)?.driveType === 'public'
}
