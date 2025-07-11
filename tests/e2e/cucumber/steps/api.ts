import { Given, DataTable } from '@cucumber/cucumber'
import { World } from '../environment'
import { api } from '../../support'
import fs from 'fs'
import { Space } from '../../support/types'

Given(
  '{string} creates following user(s) using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const admin = this.usersEnvironment.getUser({ key: stepUser })

    for (const info of stepTable.hashes()) {
      const uniqueId = `${info.id}-${this.uniquePrefix}`
      // use a unique user name
      const user = {
        ...this.usersEnvironment.getUser({ key: info.id }),
        id: info.id,
        username: uniqueId,
        email: `${uniqueId}@example.org`
      }

      await api.provision.createUser({ user, admin })
    }
  }
)

Given(
  '{string} assigns following roles to the users using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const admin = this.usersEnvironment.getUser({ key: stepUser })
    for await (const info of stepTable.hashes()) {
      const user = this.usersEnvironment.getCreatedUser({ key: info.id })
      /**
         The OpenCloud API request for assigning roles allows only one role per user,
         whereas the Keycloak API request can assign multiple roles to a user.
         If multiple roles are assigned to a user in Keycloak,
         OpenCloud map the highest priority role among Keycloak assigned roles.
         Therefore, we need to unassign the previous role before
         assigning a new one when using the Keycloak API.
      */
      await api.provision.unAssignRole({ admin, user })
      await api.provision.assignRole({ admin, user, role: info.role })
    }
  }
)

Given(
  '{string} creates following group(s) using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const admin = this.usersEnvironment.getUser({ key: stepUser })

    for (const info of stepTable.hashes()) {
      const uniqueId = `${info.id}-${this.uniquePrefix}`
      const group = {
        ...this.usersEnvironment.getGroup({ key: info.id }),
        id: info.id,
        displayName: uniqueId
      }
      await api.graph.createGroup({ group, admin })
    }
  }
)

Given(
  '{string} adds user(s) to the group(s) using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const admin = this.usersEnvironment.getUser({ key: stepUser })

    for (const info of stepTable.hashes()) {
      const userId = this.usersEnvironment.getCreatedUser({ key: info.user }).uuid
      const groupId = this.usersEnvironment.getCreatedGroup({ key: info.group }).uuid
      await api.graph.addUserToGroup({ userId, groupId, admin })
    }
  }
)

Given(
  '{string} creates the following folder(s) in personal space using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.createFolderInsidePersonalSpace({ user, folder: info.name })
    }
  }
)

Given(
  '{string} creates {int} folder(s) in personal space using API',
  async function (this: World, stepUser: string, numberOfFolders: number): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (let i = 1; i <= numberOfFolders; i++) {
      await api.dav.createFolderInsidePersonalSpace({ user, folder: `testFolder${i}` })
    }
  }
)

Given(
  '{string} shares the following resource using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.share.createShare({
        user,
        path: info.resource,
        shareType: info.type,
        shareWith: info.recipient,
        role: info.role
      })
    }
  }
)

Given(
  '{string} disables auto-accepting using API',
  async function (this: World, stepUser: string): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    await api.settings.disableAutoAcceptShare({ user })
  }
)

Given(
  '{string} creates the following file(s) into personal space using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.uploadFileInPersonalSpace({
        user,
        pathToFile: info.pathToFile,
        content: info.content
      })
    }
  }
)

Given(
  '{string} creates the following file(s) with mtime into personal space using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.uploadFileInPersonalSpace({
        user,
        pathToFile: info.pathToFile,
        content: info.content,
        mtimeDeltaDays: info.mtimeDeltaDays
      })
    }
  }
)

Given(
  '{string} creates {int} file(s) in personal space using API',
  async function (this: World, stepUser: string, numberOfFiles: number): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (let i = 1; i <= numberOfFiles; i++) {
      await api.dav.uploadFileInPersonalSpace({
        user,
        pathToFile: `testfile${i}.txt`,
        content: `This is a test file${i}`
      })
    }
  }
)

Given(
  '{string} uploads the following local file(s) into personal space using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      const fileInfo = this.filesEnvironment.getFile({ name: info.localFile })
      const content = fs.readFileSync(fileInfo.path)
      await api.dav.uploadFileInPersonalSpace({
        user,
        pathToFile: info.to,
        content
      })
    }
  }
)

Given(
  '{string} creates the following project space(s) using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user =
      stepUser === 'Admin'
        ? this.usersEnvironment.getUser({ key: stepUser })
        : this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const space of stepTable.hashes()) {
      const spaceId = await api.graph.createSpace({ user, space: space as unknown as Space })
      this.spacesEnvironment.createSpace({
        key: space.id || space.name,
        space: { name: space.name, id: spaceId }
      })
    }
  }
)

Given(
  '{string} creates the following file(s) in space {string} using API',
  async function (
    this: World,
    stepUser: string,
    space: string,
    stepTable: DataTable
  ): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.uploadFileInsideSpaceBySpaceName({
        user,
        pathToFile: info.name,
        spaceName: space,
        content: info.content
      })
    }
  }
)

Given(
  '{string} creates the following folder(s) in space {string} using API',
  async function (
    this: World,
    stepUser: string,
    space: string,
    stepTable: DataTable
  ): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.createFolderInsideSpaceBySpaceName({
        user,
        folder: info.name,
        spaceName: space
      })
    }
  }
)

Given(
  '{string} adds the following member(s) to the space {string} using API',
  async function (
    this: World,
    stepUser: string,
    space: string,
    stepTable: DataTable
  ): Promise<void> {
    const user =
      stepUser === 'Admin'
        ? this.usersEnvironment.getUser({ key: stepUser })
        : this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.share.addMembersToTheProjectSpace({
        user,
        spaceName: space,
        shareWith: info.user,
        shareType: info.shareType,
        role: info.role
      })
    }
  }
)

Given(
  '{string} adds the following tags for the following resources using API',
  async function (this: World, stepUser: string, stepTable: DataTable): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.dav.addTagToResource({ user, resource: info.resource, tags: info.tags })
    }
  }
)

Given(
  '{string} creates a public link of following resource using API',
  async function (this: World, stepUser: string, stepTable: DataTable) {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })

    for (const info of stepTable.hashes()) {
      await api.share.createLinkShare({
        user,
        path: info.resource,
        password: info.password,
        name: info.name ? info.name : 'Unnamed link',
        role: info.role,
        spaceName: info.space
      })
    }
  }
)

Given(
  '{string} creates a public link of the space using API',
  async function (this: World, stepUser: string, stepTable: DataTable) {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    for (const info of stepTable.hashes()) {
      await api.share.createSpaceLinkShare({
        user,
        spaceName: info.space,
        password: info.password,
        name: info.name ? info.name : 'Unnamed link',
        role: info.role
      })
    }
  }
)

Given(
  '{string} has uploads the profile image {string} using API',
  async function (this: World, stepUser: string, profileImage: string): Promise<void> {
    const user = this.usersEnvironment.getCreatedUser({ key: stepUser })
    const profileImagePath = this.filesEnvironment.getFile({ name: profileImage }).path
    await api.graph.uploadProfileImage({
      user,
      profileImage: profileImagePath
    })
  }
)
