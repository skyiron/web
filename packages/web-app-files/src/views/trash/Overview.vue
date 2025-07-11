<template>
  <div class="oc-flex">
    <files-view-wrapper>
      <app-bar
        :breadcrumbs="breadcrumbs"
        :has-view-options="false"
        :has-hidden-files="false"
        :has-file-extensions="false"
        :has-pagination="false"
      />
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message v-if="!spaces.length" icon="delete-bin-5">
          <template #message>
            <span v-text="$gettext('You don\'t have access to any trashbins')"></span>
          </template>
        </no-content-message>
        <template v-else>
          <div
            class="trash-bin-filters oc-flex oc-flex-right oc-flex-wrap oc-flex-bottom oc-mx-m oc-mb-m"
          >
            <oc-text-input
              id="spaces-filter"
              v-model="filterTerm"
              :label="$gettext('Search')"
              autocomplete="off"
            />
          </div>
          <resource-table
            class="trash-table"
            :resources="displaySpaces"
            :fields-displayed="['name']"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            :is-side-bar-open="isSideBarOpen"
            :header-position="fileListHeaderY"
            :are-thumbnails-displayed="false"
            :are-paths-displayed="false"
            :is-selectable="false"
            :target-route-callback="resourceTargetRouteCallback"
            @sort="handleSort"
          >
            <template #contextMenu="{ resource, isOpen }">
              <trash-context-actions
                v-if="isOpen"
                :action-options="{ resources: [resource] as SpaceResource[] }"
              />
            </template>
            <template #footer>
              <div class="oc-text-center oc-width-1-1 oc-my-s">
                <p class="oc-text-muted">{{ footerTextTotal }}</p>
                <p v-if="filterTerm" class="oc-text-muted">{{ footerTextFilter }}</p>
              </div>
            </template>
          </resource-table>
        </template>
      </template>
    </files-view-wrapper>
    <file-side-bar :is-open="isSideBarOpen" :active-panel="sideBarActivePanel" />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, ref, unref, watch } from 'vue'
import Mark from 'mark.js'
import Fuse from 'fuse.js'
import { useGettext } from 'vue3-gettext'
import { useTask } from 'vue-concurrency'
import {
  AppBar,
  AppLoadingSpinner,
  createFileRouteOptions,
  createLocationTrash,
  CreateTargetRouteOptions,
  defaultFuseOptions,
  FileSideBar,
  NoContentMessage,
  SortDir,
  useClientService,
  useFileListHeaderPosition,
  useResourcesStore,
  useRouter,
  useSideBar,
  useSpacesStore,
  useUserStore
} from '@opencloud-eu/web-pkg'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'
import {
  isPersonalSpaceResource,
  isProjectSpaceResource,
  SpaceResource
} from '@opencloud-eu/web-client'
import { FieldType } from '@opencloud-eu/design-system/helpers'
import { ResourceTable } from '@opencloud-eu/web-pkg/src'
import { RouteLocationNamedRaw } from 'vue-router'
import TrashContextActions from '../../components/Trash/TrashContextActions.vue'

export default defineComponent({
  name: 'TrashOverview',
  components: {
    TrashContextActions,
    ResourceTable,
    FileSideBar,
    FilesViewWrapper,
    AppBar,
    AppLoadingSpinner,
    NoContentMessage
  },
  setup() {
    const userStore = useUserStore()
    const spacesStore = useSpacesStore()
    const router = useRouter()
    const { $gettext } = useGettext()
    const clientService = useClientService()
    const { y: fileListHeaderY } = useFileListHeaderPosition()
    const resourcesStore = useResourcesStore()

    const sortBy = ref<keyof SpaceResource>('name')
    const sortDir = ref<SortDir>(SortDir.Asc)
    const filterTerm = ref('')
    const markInstance = ref(undefined)

    const spaces = computed(() =>
      spacesStore.spaces.filter(
        (s: SpaceResource) =>
          (isPersonalSpaceResource(s) && s.isOwner(userStore.user)) || isProjectSpaceResource(s)
      )
    )

    const loadResourcesTask = useTask(function* (signal) {
      resourcesStore.clearResourceList()
      yield spacesStore.reloadProjectSpaces({
        graphClient: clientService.graphAuthenticated,
        signal
      })
      resourcesStore.initResourceList({ currentFolder: null, resources: unref(spaces) })
    })

    const areResourcesLoading = computed(() => {
      return loadResourcesTask.isRunning || !loadResourcesTask.last
    })

    const footerTextTotal = computed(() => {
      return $gettext('%{spaceCount} trashes in total', {
        spaceCount: unref(spaces).length.toString()
      })
    })
    const footerTextFilter = computed(() => {
      return $gettext('%{spaceCount} matching trashes', {
        spaceCount: unref(displaySpaces).length.toString()
      })
    })

    const breadcrumbs = computed(() => [
      { text: $gettext('Deleted files'), onClick: () => loadResourcesTask.perform() }
    ])

    const sort = (list: SpaceResource[], propName: keyof SpaceResource, desc: boolean) => {
      return [...list].sort((s1, s2) => {
        if (isPersonalSpaceResource(s1)) {
          return -1
        }
        if (isPersonalSpaceResource(s2)) {
          return +1
        }

        const a = s1[propName].toString()
        const b = s2[propName].toString()

        return desc ? b.localeCompare(a) : a.localeCompare(b)
      })
    }
    const displaySpaces = computed(() =>
      sort(filter(unref(spaces), unref(filterTerm)), unref(sortBy), unref(sortDir) === 'desc')
    )
    const handleSort = (event: { sortBy: keyof SpaceResource; sortDir: SortDir }) => {
      sortBy.value = event.sortBy
      sortDir.value = event.sortDir
    }
    const filter = (spaces: SpaceResource[], filterTerm: string) => {
      if (!(filterTerm || '').trim()) {
        return spaces
      }
      const searchEngine = new Fuse(spaces, { ...defaultFuseOptions, keys: ['name'] })
      return searchEngine.search(filterTerm).map((r) => r.item)
    }

    const fields = computed((): FieldType[] => [
      {
        name: 'icon',
        title: '',
        type: 'slot',
        width: 'shrink'
      },
      {
        name: 'name',
        title: $gettext('Name'),
        type: 'slot',
        sortable: true
      }
    ])

    const resourceTargetRouteCallback = ({
      resource
    }: CreateTargetRouteOptions): RouteLocationNamedRaw => {
      return getTrashLink(resource as SpaceResource)
    }

    const getTrashLink = (space: SpaceResource) => {
      return createLocationTrash('files-trash-generic', {
        ...createFileRouteOptions(space)
      })
    }

    onMounted(async () => {
      if (unref(spaces).length === 1 && !isProjectSpaceResource(unref(spaces)[0])) {
        return router.push(getTrashLink(unref(spaces)[0]))
      }

      await loadResourcesTask.perform()
      await nextTick()
      markInstance.value = new Mark('.trash-table')
    })

    watch(filterTerm, () => {
      const instance = unref(markInstance)
      if (!instance) {
        return
      }
      instance.unmark()
      instance.mark(unref(filterTerm), {
        element: 'span',
        className: 'mark-highlight',
        exclude: ['th *', 'tfoot *']
      })
    })

    return {
      sortBy,
      sortDir,
      filterTerm,
      footerTextTotal,
      footerTextFilter,
      fields,
      spaces,
      filter,
      handleSort,
      displaySpaces,
      breadcrumbs,
      resourceTargetRouteCallback,
      loadResourcesTask,
      areResourcesLoading,
      isPersonalSpaceResource,
      fileListHeaderY,
      ...useSideBar()
    }
  }
})
</script>

<style lang="scss">
#spaces-filter {
  width: 16rem;
}
</style>
