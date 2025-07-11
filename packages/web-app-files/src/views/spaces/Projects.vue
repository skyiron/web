<template>
  <div class="oc-flex oc-width-1-1">
    <files-view-wrapper>
      <app-bar
        :breadcrumbs="breadcrumbs"
        :show-actions-on-selection="true"
        :has-bulk-actions="true"
        :has-hidden-files="false"
        :has-file-extensions="false"
        :has-pagination="false"
        :batch-actions-loading="batchActionsLoading"
        :is-side-bar-open="isSideBarOpen"
        :view-modes="viewModes"
        :view-mode-default="FolderViewModeConstants.name.tiles"
      >
        <template #actions>
          <create-space v-if="hasCreatePermission" class="oc-mr-s" />
          <div v-if="!selectedResourcesIds?.length" class="oc-flex oc-flex-middle oc-pl-s">
            <span v-text="$gettext('Learn about spaces')" />
            <oc-contextual-helper
              :list="spacesHelpList"
              :title="$gettext('Spaces')"
              class="oc-ml-xs"
            />
          </div>
        </template>
      </app-bar>
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message
          v-if="!spaces.length"
          id="files-spaces-empty"
          class="files-empty"
          icon="layout-grid"
        >
          <template #message>
            <span v-text="$gettext('You don\'t have access to any spaces')" />
          </template>
        </no-content-message>
        <div v-else class="spaces-list">
          <div
            class="spaces-list-filters oc-flex oc-flex-right oc-flex-wrap oc-flex-bottom oc-mx-m oc-mb-m"
          >
            <oc-text-input
              id="spaces-filter"
              v-model="filterTerm"
              :label="$gettext('Search')"
              autocomplete="off"
            />
          </div>
          <component
            :is="folderView.component"
            v-model:selected-ids="selectedResourcesIds"
            resource-type="space"
            :resources="paginatedItems"
            :fields-displayed="tableDisplayFields"
            :sort-fields="sortFields"
            :sort-by="sortBy"
            :sort-dir="sortDir"
            :header-position="fileListHeaderY"
            :is-side-bar-open="isSideBarOpen"
            :view-size="viewSize"
            v-bind="folderView.componentAttrs?.()"
            @sort="handleSort"
            @item-visible="loadPreview({ space: $event, resource: $event })"
          >
            <template #image="{ resource }">
              <template v-if="viewMode === FolderViewModeConstants.name.tiles">
                <oc-spinner
                  v-if="imagesLoading.includes(resource.id)"
                  :aria-label="$gettext('Space image is loading')"
                />
                <img
                  v-else-if="resource.thumbnail"
                  class="tile-preview"
                  :src="resource.thumbnail"
                  alt=""
                />
              </template>
              <template v-else>
                <oc-spinner
                  v-if="imagesLoading.includes(resource.id)"
                  :aria-label="$gettext('Space image is loading')"
                  class="oc-mr-s"
                />
                <img
                  v-else-if="resource.thumbnail"
                  class="table-preview oc-mr-s"
                  :class="{ 'table-preview-disabled': resource.disabled }"
                  :src="resource.thumbnail"
                  alt=""
                  width="33"
                  height="33"
                />
                <resource-icon v-else class="oc-mr-s" :resource="resource" />
              </template>
            </template>
            <template #actions="{ resource }">
              <oc-button
                v-if="!resource.disabled"
                v-oc-tooltip="showSpaceMemberLabel"
                class="spaces-list-show-members-button raw-hover-surface oc-p-xs oc-ml-xs"
                :aria-label="showSpaceMemberLabel"
                appearance="raw"
                @click="openSidebarSharePanel(resource as SpaceResource)"
              >
                <oc-icon name="group" fill-type="line" />
              </oc-button>
            </template>
            <template #contextMenu="{ resource, isOpen }">
              <space-context-actions
                v-if="isOpen && isResourceInSelection(resource)"
                :loading="resource.graphPermissions === undefined"
                :action-options="{ resources: [resource] as SpaceResource[] }"
              />
            </template>
            <template #footer>
              <pagination :pages="totalPages" :current-page="currentPage" />
              <div class="oc-text-center oc-width-1-1 oc-my-s">
                <p class="oc-text-muted">{{ footerTextTotal }}</p>
                <p v-if="filterTerm" class="oc-text-muted">{{ footerTextFilter }}</p>
              </div>
            </template>
            <!--- table -->
            <template #totalQuota="{ resource }">
              {{ getTotalQuota(resource) }}
            </template>
            <template #usedQuota="{ resource }"> {{ getUsedQuota(resource) }}</template>
            <template #remainingQuota="{ resource }"> {{ getRemainingQuota(resource) }}</template>
          </component>
        </div>
      </template>
    </files-view-wrapper>
    <file-side-bar
      :is-open="isSideBarOpen"
      :active-panel="sideBarActivePanel"
      :space="selectedSpace"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, unref, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useTask } from 'vue-concurrency'
import Mark from 'mark.js'
import Fuse from 'fuse.js'

import {
  AppLoadingSpinner,
  useResourcesStore,
  useSpacesStore,
  useExtensionRegistry,
  queryItemAsString,
  useLoadPreview
} from '@opencloud-eu/web-pkg'

import { AppBar, CreateSpace } from '@opencloud-eu/web-pkg'
import {
  useAbility,
  useClientService,
  FolderViewModeConstants,
  useRouteQueryPersisted,
  useSort,
  useRouteName,
  usePagination,
  useRouter,
  useRoute,
  Pagination,
  FileSideBar,
  NoContentMessage
} from '@opencloud-eu/web-pkg'
import SpaceContextActions from '../../components/Spaces/SpaceContextActions.vue'
import {
  isProjectSpaceResource,
  ProjectSpaceResource,
  SpaceResource
} from '@opencloud-eu/web-client'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'
import { eventBus } from '@opencloud-eu/web-pkg'
import { SideBarEventTopics, useSideBar } from '@opencloud-eu/web-pkg'
import { sortFields as availableSortFields, translateSortFields } from '@opencloud-eu/web-pkg'
import { defaultFuseOptions, formatFileSize, ResourceIcon } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { useKeyboardActions } from '@opencloud-eu/web-pkg'
import {
  useKeyboardFileNavigation,
  useKeyboardFileMouseActions,
  useKeyboardFileActions
} from '../../composables/keyboardActions'
import { orderBy } from 'lodash-es'
import { useResourcesViewDefaults } from '../../composables'
import { folderViewsProjectSpacesExtensionPoint } from '../../extensionPoints'
import { storeToRefs } from 'pinia'

const spacesStore = useSpacesStore()
const router = useRouter()
const route = useRoute()
const clientService = useClientService()
const { can } = useAbility()
const language = useGettext()
const { $gettext, $ngettext } = language
const filterTerm = ref('')
const markInstance = ref(undefined)
const resourcesStore = useResourcesStore()
const { imagesLoading } = storeToRefs(spacesStore)
const { isSideBarOpen, sideBarActivePanel } = useSideBar()

const { setSelection, initResourceList, clearResourceList, setAncestorMetaData } = resourcesStore
const { areDisabledSpacesShown } = storeToRefs(resourcesStore)

const loadResourcesTask = useTask(function* (signal) {
  clearResourceList()
  setAncestorMetaData({})
  yield spacesStore.reloadProjectSpaces({
    graphClient: clientService.graphAuthenticated,
    signal
  })
  initResourceList({ currentFolder: null, resources: unref(spaces) })
})

const {
  viewSize,
  fileListHeaderY,
  scrollToResourceFromRoute,
  areResourcesLoading,
  selectedResourcesIds,
  selectedResources,
  isResourceInSelection
} = useResourcesViewDefaults({ loadResourcesTask })

let loadPreviewToken: string = null

const runtimeSpaces = computed(() => {
  return spacesStore.spaces.filter(isProjectSpaceResource) || []
})
const selectedSpace = computed(() => {
  if (
    unref(selectedResources).length === 1 &&
    isProjectSpaceResource(unref(selectedResources)[0])
  ) {
    return unref(selectedResources)[0] as ProjectSpaceResource
  }
  return null
})

const tableDisplayFields = [
  'image',
  'name',
  'totalQuota',
  'usedQuota',
  'remainingQuota',
  'indicators',
  'mdate'
]

const sortFields = translateSortFields(availableSortFields, language)
const {
  sortBy,
  sortDir,
  items: spaces,
  handleSort
} = useSort<SpaceResource>({
  items: runtimeSpaces,
  fields: sortFields
})
const filter = (spaces: Array<ProjectSpaceResource>, filterTerm: string) => {
  if (!unref(areDisabledSpacesShown)) {
    spaces = spaces.filter((space) => space.disabled !== true)
  }

  if (!(filterTerm || '').trim()) {
    return spaces
  }

  const searchEngine = new Fuse(spaces, { ...defaultFuseOptions, keys: ['name'] })
  return searchEngine.search(filterTerm).map((r) => r.item)
}
const items = computed(() => {
  return orderBy(
    filter(unref(spaces), unref(filterTerm)),
    [
      (item: SpaceResource) =>
        typeof item[unref(sortBy)] === 'string'
          ? item[unref(sortBy)].toLowerCase()
          : item[unref(sortBy)]
    ],
    unref(sortDir)
  )
})

const {
  items: paginatedItems,
  page: currentPage,
  total: totalPages
} = usePagination({
  items,
  perPageDefault: '50',
  perPageStoragePrefix: 'spaces-list'
})

const batchActionsLoading = computed(() => {
  const selectedSpaces = unref(selectedResources) as SpaceResource[]
  return selectedSpaces.some(({ graphPermissions }) => graphPermissions === undefined)
})

watch(filterTerm, async () => {
  const instance = unref(markInstance)
  if (!instance) {
    return
  }
  await router.push({ ...unref(route), query: { ...unref(route).query, page: '1' } })
  instance.unmark()
  instance.mark(unref(filterTerm), {
    element: 'span',
    className: 'mark-highlight',
    exclude: ['th *', 'tfoot *']
  })
})

watch(selectedResourcesIds, async (ids) => {
  if (!ids.length) {
    return
  }

  await spacesStore.loadGraphPermissions({
    ids,
    graphClient: clientService.graphAuthenticated
  })
})

const hasCreatePermission = computed(() => can('create-all', 'Drive'))

const extensionRegistry = useExtensionRegistry()
const viewModes = computed(() => {
  return [
    ...extensionRegistry
      .requestExtensions(folderViewsProjectSpacesExtensionPoint)
      .map((e) => e.folderView)
  ]
})

const routeName = useRouteName()

const viewMode = useRouteQueryPersisted({
  name: `${unref(routeName)}-${FolderViewModeConstants.queryName}`,
  defaultValue: FolderViewModeConstants.name.tiles
})
const viewModeStr = computed(() => queryItemAsString(unref(viewMode)))

const { loadPreview } = useLoadPreview(viewModeStr)

const keyActions = useKeyboardActions()
useKeyboardFileNavigation(keyActions, runtimeSpaces, viewMode)
useKeyboardFileMouseActions(keyActions, viewMode)
useKeyboardFileActions(keyActions)

const getTotalQuota = (space: SpaceResource) => {
  if (space.spaceQuota.total === 0) {
    return $gettext('Unrestricted')
  }

  return formatFileSize(space.spaceQuota.total, language.current)
}
const getUsedQuota = (space: SpaceResource) => {
  if (space.spaceQuota.used === undefined) {
    return '-'
  }
  return formatFileSize(space.spaceQuota.used, language.current)
}
const getRemainingQuota = (space: SpaceResource) => {
  if (space.spaceQuota.total === 0) {
    return $gettext('Unrestricted')
  }
  if (space.spaceQuota.remaining === undefined) {
    return '-'
  }
  return formatFileSize(space.spaceQuota.remaining, language.current)
}

onMounted(async () => {
  await loadResourcesTask.perform()

  loadPreviewToken = eventBus.subscribe(
    'app.files.spaces.uploaded-image',
    (space: SpaceResource) => {
      loadPreview({ space, resource: space })
    }
  )
  scrollToResourceFromRoute(unref(spaces), 'files-app-bar')
  nextTick(() => {
    markInstance.value = new Mark('.spaces-table')
  })
})

onBeforeUnmount(() => {
  eventBus.unsubscribe('app.files.spaces.uploaded-image', loadPreviewToken)
})

const footerTextTotal = computed(() => {
  const disabledSpaces = unref(spaces).filter((space) => space.disabled === true)

  if (!disabledSpaces.length) {
    return $ngettext(
      '%{spaceCount} space in total',
      '%{spaceCount} spaces in total',
      unref(spaces).length,
      {
        spaceCount: unref(spaces).length.toString()
      }
    )
  }

  return $ngettext(
    '%{spaceCount} space in total (including %{disabledSpaceCount} disabled)',
    '%{spaceCount} spaces in total (including %{disabledSpaceCount} disabled)',
    unref(spaces).length,
    {
      spaceCount: unref(spaces).length.toString(),
      disabledSpaceCount: disabledSpaces.length.toString()
    }
  )
})
const footerTextFilter = computed(() => {
  return $gettext('%{spaceCount} matching spaces', {
    spaceCount: unref(items).length.toString()
  })
})

const folderView = computed(() => {
  const viewModeName = unref(viewMode) || FolderViewModeConstants.name.tiles
  return unref(viewModes).find((v) => v.name === viewModeName)
})

const spacesHelpList = computed(() => {
  return [
    {
      text: $gettext('Spaces are special folders for making files accessible to a team.')
    },
    {
      text: $gettext(
        'Spaces belong to a team and not to a single person. Even if members are removed, the files remain in the Space so that the team can continue to work on the files.'
      )
    },
    {
      text: $gettext(
        'Members with the Manager role can add or remove other members from the Space.'
      )
    },
    {
      text: $gettext('A Space can have multiple Managers. Each Space has at least one Manager.')
    }
  ]
})

const breadcrumbs = computed(() => {
  return [
    {
      text: $gettext('Spaces'),
      onClick: () => loadResourcesTask.perform(),
      isStativNav: true
    }
  ]
})
const showSpaceMemberLabel = computed(() => {
  return $gettext('Show members')
})

const openSidebarSharePanel = (space: SpaceResource) => {
  setSelection([space.id])
  eventBus.publish(SideBarEventTopics.openWithPanel, 'space-share')
}
</script>

<style lang="scss">
#files-spaces-empty {
  height: 75vh;
}

.table-preview {
  object-fit: cover;
  border-radius: 3px;
}

.table-preview-disabled {
  filter: grayscale(100%);
  opacity: 80%;
}

.state-trashed {
  .tile-preview,
  .tile-default-image > svg {
    filter: grayscale(100%);
    opacity: 80%;
  }
}
</style>
