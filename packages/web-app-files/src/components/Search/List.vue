<template>
  <div class="files-search-result oc-flex">
    <files-view-wrapper>
      <app-bar
        :breadcrumbs="breadcrumbs"
        :has-bulk-actions="true"
        :is-side-bar-open="isSideBarOpen"
      />
      <div
        v-if="displayFilter"
        class="files-search-result-filter oc-flex oc-flex-wrap oc-mx-m oc-mb-m oc-mt-xs"
      >
        <div class="oc-mr-m oc-flex oc-flex-middle">
          <oc-icon name="filter-2" class="oc-mr-xs" />
          <span v-text="$gettext('Filter:')" />
        </div>
        <item-filter
          v-if="availableMediaTypeValues.length"
          ref="mediaTypeFilter"
          :allow-multiple="true"
          :filter-label="$gettext('Type')"
          :filterable-attributes="['label']"
          :items="availableMediaTypeValues"
          class="files-search-filter-file-type oc-mr-s"
          display-name-attribute="label"
          filter-name="mediaType"
        >
          <template #image="{ item }">
            <div
              class="file-category-option-wrapper oc-flex oc-flex-middle"
              :data-test-id="`media-type-${item.id.toLowerCase()}`"
            >
              <resource-icon :resource="getFakeResourceForIcon(item)" />
              <span class="oc-ml-s">{{ item.label }}</span>
            </div>
          </template>
        </item-filter>
        <item-filter
          v-if="availableTags.length"
          ref="tagFilter"
          :allow-multiple="true"
          :filter-label="$gettext('Tags')"
          :filterable-attributes="['label']"
          :items="availableTags"
          :option-filter-label="$gettext('Filter tags')"
          :show-option-filter="true"
          class="files-search-filter-tags oc-mr-s"
          display-name-attribute="label"
          filter-name="tags"
        >
          <template #image="{ item }">
            <div class="tag-option-wrapper oc-flex oc-flex-middle">
              <oc-icon name="price-tag-3" size="small" />
              <span class="oc-ml-s">{{ item.label }}</span>
            </div>
          </template>
        </item-filter>
        <item-filter
          v-if="availableLastModifiedValues.length"
          ref="lastModifiedFilter"
          :filter-label="$gettext('Last Modified')"
          :filterable-attributes="['label']"
          :items="availableLastModifiedValues"
          :show-option-filter="false"
          :close-on-click="true"
          class="files-search-filter-last-modified oc-mr-s"
          display-name-attribute="label"
          filter-name="lastModified"
        >
          <template #item="{ item }">
            <span v-text="item.label" />
          </template>
        </item-filter>

        <item-filter-toggle
          v-if="fullTextSearchEnabled"
          :filter-label="$gettext('Title only')"
          filter-name="titleOnly"
          class="files-search-filter-title-only oc-mr-s"
        />
      </div>
      <app-loading-spinner v-if="loading" />
      <template v-else>
        <no-content-message
          v-if="!paginatedResources.length"
          class="files-empty"
          icon="search"
          icon-fill-type="line"
        >
          <template #message>
            <p class="oc-text-muted">
              <span v-if="!!$route.query.term" v-text="$gettext('No results found')" />
              <span v-else v-text="$gettext('Search for files')" />
            </p>
          </template>
        </no-content-message>
        <resource-table
          v-else
          v-model:selected-ids="selectedResourcesIds"
          :is-side-bar-open="isSideBarOpen"
          :header-position="fileListHeaderY"
          :resources="paginatedResources"
          :are-paths-displayed="true"
          :has-actions="true"
          :is-selectable="true"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :fields-displayed="['name', 'size', 'tags', 'mdate']"
          :resource-dom-selector="resourceDomSelector"
          @file-click="triggerDefaultAction"
          @item-visible="loadPreview({ space: getMatchingSpace($event), resource: $event })"
          @sort="handleSort"
        >
          <template #additionalResourceContent="{ resource }">
            <!-- eslint-disable vue/no-v-html -->
            <span
              v-if="resource.highlights"
              class="files-search-resource-highlights oc-text-truncate oc-display-inline-block"
              v-html="resource.highlights"
            />
            <!--eslint-enable-->
          </template>
          <template #contextMenu="{ resource, isOpen }">
            <context-actions
              v-if="isOpen && isResourceInSelection(resource)"
              :action-options="{ space: getMatchingSpace(resource), resources: selectedResources }"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <div
              v-if="searchResultExceedsLimit"
              class="oc-text-center oc-width-1-1 oc-my-s"
              v-text="searchResultExceedsLimitText"
            />
            <list-info v-else-if="paginatedResources.length > 0" class="oc-width-1-1 oc-my-s" />
          </template>
        </resource-table>
      </template>
    </files-view-wrapper>
    <file-side-bar
      :is-open="isSideBarOpen"
      :active-panel="sideBarActivePanel"
      :space="selectedResourceSpace"
    />
  </div>
</template>

<script lang="ts">
import { useResourcesViewDefaults } from '../../composables'
import {
  AppLoadingSpinner,
  SearchResult,
  useCapabilityStore,
  useConfigStore,
  useResourcesStore,
  useSearch
} from '@opencloud-eu/web-pkg'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { ResourceTable } from '@opencloud-eu/web-pkg'
import { ContextActions, FileSideBar } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { AppBar } from '@opencloud-eu/web-pkg'
import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  PropType,
  Ref,
  ref,
  unref,
  watch
} from 'vue'
import ListInfo from '../FilesList/ListInfo.vue'
import { Pagination } from '@opencloud-eu/web-pkg'
import { useFileActions } from '@opencloud-eu/web-pkg'
import { searchLimit } from '../../search/sdk/list'
import { Resource, SearchResource, call } from '@opencloud-eu/web-client'
import FilesViewWrapper from '../FilesViewWrapper.vue'
import {
  queryItemAsString,
  useClientService,
  useFileListHeaderPosition,
  useGetMatchingSpace,
  useRoute,
  useRouteQuery,
  useRouter,
  useLoadPreview
} from '@opencloud-eu/web-pkg'
import { onBeforeRouteLeave } from 'vue-router'
import { useTask } from 'vue-concurrency'
import { eventBus } from '@opencloud-eu/web-pkg'
import { ItemFilter } from '@opencloud-eu/web-pkg'
import { isLocationCommonActive } from '@opencloud-eu/web-pkg'
import { ItemFilterToggle } from '@opencloud-eu/web-pkg'
import { useKeyboardActions, ResourceIcon } from '@opencloud-eu/web-pkg'
import {
  useKeyboardFileNavigation,
  useKeyboardFileMouseActions,
  useKeyboardFileActions
} from '../../composables/keyboardActions'
import { extractDomSelector } from '@opencloud-eu/web-client'
import { storeToRefs } from 'pinia'

type Tag = {
  id: string
  label: string
}
type LastModifiedKeyword = {
  id: string
  label: string
}

export default defineComponent({
  components: {
    AppBar,
    FileSideBar,
    AppLoadingSpinner,
    ContextActions,
    ListInfo,
    Pagination,
    NoContentMessage,
    ResourceIcon,
    ResourceTable,
    FilesViewWrapper,
    ItemFilter,
    ItemFilterToggle
  },
  props: {
    searchResult: {
      type: Object as PropType<SearchResult>,
      default: function () {
        return { totalResults: null, values: [] }
      }
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['search'],
  setup(props, { emit }) {
    const capabilityStore = useCapabilityStore()
    const router = useRouter()
    const route = useRoute()
    const { $gettext } = useGettext()
    const { y: fileListHeaderY } = useFileListHeaderPosition()
    const clientService = useClientService()
    const { getMatchingSpace } = useGetMatchingSpace()
    const { buildSearchTerm } = useSearch()

    const resourcesStore = useResourcesStore()
    const { initResourceList, clearResourceList, setAncestorMetaData } = resourcesStore
    const { totalResourcesCount } = storeToRefs(resourcesStore)

    const configStore = useConfigStore()
    const { options: configOptions } = storeToRefs(configStore)

    const searchTermQuery = useRouteQuery('term')
    const scopeQuery = useRouteQuery('scope')
    const doUseScope = useRouteQuery('useScope')

    const resourcesView = useResourcesViewDefaults<Resource, any, any[]>()
    const { loadPreview } = useLoadPreview(resourcesView.viewMode)
    const keyActions = useKeyboardActions()
    useKeyboardFileNavigation(keyActions, resourcesView.paginatedResources, resourcesView.viewMode)
    useKeyboardFileMouseActions(keyActions, resourcesView.viewMode)
    useKeyboardFileActions(keyActions)

    const searchTerm = computed(() => {
      return queryItemAsString(unref(searchTermQuery))
    })

    const availableTags = ref<Tag[]>([])
    const tagFilter = ref<InstanceType<typeof ItemFilter> | null>(null)
    const mediaTypeFilter = ref<InstanceType<typeof ItemFilter> | null>()
    const tagParam = useRouteQuery('q_tags')
    const lastModifiedParam = useRouteQuery('q_lastModified')
    const mediaTypeParam = useRouteQuery('q_mediaType')
    const titleOnlyParam = useRouteQuery('q_titleOnly')

    const fullTextSearchEnabled = computed(() => capabilityStore.searchContent?.enabled)

    const displayFilter = computed(() => {
      return (
        unref(fullTextSearchEnabled) ||
        unref(availableTags).length ||
        capabilityStore.searchLastMofifiedDate?.enabled
      )
    })

    const loadAvailableTagsTask = useTask(function* (signal) {
      const tags = yield* call(clientService.graphAuthenticated.tags.listTags({ signal }))
      availableTags.value = [...tags.map((t) => ({ id: t, label: t }))]
    })

    onBeforeRouteLeave(() => {
      eventBus.publish('app.search.term.clear')
    })

    // transifex hack b/c dynamically fetched values from backend will otherwise not be automatically translated
    const lastModifiedTranslations: Record<string, string> = {
      today: $gettext('today'),
      yesterday: $gettext('yesterday'),
      'this week': $gettext('this week'),
      'last week': $gettext('last week'),
      'last 7 days': $gettext('last 7 days'),
      'this month': $gettext('this month'),
      'last month': $gettext('last month'),
      'last 30 days': $gettext('last 30 days'),
      'this year': $gettext('this year'),
      'last year': $gettext('last year')
    }

    const lastModifiedFilter = ref<InstanceType<typeof ItemFilter> | null>()
    const availableLastModifiedValues = ref<LastModifiedKeyword[]>(
      capabilityStore.searchLastMofifiedDate.keywords?.map((k: string) => ({
        id: k,
        label: lastModifiedTranslations[k]
      })) || []
    )

    const mediaTypeMapping: Record<string, { label: string; icon: string }> = {
      file: { label: $gettext('File'), icon: 'txt' },
      folder: { label: $gettext('Folder'), icon: 'folder' },
      document: { label: $gettext('Document'), icon: 'doc' },
      spreadsheet: { label: $gettext('Spreadsheet'), icon: 'xls' },
      presentation: { label: $gettext('Presentation'), icon: 'ppt' },
      pdf: { label: $gettext('PDF'), icon: 'pdf' },
      image: { label: $gettext('Image'), icon: 'jpg' },
      video: { label: $gettext('Video'), icon: 'mp4' },
      audio: { label: $gettext('Audio'), icon: 'mp3' },
      archive: { label: $gettext('Archive'), icon: 'zip' }
    }

    const availableMediaTypeValues = computed(() => {
      return (
        capabilityStore.searchMediaType.keywords?.filter((key) => mediaTypeMapping[key]) || []
      ).map((key) => ({ id: key, ...mediaTypeMapping[key] }))
    })

    const getFakeResourceForIcon = (item: { label: string; icon: string }) => {
      return { type: 'file', extension: item.icon, isFolder: item.icon == 'folder' } as Resource
    }

    const doSearch = (manuallyUpdateFilterChip = false) => {
      const isTitleOnlySearch = queryItemAsString(unref(titleOnlyParam)) == 'true'
      const tags = queryItemAsString(unref(tagParam))
      const lastModified = queryItemAsString(unref(lastModifiedParam))
      const mediaType = queryItemAsString(unref(mediaTypeParam))

      const query = buildSearchTerm({
        term: unref(searchTerm),
        isTitleOnlySearch,
        tags,
        lastModified,
        mediaType,
        scope: queryItemAsString(unref(scopeQuery)),
        useScope: unref(doUseScope) === 'true'
      })

      const updateFilter = (v: Ref<InstanceType<typeof ItemFilter>>) => {
        if (manuallyUpdateFilterChip && unref(v)) {
          /**
           * Handles edge cases where a filter is not being applied via the filter directly,
           * e.g. when clicking on a tag in the files list.
           * We need to manually update the selected items in the ItemFilter component because normally
           * it only does this on mount or when interacting with the filter directly.
           */
          unref(v).setSelectedItemsBasedOnQuery()
        }
      }

      if (tags) {
        updateFilter(tagFilter)
      }

      if (lastModified) {
        updateFilter(lastModifiedFilter)
      }

      if (mediaType) {
        updateFilter(mediaTypeFilter)
      }

      return query
    }

    const breadcrumbs = computed(() => {
      return [
        {
          text: unref(searchTerm)
            ? $gettext('Search results for "%{searchTerm}"', { searchTerm: unref(searchTerm) })
            : $gettext('Search')
        }
      ]
    })

    const resourceDomSelector = ({ id, remoteItemId }: Resource) => {
      let selectorStr = id.toString()
      if (remoteItemId) {
        selectorStr += remoteItemId
      }
      return extractDomSelector(selectorStr)
    }

    onMounted(async () => {
      // Store resources are shared across table views, therefore
      // the store state needs a reset to prevent the old list of resources
      // from being rendered while the request retrieves the new resources from the server.
      clearResourceList()
      setAncestorMetaData({})

      if (capabilityStore.filesTags) {
        await loadAvailableTagsTask.perform()
      }
      emit('search', doSearch())
    })

    watch(
      () => unref(route).query,
      (newVal, oldVal) => {
        // return early if this view is not active, no search needed
        {
          const isSearchViewActive = isLocationCommonActive(router, 'files-common-search')
          if (!isSearchViewActive) {
            return
          }
        }

        // return early if the search term or filter has not changed, no search needed
        {
          const isSameTerm = newVal?.term === oldVal?.term
          const isSameFilter = [
            'q_titleOnly',
            'q_tags',
            'q_lastModified',
            'q_mediaType',
            'useScope'
          ].every((key) => newVal[key] === oldVal[key])
          if (isSameTerm && isSameFilter) {
            return
          }
        }

        emit('search', doSearch(true))
      },
      { deep: true }
    )

    return {
      ...useFileActions(),
      ...resourcesView,
      configOptions,
      loadAvailableTagsTask,
      fileListHeaderY,
      fullTextSearchEnabled,
      getMatchingSpace,
      availableTags,
      tagFilter,
      breadcrumbs,
      displayFilter,
      availableLastModifiedValues,
      lastModifiedFilter,
      mediaTypeFilter,
      availableMediaTypeValues,
      getFakeResourceForIcon,
      resourceDomSelector,
      initResourceList,
      clearResourceList,
      totalResourcesCount,
      loadPreview
    }
  },
  computed: {
    itemCount() {
      return this.totalResourcesCount.files + this.totalResourcesCount.folders
    },
    rangeSupported() {
      return this.searchResult.totalResults
    },
    searchResultExceedsLimit() {
      return (
        !this.rangeSupported ||
        (this.searchResult.totalResults && this.searchResult.totalResults > searchLimit)
      )
    },
    searchResultExceedsLimitText() {
      if (!this.rangeSupported) {
        return this.$gettext('Showing up to %{searchLimit} results', {
          searchLimit: searchLimit.toString()
        })
      }

      return this.$gettext(
        'Found %{totalResults}, showing the %{itemCount} best matching results',
        {
          itemCount: this.itemCount.toString(),
          totalResults: this.searchResult.totalResults.toString()
        }
      )
    }
  },
  watch: {
    searchResult: {
      handler: async function () {
        if (!this.searchResult) {
          return
        }

        this.clearResourceList()
        this.initResourceList<SearchResource>({
          currentFolder: null,
          resources: this.searchResult.values.length
            ? this.searchResult.values.map((searchResult) => searchResult.data as SearchResource)
            : []
        })
        await nextTick()
        this.scrollToResourceFromRoute(this.paginatedResources, 'files-app-bar')
      }
    }
  }
})
</script>
<style lang="scss">
.files-search-resource-highlights {
  font-size: 0.8125rem;

  mark {
    background: #fff74c;
    font-style: normal;
    font-weight: var(--oc-font-weight-semibold);
  }
}
</style>
