import SpacesList from '../../../../src/components/Spaces/SpacesList.vue'
import {
  defaultComponentMocks,
  defaultPlugins,
  mount,
  shallowMount
} from '@opencloud-eu/web-test-helpers'
import { SortDir, eventBus, queryItemAsString } from '@opencloud-eu/web-pkg'
import { displayPositionedDropdown } from '@opencloud-eu/web-pkg'
import { SideBarEventTopics } from '@opencloud-eu/web-pkg'
import { nextTick } from 'vue'
import { useSpaceSettingsStore } from '../../../../src/composables'
import { mock } from 'vitest-mock-extended'
import { OcTable } from '@opencloud-eu/design-system/components'
import { GraphSharePermission, SpaceResource } from '@opencloud-eu/web-client'
import { Permission } from '@opencloud-eu/web-client/graph/generated'

const spaceMocks = [
  mock<SpaceResource>({
    id: '1',
    name: '1 Some space',
    disabled: false,
    root: {
      permissions: [
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user1' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user2' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user3' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        })
      ]
    },
    spaceQuota: {
      total: 1000000000,
      used: 0,
      remaining: 1000000000
    }
  }),
  mock<SpaceResource>({
    id: '2',
    name: '2 Another space',
    disabled: true,
    root: {
      permissions: [
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user1' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user2' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user3' } },
          '@libre.graph.permissions.actions': [GraphSharePermission.deletePermissions]
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user4' } },
          '@libre.graph.permissions.actions': []
        }),
        mock<Permission>({
          grantedToV2: { user: { displayName: 'user5' } },
          '@libre.graph.permissions.actions': []
        })
      ]
    },
    spaceQuota: {
      total: 2000000000,
      used: 500000000,
      remaining: 1500000000
    }
  })
]

const selectors = {
  ocTableStub: 'oc-table-stub'
}

vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  displayPositionedDropdown: vi.fn(),
  queryItemAsString: vi.fn()
}))

describe('SpacesList', () => {
  it('should render all spaces in a table', () => {
    const { wrapper } = getWrapper({ spaces: spaceMocks })
    expect(wrapper.html()).toMatchSnapshot()
  })
  it.each(['name', 'members', 'totalQuota', 'usedQuota', 'remainingQuota', 'status'])(
    'sorts by property "%s"',
    async (prop) => {
      const { wrapper } = getWrapper({ mountType: shallowMount, spaces: spaceMocks })
      wrapper.vm.sortBy = prop
      await wrapper.vm.$nextTick()
      expect(
        (
          wrapper.findComponent<typeof OcTable>(selectors.ocTableStub).props()
            .data[0] as SpaceResource
        ).id
      ).toBe(spaceMocks[0].id)
      wrapper.vm.sortDir = SortDir.Desc
      await wrapper.vm.$nextTick()
      expect(
        (
          wrapper.findComponent<typeof OcTable>(selectors.ocTableStub).props()
            .data[0] as SpaceResource
        ).id
      ).toBe(spaceMocks[1].id)
    }
  )
  it('should set the sort parameters accordingly when calling "handleSort"', () => {
    const { wrapper } = getWrapper({ spaces: [spaceMocks[0]] })
    const sortBy = 'members'
    const sortDir = SortDir.Desc
    wrapper.vm.handleSort({ sortBy, sortDir })
    expect(wrapper.vm.sortBy).toEqual(sortBy)
    expect(wrapper.vm.sortDir).toEqual(sortDir)
  })
  it('shows only filtered spaces if filter applied', async () => {
    const { wrapper } = getWrapper({ spaces: spaceMocks })
    wrapper.vm.filterTerm = 'Another'
    await nextTick()
    expect(wrapper.vm.items).toEqual([spaceMocks[1]])
  })
  it('should show the context menu on right click', async () => {
    const spyDisplayPositionedDropdown = vi.mocked(displayPositionedDropdown)
    const { wrapper } = getWrapper({ spaces: spaceMocks })
    await wrapper.find(`[data-item-id="${spaceMocks[0].id}"]`).trigger('contextmenu')
    expect(spyDisplayPositionedDropdown).toHaveBeenCalledTimes(1)
  })
  it('should show the context menu on context menu button click', async () => {
    const spyDisplayPositionedDropdown = vi.mocked(displayPositionedDropdown)
    const { wrapper } = getWrapper({ spaces: spaceMocks })
    await wrapper.find('.spaces-table-btn-action-dropdown').trigger('click')
    expect(spyDisplayPositionedDropdown).toHaveBeenCalledTimes(1)
  })
  it('should show the space details on details button click', async () => {
    const eventBusSpy = vi.spyOn(eventBus, 'publish')
    const { wrapper } = getWrapper({ spaces: spaceMocks })
    await wrapper.find('.spaces-table-btn-details').trigger('click')
    expect(eventBusSpy).toHaveBeenCalledWith(SideBarEventTopics.open)
  })
  describe('toggle selection', () => {
    describe('selectSpaces method', () => {
      it('selects all spaces', () => {
        const spaces = [
          mock<SpaceResource>({ id: '1', name: 'Some Space' }),
          mock<SpaceResource>({ id: '2', name: 'Some other Space' })
        ]
        const { wrapper } = getWrapper({ mountType: shallowMount, spaces })
        wrapper.vm.selectSpaces(spaces)
        const { setSelectedSpaces } = useSpaceSettingsStore()
        expect(setSelectedSpaces).toHaveBeenCalledWith(spaces)
      })
    })
    describe('selectSpace ', () => {
      it('selects a space', () => {
        const spaces = [mock<SpaceResource>({ id: '1', name: 'Some Space' })]
        const { wrapper } = getWrapper({ mountType: shallowMount, spaces })
        wrapper.vm.selectSpace(spaces[0])
        const { addSelectedSpace } = useSpaceSettingsStore()
        expect(addSelectedSpace).toHaveBeenCalledWith(spaces[0])
      })
      it('de-selects a selected space', () => {
        const spaces = [mock<SpaceResource>({ id: '1', name: 'Some Space' })]
        const { wrapper } = getWrapper({ mountType: shallowMount, spaces, selectedSpaces: spaces })
        wrapper.vm.selectSpace(spaces[0])
        const { setSelectedSpaces } = useSpaceSettingsStore()
        expect(setSelectedSpaces).toHaveBeenCalledWith([])
      })
    })
    describe('unselectAllSpaces method', () => {
      it('de-selects all selected spaces', () => {
        const spaces = [mock<SpaceResource>({ id: '1', name: 'Some Space' })]
        const { wrapper } = getWrapper({ mountType: shallowMount, spaces })
        wrapper.vm.unselectAllSpaces()
        const { setSelectedSpaces } = useSpaceSettingsStore()
        expect(setSelectedSpaces).toHaveBeenCalledWith([])
      })
    })
  })
})

function getWrapper({
  mountType = mount,
  spaces = [],
  selectedSpaces = []
}: { mountType?: typeof mount; spaces?: SpaceResource[]; selectedSpaces?: SpaceResource[] } = {}) {
  vi.mocked(queryItemAsString).mockImplementationOnce(() => '1')
  vi.mocked(queryItemAsString).mockImplementationOnce(() => '100')
  const mocks = defaultComponentMocks()

  return {
    wrapper: mountType(SpacesList, {
      props: {
        headerPosition: 0
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              spaceSettingsStore: { spaces, selectedSpaces }
            }
          })
        ],
        mocks,
        provide: mocks,
        stubs: {
          OcCheckbox: true
        }
      }
    })
  }
}
