import SpaceDetails from '../../../../../../src/components/SideBar/Spaces/Details/SpaceDetails.vue'
import {
  CollaboratorShare,
  ShareRole,
  SpaceResource,
  Resource,
  GraphSharePermission
} from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { defaultComponentMocks, defaultPlugins, shallowMount } from '@opencloud-eu/web-test-helpers'
import { RouteLocation } from 'vue-router'
import { User } from '@opencloud-eu/web-client/graph/generated'

const spaceMock = {
  type: 'space',
  name: ' space',
  id: '1',
  driveType: 'project',
  mdate: 'Wed, 21 Oct 2015 07:28:00 GMT',
  spaceQuota: {
    used: 100,
    total: 1000
  }
} as unknown as SpaceResource

const spaceShare = {
  id: '1',
  sharedWith: {
    id: '1',
    displayName: 'alice'
  },
  resourceId: '1',
  role: mock<ShareRole>(),
  permissions: [GraphSharePermission.deletePermissions]
} as CollaboratorShare

const selectors = {
  spaceDefaultImage: '.space-default-image',
  spaceMembers: '.oc-space-details-sidebar-members'
}

describe('Details SideBar Panel', () => {
  it('displays the details side panel', () => {
    const { wrapper } = createWrapper()
    expect(wrapper.html()).toMatchSnapshot()
  })
  it('does render the space default image', () => {
    const { wrapper } = createWrapper()
    expect(wrapper.find(selectors.spaceDefaultImage).exists()).toBeTruthy()
  })
  it('does not render share indicators if "showShareIndicators" is false', () => {
    const { wrapper } = createWrapper({
      spaceResource: spaceMock,
      props: { showShareIndicators: false }
    })
    expect(wrapper.find(selectors.spaceMembers).exists()).toBeFalsy()
  })
  it('does not render share indicators if space is disabled', () => {
    const { wrapper } = createWrapper({
      spaceResource: { ...spaceMock, disabled: true },
      props: { showShareIndicators: true }
    })
    expect(wrapper.find(selectors.spaceMembers).exists()).toBeFalsy()
  })
})

function createWrapper({ spaceResource = spaceMock, props = {} } = {}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ name: 'files-spaces-generic' })
    })
  }

  return {
    wrapper: shallowMount(SpaceDetails, {
      props: { ...props },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              stubActions: false,
              userState: { user: { id: '1', onPremisesSamAccountName: 'marie' } as User },
              sharesState: { collaboratorShares: [spaceShare] },
              resourcesStore: { resources: [mock<Resource>({ name: 'file1', type: 'file' })] }
            }
          })
        ],
        mocks,
        provide: { resource: spaceResource, ...mocks }
      }
    })
  }
}
